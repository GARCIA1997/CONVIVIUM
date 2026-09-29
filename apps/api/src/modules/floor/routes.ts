import { floor } from "@convivium/contracts";
import { and, eq, inArray, schema } from "@convivium/db";
import { z } from "zod";
import { recordEvent } from "../../lib/audit.js";
import type { ApiModule } from "../../lib/module.js";
import { AppError } from "../../plugins/errors.js";
import { lineTotal } from "../orders/mapper.js";

const plugin: ApiModule["plugin"] = async (app) => {
  const { db } = app;

  /** E3-01 · Plano de mesas con estado calculado. */
  app.get("/", { onRequest: [app.guard()], schema: { tags: ["piso"], response: { 200: floor.FloorPlan } } }, async (req) => {
    const { branchId } = req.user;
    const [areas, tables, open] = await Promise.all([
      db.select().from(schema.areas).where(eq(schema.areas.branchId, branchId)),
      db.select().from(schema.tables).where(and(eq(schema.tables.branchId, branchId), eq(schema.tables.active, true))),
      db.select().from(schema.checks).where(and(eq(schema.checks.branchId, branchId), inArray(schema.checks.status, ["abierta", "pidio_cuenta"]))),
    ]);
    const openIds = open.map((c) => c.id);
    const [items, stations] = await Promise.all([
      openIds.length ? db.select().from(schema.orderItems).where(inArray(schema.orderItems.checkId, openIds)) : [],
      db.select({ id: schema.stations.id, name: schema.stations.name }).from(schema.stations).where(eq(schema.stations.branchId, branchId)),
    ]);
    const readyByCheck = new Map<string, string>();
    for (const i of items) if (i.state === "listo") readyByCheck.set(i.checkId, stations.find((s) => s.id === i.stationId)?.name ?? "");
    const totals = new Map<string, { total: number; count: number }>();
    for (const i of items) {
      const t = totals.get(i.checkId) ?? { total: 0, count: 0 };
      t.total += lineTotal(i);
      if (i.state !== "cancelado" && i.state !== "devuelto" && i.unitPrice > 0) t.count += i.quantity;
      totals.set(i.checkId, t);
    }
    return {
      areas,
      tables: tables.map((t) => {
        const check = open.find((c) => c.tableId === t.id);
        const status = !check ? "libre" : check.status === "pidio_cuenta" ? "pidio_cuenta" : readyByCheck.has(check.id) ? "listo_por_entregar" : "ocupada";
        const tot = check ? totals.get(check.id) : undefined;
        return {
          ...t,
          status,
          openCheckId: check?.id ?? null,
          guests: check?.guests ?? null,
          openedAt: check?.openedAt.toISOString() ?? null,
          total: check ? (tot?.total ?? 0) : null,
          itemCount: check ? (tot?.count ?? 0) : null,
          readyStation: check ? (readyByCheck.get(check.id) ?? null) : null,
        } as const;
      }),
    };
  });
  // ─── E3-10 · Editor de plano ─────────────────────────────────────────────
  const edit = { onRequest: [app.guard("mesas.editar")] };
  const tags = ["piso"];
  const TableBody = z.object({
    id: z.string().uuid().optional(),
    areaId: z.string().uuid(),
    label: z.string().trim().min(1).max(12),
    capacity: z.number().int().min(1).max(30),
    shape: z.enum(["redonda", "cuadrada", "rectangular", "periquera"]),
    x: z.number().min(0).max(2000),
    y: z.number().min(0).max(2000),
  });

  app.post("/areas", { ...edit, schema: { tags, body: z.object({ name: z.string().trim().min(2) }) } }, async (req) => {
    const existing = await db.select().from(schema.areas).where(eq(schema.areas.branchId, req.user.branchId));
    const [a] = await db.insert(schema.areas).values({ tenantId: req.user.tenantId, branchId: req.user.branchId, name: req.body.name, sortOrder: existing.length + 1 }).returning();
    await recordEvent(db, req.user, { type: "area.created", entity: "area", entityId: a!.id, data: { name: a!.name } });
    return a;
  });

  app.put("/areas/:id", { ...edit, schema: { tags, params: z.object({ id: z.string().uuid() }), body: z.object({ name: z.string().trim().min(2) }) } }, async (req) => {
    await db.update(schema.areas).set({ name: req.body.name }).where(and(eq(schema.areas.id, req.params.id), eq(schema.areas.branchId, req.user.branchId)));
    return { ok: true };
  });

  /** Guarda el plano completo: crea, actualiza y retira mesas en una transacción. */
  app.put("/layout", { ...edit, schema: { tags, body: z.object({ tables: z.array(TableBody), removed: z.array(z.string().uuid()) }) } }, async (req) => {
    const { branchId, tenantId } = req.user;
    const { tables, removed } = req.body;
    const labels = tables.map((t) => t.label.toUpperCase());
    const dup = labels.find((l, i) => labels.indexOf(l) !== i);
    if (dup) throw new AppError(400, "duplicate_label", `La clave ${dup} está repetida`);
    const areaIds = new Set((await db.select({ id: schema.areas.id }).from(schema.areas).where(eq(schema.areas.branchId, branchId))).map((a) => a.id));
    if (tables.some((t) => !areaIds.has(t.areaId))) throw new AppError(400, "bad_area", "Área inválida");
    if (removed.length) {
      const busy = await db.select({ tableId: schema.checks.tableId }).from(schema.checks)
        .where(and(inArray(schema.checks.tableId, removed), inArray(schema.checks.status, ["abierta", "pidio_cuenta"])));
      if (busy.length) throw new AppError(409, "table_busy", "No se puede retirar una mesa con cuenta abierta");
    }
    await db.transaction(async (tx) => {
      for (const t of tables) {
        const values = { areaId: t.areaId, label: t.label, capacity: t.capacity, shape: t.shape, x: Math.round(t.x), y: Math.round(t.y) };
        if (t.id) await tx.update(schema.tables).set(values).where(and(eq(schema.tables.id, t.id), eq(schema.tables.branchId, branchId)));
        else await tx.insert(schema.tables).values({ ...values, tenantId, branchId });
      }
      if (removed.length) await tx.update(schema.tables).set({ active: false }).where(and(inArray(schema.tables.id, removed), eq(schema.tables.branchId, branchId)));
    });
    await recordEvent(db, req.user, { type: "floor.published", entity: "floor", data: { tables: tables.length, created: tables.filter((t) => !t.id).length, removed: removed.length } });
    return { ok: true };
  });
};

export const floorModule: ApiModule = { prefix: "floor", plugin };
