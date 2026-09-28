import { cash } from "@convivium/contracts";
import { and, eq, isNull, schema } from "@convivium/db";
import { z } from "zod";
import { recordEvent } from "../../lib/audit.js";
import type { ApiModule } from "../../lib/module.js";
import { can } from "@convivium/domain";
import { AppError, conflict, forbidden } from "../../plugins/errors.js";
import { CashService } from "./service.js";
import { OrdersService } from "../orders/service.js";

const IdParam = z.object({ id: z.string().uuid() });

const plugin: ApiModule["plugin"] = async (app) => {
  const { db } = app;
  const orders = new OrdersService(app);
  const svc = new CashService(app);
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
    const prevPaid = prev.reduce((sum, p) => sum + toMxn(p), 0);
    const tendered = req.body.payments.reduce((sum, p) => sum + toMxn(p), 0);
    const change = Math.max(0, prevPaid + tendered - check.total);
    // El cambio se entrega en efectivo MXN: se descuenta del efectivo recibido para que el corte cuadre.
    let toReturn = change;
    const payments = req.body.payments.map((p) => {
      if (p.method !== "efectivo_mxn" || toReturn === 0) return p;
      const take = Math.min(toReturn, p.amount);
      toReturn -= take;
      return { ...p, amount: p.amount - take };
    });
    if (toReturn > 0) throw new AppError(400, "change_without_cash", "El cambio solo puede entregarse en efectivo MXN");
    const rows = payments.filter((p) => p.amount > 0);
    if (rows.length) await db.insert(schema.payments).values(rows.map((p) => ({ ...p, tenantId: req.user.tenantId, checkId: check.id, cashSessionId: s.id })));
    if (req.body.tip) await db.insert(schema.tips).values({ ...req.body.tip, tenantId: req.user.tenantId, checkId: check.id, waiterId: check.waiterId });
    const paid = prevPaid + tendered;
    const settled = paid >= check.total;
    if (settled) await db.update(schema.checks).set({ status: "cobrada", closedAt: new Date() }).where(eq(schema.checks.id, check.id));
    await recordEvent(db, req.user, { type: "check.payment", entity: "check", entityId: check.id, data: req.body });
    if (settled && check.tableId) app.hub.publish(["floor"], { type: "table.status", tableId: check.tableId, status: "libre" });
    return { paid, change, checkStatus: settled ? "cobrada" : check.status };
  });

  /** E6-03 · Dividir cuenta. */
  app.post("/checks/:id/split", { onRequest: [app.guard("caja.cobrar")], schema: { tags, params: IdParam, body: cash.SplitBody } }, async (req) =>
    svc.split(req.user, req.params.id, req.body),
  );

  /** E6-07 · Corte X / Z. El Z exige permiso de gerente. */
  app.post("/sessions/current/counts", { onRequest: [app.guard("caja.corte_x")], schema: { tags, body: cash.CashCountBody } }, async (req) => {
    if (req.body.kind === "Z" && !can(req.user.roles, "caja.corte_z")) throw forbidden("El corte Z requiere autorización de gerente");
    return svc.count(req.user, req.body);
  });

  /** E6-08 · Reabrir cuenta cobrada. */
  app.post("/checks/:id/reopen", { onRequest: [app.guard("cuenta.reabrir")], schema: { tags, params: IdParam, body: z.object({ reason: z.string().min(3) }) } }, async (req) =>
    svc.reopen(req.user, req.params.id, req.body.reason),
  );
};

export const cashModule: ApiModule = { prefix: "cash", plugin };
