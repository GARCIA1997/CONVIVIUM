import { and, eq, gte, schema, sql } from "@convivium/db";
import { z } from "zod";
import type { ApiModule } from "../../lib/module.js";
import { notImplemented } from "../../plugins/errors.js";

const Range = z.object({ from: z.string().datetime().optional(), to: z.string().datetime().optional() });

const plugin: ApiModule["plugin"] = async (app) => {
  const tags = ["reportes"];
  const todo = async () => { throw notImplemented(); };

  /** E9-01 · Dashboard en vivo (día en curso). */
  app.get("/live", { onRequest: [app.guard("reportes.ver")], schema: { tags } }, async (req) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [sales] = await app.db
      .select({ total: sql<number>`coalesce(sum(${schema.payments.amount}),0)::int`, tickets: sql<number>`count(distinct ${schema.payments.checkId})::int` })
      .from(schema.payments)
      .innerJoin(schema.checks, eq(schema.checks.id, schema.payments.checkId))
      .where(and(eq(schema.checks.branchId, req.user.branchId), gte(schema.payments.createdAt, start)));
    const [open] = await app.db
      .select({ count: sql<number>`count(*)::int`, guests: sql<number>`coalesce(sum(${schema.checks.guests}),0)::int` })
      .from(schema.checks)
      .where(and(eq(schema.checks.branchId, req.user.branchId), eq(schema.checks.status, "abierta")));
    const total = sales?.total ?? 0;
    const tickets = sales?.tickets ?? 0;
    return { salesToday: total, tickets, avgTicket: tickets ? Math.round(total / tickets) : 0, openChecks: open?.count ?? 0, guests: open?.guests ?? 0 };
  });

  app.get("/sales", { onRequest: [app.guard("reportes.ver")], schema: { tags, querystring: Range.extend({ groupBy: z.enum(["producto", "categoria", "mesero", "estacion", "forma_pago", "hora"]) }) } }, todo); // E9-02
  app.get("/exceptions", { onRequest: [app.guard("reportes.ver")], schema: { tags, querystring: Range } }, todo); // E9-03
  app.get("/prep-times", { onRequest: [app.guard("reportes.ver")], schema: { tags, querystring: Range } }, todo); // E9-04
  app.get("/menu-engineering", { onRequest: [app.guard("dashboard.ver")], schema: { tags, querystring: Range } }, todo); // E9-05
  app.get("/tips", { onRequest: [app.guard("reportes.ver")], schema: { tags, querystring: Range } }, todo);
};

export const reportsModule: ApiModule = { prefix: "reports", plugin };
