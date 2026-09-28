import { floor } from "@convivium/contracts";
import { and, eq, inArray, schema } from "@convivium/db";
import type { ApiModule } from "../../lib/module.js";

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
    const ready = openIds.length
      ? await db.select({ checkId: schema.orderItems.checkId }).from(schema.orderItems).where(and(inArray(schema.orderItems.checkId, openIds), eq(schema.orderItems.state, "listo")))
      : [];
    const readySet = new Set(ready.map((r) => r.checkId));
    return {
      areas,
      tables: tables.map((t) => {
        const check = open.find((c) => c.tableId === t.id);
        const status = !check ? "libre" : check.status === "pidio_cuenta" ? "pidio_cuenta" : readySet.has(check.id) ? "listo_por_entregar" : "ocupada";
        return { ...t, status, openCheckId: check?.id ?? null } as const;
      }),
    };
  });
};

export const floorModule: ApiModule = { prefix: "floor", plugin };
