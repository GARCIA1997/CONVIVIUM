import { floor } from "@convivium/contracts";
import { and, eq, inArray, schema } from "@convivium/db";
import type { ApiModule } from "../../lib/module.js";
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
};

export const floorModule: ApiModule = { prefix: "floor", plugin };
