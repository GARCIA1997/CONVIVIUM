import { and, eq, gte, inArray, lt, schema, type Db } from "@convivium/db";
import { localClock } from "@convivium/domain";
import { lineTotal } from "../orders/mapper.js";

/** Periodo de un reporte y sucursales que abarca (una en el nodo; una o varias en la nube). */
export interface Scope { tenantId: string; branchIds: string[]; from: Date; to: Date; timezone: string }

const pctl = (sorted: number[], p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))]! : 0);

/** Cuentas cobradas del periodo con sus renglones cobrables (sin cancelados/devueltos ni renglones de ensamble). */
async function paidChecks(db: Db, s: Scope) {
  const checks = await db.select().from(schema.checks).where(and(
    eq(schema.checks.tenantId, s.tenantId), inArray(schema.checks.branchId, s.branchIds), eq(schema.checks.status, "cobrada"),
    gte(schema.checks.closedAt, s.from), lt(schema.checks.closedAt, s.to),
  ));
  const ids = checks.map((c) => c.id);
  const items = ids.length ? await db.select().from(schema.orderItems).where(inArray(schema.orderItems.checkId, ids)) : [];
  return { checks, items: items.filter((i) => i.unitPrice > 0 && i.state !== "cancelado" && i.state !== "devuelto") };
}

export type SalesGroup = "producto" | "categoria" | "mesero" | "estacion" | "forma_pago" | "hora";

/** E9-02 · Ventas agrupadas, con totales del periodo. */
export async function salesReport(db: Db, s: Scope, groupBy: SalesGroup) {
  const { checks, items } = await paidChecks(db, s);
  const total = items.reduce((n, i) => n + lineTotal(i), 0);
  const guests = checks.reduce((n, c) => n + (c.guests ?? 0), 0);
  const rows = new Map<string, { key: string; label: string; amount: number; units: number; checks: Set<string> }>();
  const add = (key: string, label: string, amount: number, units: number, checkId: string) => {
    const r = rows.get(key) ?? { key, label, amount: 0, units: 0, checks: new Set<string>() };
    r.amount += amount; r.units += units; r.checks.add(checkId); rows.set(key, r);
  };

  if (groupBy === "forma_pago") {
    const pays = checks.length ? await db.select().from(schema.payments).where(inArray(schema.payments.checkId, checks.map((c) => c.id))) : [];
    const LABEL: Record<string, string> = { efectivo_mxn: "Efectivo MXN", efectivo_usd: "Efectivo USD", tarjeta: "Tarjeta", transferencia: "Transferencia", vales: "Vales" };
    // Se reparte el total de cada cuenta entre sus pagos (el cambio no es venta).
    for (const c of checks) {
      const ps = pays.filter((p) => p.checkId === c.id);
      const ct = items.filter((i) => i.checkId === c.id).reduce((n, i) => n + lineTotal(i), 0);
      const tendered = ps.reduce((n, p) => n + (p.method === "efectivo_usd" ? Math.round((p.amount * (p.exchangeRate ?? 0)) / 100) : p.amount), 0) || 1;
      // Reparto proporcional; el último pago absorbe el residuo del redondeo para que la cuenta cuadre al centavo.
      let assigned = 0;
      ps.forEach((p, i) => {
        const mxn = p.method === "efectivo_usd" ? Math.round((p.amount * (p.exchangeRate ?? 0)) / 100) : p.amount;
        const share = i === ps.length - 1 ? ct - assigned : Math.round((ct * mxn) / tendered);
        assigned += share;
        add(p.method, LABEL[p.method] ?? p.method, share, 0, c.id);
      });
      if (!ps.length && ct) add("sin_pago", "Sin pago registrado", ct, 0, c.id);
    }
  } else {
    const productIds = [...new Set(items.map((i) => i.productId))];
    const [products, categories, users, stations] = await Promise.all([
      productIds.length ? db.select({ id: schema.products.id, categoryId: schema.products.categoryId }).from(schema.products).where(inArray(schema.products.id, productIds)) : [],
      db.select({ id: schema.categories.id, name: schema.categories.name }).from(schema.categories).where(eq(schema.categories.tenantId, s.tenantId)),
      db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(eq(schema.users.tenantId, s.tenantId)),
      db.select({ id: schema.stations.id, name: schema.stations.name }).from(schema.stations).where(inArray(schema.stations.branchId, s.branchIds)),
    ]);
    const checkById = new Map(checks.map((c) => [c.id, c]));
    for (const i of items) {
      const amount = lineTotal(i);
      switch (groupBy) {
        case "producto": add(i.productId, i.productName, amount, i.quantity, i.checkId); break;
        case "categoria": { const cat = products.find((p) => p.id === i.productId)?.categoryId ?? ""; add(cat, categories.find((c) => c.id === cat)?.name ?? "Sin categoría", amount, i.quantity, i.checkId); break; }
        case "mesero": { const w = checkById.get(i.checkId)!.waiterId; add(w, users.find((u) => u.id === w)?.name ?? "—", amount, i.quantity, i.checkId); break; }
        case "estacion": add(i.stationId, stations.find((st) => st.id === i.stationId)?.name ?? "—", amount, i.quantity, i.checkId); break;
        case "hora": { const h = Math.floor(localClock(i.createdAt, s.timezone).minutes / 60); add(String(h).padStart(2, "0"), `${String(h).padStart(2, "0")}:00`, amount, i.quantity, i.checkId); break; }
      }
    }
  }
  const out = [...rows.values()].map((r) => ({ key: r.key, label: r.label, amount: r.amount, units: r.units, checks: r.checks.size, pct: total ? Math.round((r.amount / total) * 1000) / 10 : 0 }));
  out.sort((a, b) => (groupBy === "hora" ? a.key.localeCompare(b.key) : b.amount - a.amount));
  return {
    groupBy,
    summary: { total, checks: checks.length, guests, avgTicket: checks.length ? Math.round(total / checks.length) : 0, perGuest: guests ? Math.round(total / guests) : 0 },
    rows: out,
  };
}

