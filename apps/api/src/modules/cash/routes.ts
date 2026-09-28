import { cash } from "@convivium/contracts";
import { and, eq, isNull, schema } from "@convivium/db";
import { z } from "zod";
import { recordEvent } from "../../lib/audit.js";
import type { ApiModule } from "../../lib/module.js";
import { AppError, conflict, notImplemented } from "../../plugins/errors.js";
import { OrdersService } from "../orders/service.js";

const IdParam = z.object({ id: z.string().uuid() });

const plugin: ApiModule["plugin"] = async (app) => {
  const { db } = app;
  const orders = new OrdersService(app);
  const tags = ["caja"];

  const currentSession = async (branchId: string, cashierId: string) =>
    (await db.select().from(schema.cashSessions).where(and(eq(schema.cashSessions.branchId, branchId), eq(schema.cashSessions.cashierId, cashierId), isNull(schema.cashSessions.closedAt))))[0];

  /** E6-01 · Apertura con fondo. Una caja abierta por usuario. */
  app.post("/sessions", { onRequest: [app.guard("caja.abrir")], schema: { tags, body: cash.OpenCashBody } }, async (req, reply) => {
    if (await currentSession(req.user.branchId, req.user.userId)) throw conflict("session_open", "Ya tienes una caja abierta");
    const [s] = await db.insert(schema.cashSessions).values({ ...req.body, tenantId: req.user.tenantId, branchId: req.user.branchId, cashierId: req.user.userId }).returning();
    await recordEvent(db, req.user, { type: "cash.opened", entity: "cash_session", entityId: s!.id, data: req.body });
    return reply.status(201).send(s);
  });

  app.get("/sessions/current", { onRequest: [app.guard("caja.abrir")], schema: { tags } }, async (req) => (await currentSession(req.user.branchId, req.user.userId)) ?? null);

  /** E6-06 · Retiros y entradas de efectivo. */
  app.post("/sessions/current/movements", { onRequest: [app.guard("caja.movimiento")], schema: { tags, body: cash.CashMovementBody } }, async (req) => {
    const s = await currentSession(req.user.branchId, req.user.userId);
    if (!s) throw new AppError(409, "no_session", "No hay caja abierta");
    const [m] = await db.insert(schema.cashMovements).values({ ...req.body, tenantId: req.user.tenantId, cashSessionId: s.id, createdBy: req.user.userId }).returning();
    await recordEvent(db, req.user, { type: `cash.${req.body.type}`, entity: "cash_movement", entityId: m!.id, data: req.body });
    return m;
  });

  /** E6-04/E6-05 · Registrar pago(s) mixtos y propina. No procesa pagos: solo los registra. */
  app.post("/checks/:id/pay", { onRequest: [app.guard("caja.cobrar")], schema: { tags, params: IdParam, body: cash.PayBody, response: { 200: cash.PayResponse } } }, async (req) => {
    const s = await currentSession(req.user.branchId, req.user.userId);
    if (!s) throw new AppError(409, "no_session", "No hay caja abierta");
    const check = await orders.getCheck(req.user, req.params.id);
    const prev = await db.select().from(schema.payments).where(eq(schema.payments.checkId, check.id));
    const toMxn = (p: { method: string; amount: number; exchangeRate?: number | null }) =>
      p.method === "efectivo_usd" ? Math.round((p.amount * (p.exchangeRate ?? 0)) / 100) : p.amount;
    await db.insert(schema.payments).values(req.body.payments.map((p) => ({ ...p, tenantId: req.user.tenantId, checkId: check.id, cashSessionId: s.id })));
    if (req.body.tip) await db.insert(schema.tips).values({ ...req.body.tip, tenantId: req.user.tenantId, checkId: check.id, waiterId: check.waiterId });
    const paid = [...prev, ...req.body.payments].reduce((sum, p) => sum + toMxn(p), 0);
    const settled = paid >= check.total;
    if (settled) await db.update(schema.checks).set({ status: "cobrada", closedAt: new Date() }).where(eq(schema.checks.id, check.id));
    await recordEvent(db, req.user, { type: "check.payment", entity: "check", entityId: check.id, data: req.body });
    if (settled && check.tableId) app.hub.publish(["floor"], { type: "table.status", tableId: check.tableId, status: "libre" });
    return { paid, change: Math.max(0, paid - check.total), checkStatus: settled ? "cobrada" : check.status };
  });

  // Definidos en el contrato, pendientes de implementar:
  app.post("/checks/:id/split", { onRequest: [app.guard("caja.cobrar")], schema: { tags, params: IdParam, body: cash.SplitBody } }, async () => { throw notImplemented(); }); // E6-03
  app.post("/sessions/current/counts", { onRequest: [app.guard("caja.corte_x")], schema: { tags, body: cash.CashCountBody } }, async () => { throw notImplemented(); }); // E6-07
  app.post("/checks/:id/reopen", { onRequest: [app.guard("cuenta.reabrir")], schema: { tags, params: IdParam } }, async () => { throw notImplemented(); }); // E6-08
};

export const cashModule: ApiModule = { prefix: "cash", plugin };
