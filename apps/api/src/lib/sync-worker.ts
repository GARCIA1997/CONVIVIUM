import { and, applyConfigChanges, asc, eq, gt, inArray, isNull, lt, lte, schema, type ConfigChange } from "@convivium/db";
import type { FastifyInstance } from "fastify";
import { config } from "../config.js";

/**
 * Sincronización del nodo con la nube (doc 05 §5). En cada ciclo:
 *  1. Sube eventos operativos no sincronizados (idempotente por id).
 *  2. Sube la configuración editada en el nodo (la nube resuelve last-writer-wins) y la operación
 *     de la sucursal (ventas, caja, inventario) para reportes consolidados.
 *  3. Baja la configuración de la nube desde el último cursor (la primera vez, foto completa).
 * El orden 2 → 3 evita que un cambio local aún no subido se pise con la versión de la nube.
 * Si no hay internet, el nodo sigue operando y reintenta en el siguiente ciclo.
 */
export function startSyncWorker(app: FastifyInstance) {
  if (!config.CLOUD_URL || !config.NODE_TOKEN || !config.BRANCH_ID) {
    app.log.warn("Sync deshabilitado: faltan CLOUD_URL, NODE_TOKEN o BRANCH_ID");
    return;
  }
  const cloud = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const res = await fetch(`${config.CLOUD_URL}/v1/sync${path}`, {
      method,
      headers: { ...(body ? { "content-type": "application/json" } : {}), authorization: `Bearer ${config.NODE_TOKEN}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`nube respondió ${res.status} en ${path}`);
    return res.json() as Promise<T>;
  };
  const getCursor = async (key: string) => Number((await app.db.select().from(schema.syncState).where(eq(schema.syncState.key, key)))[0]?.value ?? 0);
  const setCursor = (key: string, value: number) =>
    app.db.insert(schema.syncState).values({ key, value: String(value) }).onConflictDoUpdate({ target: schema.syncState.key, set: { value: String(value) } });

  async function pushEvents() {
    while (true) {
      const batch = await app.db.select().from(schema.events).where(isNull(schema.events.syncedAt)).orderBy(asc(schema.events.seq)).limit(500);
      if (!batch.length) return;
      await cloud("POST", "/events", {
        branchId: config.BRANCH_ID,
        events: batch.map((e) => ({ ...e, createdAt: e.createdAt.toISOString(), syncedAt: undefined, seq: undefined })),
      });
      await app.db.update(schema.events).set({ syncedAt: new Date().toISOString() }).where(inArray(schema.events.id, batch.map((e) => e.id)));
      app.log.info(`sync: ${batch.length} eventos subidos`);
    }
  }

  async function pushConfig() {
    let since = await getCursor("config.pushed");
    while (true) {
      const rows = await app.db.select().from(schema.configChanges).where(gt(schema.configChanges.seq, since)).orderBy(asc(schema.configChanges.seq)).limit(500);
      if (!rows.length) return;
      const r = await cloud<{ applied: number; stale: number; ops: number }>("POST", "/config", {
        changes: rows.map((c) => ({ table: c.tableName, op: c.op, pk: c.pk, data: c.data, changedAt: c.changedAt.toISOString() })),
      });
      since = rows.at(-1)!.seq;
      await setCursor("config.pushed", since);
      // Lo ya subido solo se conserva 7 días en el nodo (la nube guarda el historial completo).
      await app.db.delete(schema.configChanges).where(and(lte(schema.configChanges.seq, since), lt(schema.configChanges.changedAt, new Date(Date.now() - 7 * 864e5))));
      app.log.info(`sync: subidos ${r.ops} registros de operación y ${r.applied} de configuración (${r.stale} ya superados en la nube)`);
    }
  }

  async function pullConfig() {
    let since = await getCursor("config.pulled");
    const touched = new Set<string>();
    while (true) {
      const r = await cloud<{ cursor: number; snapshot: boolean; changes: ConfigChange[] }>("GET", `/config?since=${since}`);
      if (r.changes.length) {
        await applyConfigChanges(app.db, r.changes, { silent: true });
        for (const c of r.changes) touched.add(c.table);
        app.log.info(`sync: ${r.changes.length} cambios de configuración recibidos${r.snapshot ? " (foto completa)" : ""}`);
      }
      const moved = r.cursor !== since;
      since = r.cursor;
      await setCursor("config.pulled", since);
      if (r.snapshot || !moved || r.changes.length < 1000) break;
    }
    notify(touched);
  }

  /** Avisa a las apps del local y limpia cachés según lo que cambió. */
  function notify(tables: Set<string>) {
    if (!tables.size) return;
    const any = (...t: string[]) => t.some((x) => tables.has(x));
    if (any("products", "categories", "modifier_groups", "modifiers", "product_modifier_groups", "product_stations", "product_availability", "promotions"))
      app.hub.publish(["menu"], { type: "menu.updated" });
    if (any("tables", "areas", "floor_fixtures")) app.hub.publish(["floor"], { type: "floor.updated" });
    // Permisos por rol y topes viven en tenants: se recarga la política en caché.
    if (any("tenants")) void app.db.select({ id: schema.tenants.id }).from(schema.tenants).then((ts) => ts.forEach((t) => app.policy.invalidate(t.id)));
  }

  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await pushEvents();
      await pushConfig();
      await pullConfig();
    } catch (err) {
      app.log.warn(`sync pendiente (sin conexión con la nube): ${(err as Error).message}`);
    } finally {
      running = false;
    }
  };
  void tick();
  const timer = setInterval(tick, config.SYNC_INTERVAL_MS);
  app.addHook("onClose", async () => clearInterval(timer));
}