/** Propinas por mesero y por forma de pago, y su proporción sobre la venta. */
export async function tipsReport(db: Db, s: Scope) {
  const { checks, items } = await paidChecks(db, s);
  const ids = checks.map((c) => c.id);
  const [tips, users] = await Promise.all([
    ids.length ? db.select().from(schema.tips).where(inArray(schema.tips.checkId, ids)) : [],
    db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(eq(schema.users.tenantId, s.tenantId)),
  ]);
  const sales = items.reduce((n, i) => n + lineTotal(i), 0);
  const salesBy = new Map<string, number>();
  for (const c of checks) salesBy.set(c.waiterId, (salesBy.get(c.waiterId) ?? 0) + items.filter((i) => i.checkId === c.id).reduce((n, i) => n + lineTotal(i), 0));
  const byWaiter = new Map<string, { amount: number; count: number }>();
  const byMethod = new Map<string, number>();
  for (const t of tips) {
    const w = byWaiter.get(t.waiterId) ?? { amount: 0, count: 0 };
    w.amount += t.amount; w.count++; byWaiter.set(t.waiterId, w);
    byMethod.set(t.method, (byMethod.get(t.method) ?? 0) + t.amount);
  }
  const total = tips.reduce((n, t) => n + t.amount, 0);
  return {
    summary: { total, count: tips.length, sales, pctOfSales: sales ? Math.round((total / sales) * 1000) / 10 : 0, checksWithTip: new Set(tips.map((t) => t.checkId)).size, checks: checks.length },
    byWaiter: [...salesBy.keys(), ...byWaiter.keys()].filter((v, i, a) => a.indexOf(v) === i).map((id) => {
      const w = byWaiter.get(id) ?? { amount: 0, count: 0 };
      const sold = salesBy.get(id) ?? 0;
      return { waiterId: id, name: users.find((u) => u.id === id)?.name ?? "—", amount: w.amount, count: w.count, sales: sold, pctOfSales: sold ? Math.round((w.amount / sold) * 1000) / 10 : 0 };
    }).sort((a, b) => b.amount - a.amount),
    byMethod: [...byMethod.entries()].map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount),
  };
}

/** E9-04 · Tiempos de preparación (enviado → listo) por estación y por producto: promedio, p50, p90 y % a tiempo. */
export async function prepTimesReport(db: Db, s: Scope) {
  const [items, stations] = await Promise.all([
    db.select({ productName: schema.orderItems.productName, stationId: schema.orderItems.stationId, sentAt: schema.orderItems.sentAt, readyAt: schema.orderItems.readyAt, target: schema.orderItems.targetPrepSec })
      .from(schema.orderItems)
      .where(and(eq(schema.orderItems.tenantId, s.tenantId), inArray(schema.orderItems.branchId, s.branchIds), gte(schema.orderItems.createdAt, s.from), lt(schema.orderItems.createdAt, s.to))),
    db.select({ id: schema.stations.id, name: schema.stations.name }).from(schema.stations).where(inArray(schema.stations.branchId, s.branchIds)),
  ]);
  const done = items.filter((i) => i.sentAt && i.readyAt && i.readyAt > i.sentAt).map((i) => ({ ...i, sec: Math.round((i.readyAt!.getTime() - i.sentAt!.getTime()) / 1000) }));
  const stats = (rows: typeof done) => {
    const secs = rows.map((r) => r.sec).sort((a, b) => a - b);
    const onTime = rows.filter((r) => r.sec <= r.target).length;
    return {
      samples: rows.length,
      avgSec: rows.length ? Math.round(secs.reduce((a, b) => a + b, 0) / rows.length) : 0,
      p50Sec: pctl(secs, 0.5), p90Sec: pctl(secs, 0.9),
      targetSec: rows.length ? Math.round(rows.reduce((n, r) => n + r.target, 0) / rows.length) : 0,
      onTimePct: rows.length ? Math.round((onTime / rows.length) * 1000) / 10 : 0,
    };
  };
  const group = <K extends string>(key: (r: (typeof done)[number]) => K) => {
    const m = new Map<K, typeof done>();
    for (const r of done) m.set(key(r), [...(m.get(key(r)) ?? []), r]);
    return m;
  };
  return {
    summary: stats(done),
    byStation: [...group((r) => r.stationId)].map(([id, rows]) => ({ stationId: id, name: stations.find((st) => st.id === id)?.name ?? "—", ...stats(rows) })).sort((a, b) => b.samples - a.samples),
    byProduct: [...group((r) => r.productName)].map(([name, rows]) => ({ name, ...stats(rows) })).sort((a, b) => b.p90Sec - a.p90Sec),
  };
}
