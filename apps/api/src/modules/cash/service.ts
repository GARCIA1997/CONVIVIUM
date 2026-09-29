import type { cash } from "@convivium/contracts";
import { and, eq, inArray, isNull, schema } from "@convivium/db";
import type { FastifyInstance } from "fastify";
import type { z } from "zod";
import { recordEvent } from "../../lib/audit.js";
import type { Principal } from "../../plugins/auth.js";
import { AppError, conflict } from "../../plugins/errors.js";
import { lineTotal } from "../orders/mapper.js";
import { OrdersService } from "../orders/service.js";

type Method = z.infer<typeof cash.PaymentMethod>;
const METHODS: Method[] = ["efectivo_mxn", "efectivo_usd", "tarjeta", "transferencia", "vales"];

export class CashService {
  private orders: OrdersService;
  constructor(private app: FastifyInstance, private db = app.db) {
    this.orders = new OrdersService(app);
  }

  async currentSession(who: Principal) {
    const [s] = await this.db
      .select()
      .from(schema.cashSessions)
      .where(and(eq(schema.cashSessions.branchId, who.branchId), eq(schema.cashSessions.cashierId, who.userId), isNull(schema.cashSessions.closedAt)));
    return s;
  }

  async requireSession(who: Principal) {
    const s = await this.currentSession(who);
    if (!s) throw new AppError(409, "no_session", "No hay caja abierta");
    return s;
  }

  /**
   * E6-03 · Dividir cuenta.
   *  - iguales: solo calcula montos (se cobran como pagos parciales de la misma cuenta).
   *  - por_comensal / por_producto: crea cuentas hijas y mueve los productos.
   */
  async split(who: Principal, checkId: string, body: z.infer<typeof cash.SplitBody>) {
    const check = await this.orders.getCheck(who, checkId);
    if (check.status === "cobrada" || check.status === "cancelada") throw conflict("check_closed", "La cuenta ya está cerrada");

    if (body.mode === "iguales") {
      const base = Math.floor(check.total / body.parts);
      const parts = Array.from({ length: body.parts }, (_, i) => base + (i < check.total - base * body.parts ? 1 : 0));
      return { mode: body.mode, parts: parts.map((amount) => ({ checkId, amount })) };
    }

    const [original] = await this.db.select().from(schema.checks).where(eq(schema.checks.id, checkId));
    let groups: string[][];
    if (body.mode === "por_comensal") {
      const byGuest = new Map<number, string[]>();
      for (const i of check.items) if (i.guest) byGuest.set(i.guest, [...(byGuest.get(i.guest) ?? []), i.id]);
      if (byGuest.size < 2) throw conflict("no_guests", "Asigna productos a al menos dos comensales");
      groups = [...byGuest.entries()].sort(([a], [b]) => a - b).map(([, ids]) => ids);
    } else {
      const known = new Set(check.items.map((i) => i.id));
      if (body.groups.flat().some((id) => !known.has(id))) throw conflict("foreign_item", "Producto de otra cuenta");
      groups = body.groups;
    }

    // El primer grupo (y lo no asignado) se queda en la cuenta original.
    const created: string[] = [];
    for (const [idx, ids] of groups.slice(1).entries()) {
      const [child] = await this.db
        .insert(schema.checks)
        .values({ ...original!, id: undefined, openedAt: undefined, name: `${original!.name ?? "Cuenta"} · ${idx + 2}` })
        .returning();
      await this.db.update(schema.orderItems).set({ checkId: child!.id }).where(inArray(schema.orderItems.id, ids));
      created.push(child!.id);
    }
    await recordEvent(this.db, who, { type: "check.split", entity: "check", entityId: checkId, data: { mode: body.mode, created } });
    const all = [checkId, ...created];
    const parts = [];
    for (const id of all) parts.push({ checkId: id, amount: (await this.orders.getCheck(who, id)).total });
    return { mode: body.mode, parts };
  }

  /** Esperado por forma de pago en la sesión (fondo, ventas, propinas, movimientos, pagos a proveedor). */
  async expected(sessionId: string) {
    const [session] = await this.db.select().from(schema.cashSessions).where(eq(schema.cashSessions.id, sessionId));
    const [payments, movements, supplier] = await Promise.all([
      this.db.select().from(schema.payments).where(eq(schema.payments.cashSessionId, sessionId)),
      this.db.select().from(schema.cashMovements).where(eq(schema.cashMovements.cashSessionId, sessionId)),
      this.db.select().from(schema.supplierPayments).where(eq(schema.supplierPayments.cashSessionId, sessionId)),
    ]);
    const checkIds = [...new Set(payments.map((p) => p.checkId))];
    const tips = checkIds.length ? await this.db.select().from(schema.tips).where(inArray(schema.tips.checkId, checkIds)) : [];

    const exp = Object.fromEntries(METHODS.map((m) => [m, 0])) as Record<Method, number>;
    exp.efectivo_mxn += session!.openingFloat;
    for (const p of payments) exp[p.method] += p.amount; // USD se cuenta en dólares (centavos USD)
    for (const t of tips) exp[t.method] += t.amount;
    for (const m of movements) exp.efectivo_mxn += m.type === "entrada" ? m.amount : -m.amount;
    for (const s of supplier) exp.efectivo_mxn -= s.amount;
    return { expected: exp, sales: payments.reduce((s, p) => s + (p.method === "efectivo_usd" ? Math.round((p.amount * (p.exchangeRate ?? 0)) / 100) : p.amount), 0), tips: tips.reduce((s, t) => s + t.amount, 0) };
  }

