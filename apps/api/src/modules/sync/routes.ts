import { and, asc, configSnapshot, desc, eq, gt, isConfigTable, isNull, ne, or, schema, sql, type ConfigChange } from "@convivium/db";
import type { FastifyRequest } from "fastify";
import { z } from "zod";
import type { ApiModule } from "../../lib/module.js";
import { forbidden } from "../../plugins/errors.js";

/**
 * Sincronización nodo (edge) ↔ nube (doc 05 §5).
 *  - Nube recibe lotes de eventos de cada nodo (idempotente por id).
 *  - Nube entrega configuración versionada y recibe la editada en el nodo (last-writer-wins por registro).
 */
const EventBatch = z.object({
  branchId: z.string().uuid(),
  events: z.array(
    z.object({
      id: z.string().uuid(),
      tenantId: z.string().uuid(),
      branchId: z.string().uuid().nullable(),
      type: z.string(),
      actorId: z.string().uuid().nullable(),
      authorizedBy: z.string().uuid().nullable(),
      deviceId: z.string().uuid().nullable(),
      entity: z.string(),
      entityId: z.string().uuid().nullable(),
      data: z.unknown(),
      createdAt: z.string(),
    }),
  ).max(1000),
});

const ChangeBatch = z.object({
  changes: z.array(z.object({
    table: z.string().refine(isConfigTable, "Tabla no sincronizable"),
    op: z.enum(["upsert", "delete"]),
    pk: z.record(z.unknown()),
    data: z.record(z.unknown()).nullable(),
    changedAt: z.string().datetime(),
  })).max(1000),
});

const cloudPlugin: ApiModule["plugin"] = async (app) => {
  const tags = ["sync (nube)"];

  /** Solo un nodo vinculado y vigente de la sucursal puede sincronizar. */
  const nodeGuard = async (req: FastifyRequest) => {
    await req.jwtVerify();
    const [d] = req.user.deviceId ? await app.db.select().from(schema.devices).where(eq(schema.devices.id, req.user.deviceId)) : [];
    if (!d || d.kind !== "nodo" || d.revokedAt || d.branchId !== req.user.branchId) throw forbidden("Solo un nodo vinculado puede sincronizar");
    await app.db.update(schema.devices).set({ lastSeenAt: new Date() }).where(eq(schema.devices.id, d.id));
  };

  app.post("/events", { onRequest: [nodeGuard], schema: { tags, body: EventBatch, response: { 200: z.object({ accepted: z.number() }) } } }, async (req) => {
    // Un nodo solo puede subir eventos de su propia empresa y sucursal.
    if (req.body.branchId !== req.user.branchId || req.body.events.some((e) => e.tenantId !== req.user.tenantId)) throw forbidden("Lote de otra sucursal");
    if (!req.body.events.length) return { accepted: 0 };
    const rows = await app.db
      .insert(schema.events)
      .values(req.body.events.map((e) => ({ ...e, data: e.data as object, createdAt: new Date(e.createdAt), syncedAt: new Date().toISOString() })))
      .onConflictDoNothing({ target: schema.events.id })
      .returning({ id: schema.events.id });
    // TODO: proyectar eventos a tablas de reporte consolidadas por sucursal (E9-06).
    return { accepted: rows.length };
  });

  /**
   * Nube → nodo. `since=0` entrega la foto completa de la sucursal; después, solo los cambios
   * posteriores al cursor (de la empresa o de esa sucursal) que no originó el propio nodo.
   */
  app.get("/config", { onRequest: [nodeGuard], schema: { tags, querystring: z.object({ since: z.coerce.number().int().min(0).default(0) }) } }, async (req) => {
    const { tenantId, branchId, deviceId } = req.user;
    const [last] = await app.db.select({ seq: schema.configChanges.seq }).from(schema.configChanges).orderBy(desc(schema.configChanges.seq)).limit(1);
    if (req.query.since === 0) return { cursor: last?.seq ?? 0, snapshot: true, changes: await configSnapshot(app.db, tenantId, branchId) };
    const rows = await app.db.select().from(schema.configChanges)
      .where(and(
        eq(schema.configChanges.tenantId, tenantId),
        gt(schema.configChanges.seq, req.query.since),
        or(isNull(schema.configChanges.branchId), eq(schema.configChanges.branchId, branchId)),
        or(isNull(schema.configChanges.originDevice), ne(schema.configChanges.originDevice, deviceId!)),
      ))
      .orderBy(asc(schema.configChanges.seq)).limit(1000);
    const changes: ConfigChange[] = rows.map((r) => ({ table: r.tableName as ConfigChange["table"], op: r.op, pk: r.pk, data: r.data, changedAt: r.changedAt.toISOString() }));
    // El cursor avanza al último registro revisado (aunque se haya filtrado por ser del propio nodo).
    const [scanned] = await app.db.select({ seq: sql<number>`max(${schema.configChanges.seq})::int` }).from(schema.configChanges)
      .where(and(eq(schema.configChanges.tenantId, tenantId), gt(schema.configChanges.seq, req.query.since)));
    const cursor = rows.length === 1000 ? rows.at(-1)!.seq : Math.max(req.query.since, scanned?.seq ?? req.query.since);
    return { cursor, snapshot: false, changes };
  });

  /**
   * Nodo → nube: configuración editada en el nodo (p. ej. admin en la LAN sin internet).
   * Last-writer-wins por registro: si la nube tiene un cambio más reciente de ese mismo registro, se descarta.
   */
  app.post("/config", { onRequest: [nodeGuard], schema: { tags, body: ChangeBatch } }, async (req) => {
    const { tenantId, deviceId } = req.user;
    let applied = 0, stale = 0;
    await app.db.transaction(async (tx) => {
      for (const c of req.body.changes as ConfigChange[]) {
        const [newer] = await tx.select({ seq: schema.configChanges.seq }).from(schema.configChanges)
          .where(and(eq(schema.configChanges.tableName, c.table), sql`${schema.configChanges.pk} = ${JSON.stringify(c.pk)}::jsonb`, gt(schema.configChanges.changedAt, new Date(c.changedAt))))
          .limit(1);
        if (newer) { stale++; continue; }
        // La fila existente (si hay) y la nueva deben ser de la empresa del nodo.
        const rows = (await tx.execute(sql`SELECT config_row_tenant(${c.table}, config_current_row(${c.table}, ${JSON.stringify(c.pk)}::jsonb)) AS cur, config_row_tenant(${c.table}, ${c.data ? JSON.stringify(c.data) : null}::jsonb) AS next`)) as unknown as { cur: string | null; next: string | null }[];
        const { cur, next } = rows[0]!;
        if ((cur && cur !== tenantId) || (c.op === "upsert" && next !== tenantId)) throw forbidden("Cambio de otra empresa");
        await tx.execute(sql`SELECT apply_config_change(${c.table}, ${c.op}, ${JSON.stringify(c.pk)}::jsonb, ${c.data ? JSON.stringify(c.data) : null}::jsonb, false, ${deviceId ?? null}::uuid)`);
        applied++;
      }
    });
    app.policy.invalidate(tenantId);
    return { applied, stale };
  });
};

export const syncCloudModule: ApiModule = { prefix: "sync", plugin: cloudPlugin, mode: "cloud" };