  /** Resumen de la sesión para la pantalla de corte: apertura, movimientos, propinas por mesero y descuentos. */
  async summary(who: Principal) {
    const session = await this.requireSession(who);
    const [movements, payments, supplier, cashier] = await Promise.all([
      this.db.select().from(schema.cashMovements).where(eq(schema.cashMovements.cashSessionId, session.id)),
      this.db.select().from(schema.payments).where(eq(schema.payments.cashSessionId, session.id)),
      this.db.select().from(schema.supplierPayments).where(eq(schema.supplierPayments.cashSessionId, session.id)),
      this.db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, session.cashierId)),
    ]);
    const checkIds = [...new Set(payments.map((p) => p.checkId))];
    const [tips, discounts] = await Promise.all([
      checkIds.length ? this.db.select().from(schema.tips).where(inArray(schema.tips.checkId, checkIds)) : [],
      checkIds.length ? this.db.select().from(schema.discounts).where(inArray(schema.discounts.checkId, checkIds)) : [],
    ]);
    const waiterIds = [...new Set(tips.map((t) => t.waiterId))];
    const waiters = waiterIds.length ? await this.db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, waiterIds)) : [];
    const tipsByWaiter = waiterIds.map((id) => ({ name: waiters.find((w) => w.id === id)?.name ?? "", amount: tips.filter((t) => t.waiterId === id).reduce((s, t) => s + t.amount, 0) }));
    const { sales } = await this.expected(session.id);
    return {
      sessionId: session.id,
      cashierName: cashier[0]?.name ?? "",
      openedAt: session.openedAt.toISOString(),
      openingFloat: session.openingFloat,
      movements: [
        ...movements.map((m) => ({ at: m.createdAt.toISOString(), type: m.type as "entrada" | "retiro", amount: m.amount, reason: m.reason })),
        ...supplier.map((p) => ({ at: p.createdAt.toISOString(), type: "proveedor" as const, amount: p.amount, reason: p.reference ?? "Pago a proveedor" })),
      ].sort((a, b) => a.at.localeCompare(b.at)),
      sales,
      discounts: discounts.filter((d) => d.type !== "cortesia").reduce((s, d) => s + d.amount, 0),
      courtesies: discounts.filter((d) => d.type === "cortesia").reduce((s, d) => s + d.amount, 0),
      tipsByWaiter,
    };
  }

  /** E6-07 · Corte X (parcial) o Z (cierre). Conteo ciego: el esperado se revela al registrar lo contado. */
  async count(who: Principal, body: z.infer<typeof cash.CashCountBody>, authorizedBy?: string) {
    const session = await this.requireSession(who);
    const { expected, sales, tips } = await this.expected(session.id);
    const differences = Object.fromEntries(METHODS.map((m) => [m, (body.counted[m] ?? 0) - expected[m]]));
    await this.db.insert(schema.cashCounts).values({ tenantId: who.tenantId, cashSessionId: session.id, kind: body.kind, expected, counted: body.counted, createdBy: who.userId });
    if (body.kind === "Z") {
      await this.db.update(schema.cashSessions).set({ closedAt: new Date(), closedBy: authorizedBy ?? who.userId }).where(eq(schema.cashSessions.id, session.id));
    }
    await recordEvent(this.db, who, { type: `cash.corte_${body.kind}`, entity: "cash_session", entityId: session.id, data: { counted: body.counted, expected, differences }, authorizedBy });
    return { kind: body.kind, expected, counted: body.counted, differences, sales, tips, closed: body.kind === "Z" };
  }

  /** E6-08 · Reabrir cuenta cobrada (requiere permiso; queda en bitácora). */
  async reopen(who: Principal, checkId: string, reason: string) {
    const check = await this.orders.getCheck(who, checkId);
    if (check.status !== "cobrada") throw conflict("not_paid", "Solo se reabren cuentas cobradas");
    await this.db.update(schema.checks).set({ status: "abierta", closedAt: null }).where(eq(schema.checks.id, checkId));
    await recordEvent(this.db, who, { type: "check.reopened", entity: "check", entityId: checkId, data: { reason }, authorizedBy: who.userId });
    if (check.tableId) this.app.hub.publish(["floor"], { type: "table.status", tableId: check.tableId, status: "ocupada" });
    return { ok: true };
  }
}

export { lineTotal };
