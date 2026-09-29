import { and, eq, gte, inArray, lt, lte, schema, sql } from "@convivium/db";
import { breakdownIncludedTaxes, classifyMenu, menuAdvice } from "@convivium/domain";
import { lineTotal } from "../orders/mapper.js";
import { InventoryService } from "../inventory/service.js";
import { forbidden } from "../../plugins/errors.js";
import type { Principal } from "../../plugins/auth.js";
import { prepTimesReport, salesReport, tipsReport, type Scope } from "./analytics.js";

/** Importe de un producto sin importar su estado (para medir lo cancelado o devuelto). */
const lineTotalRaw = (i: { unitPrice: number; quantity: number; modifiers: { priceDelta: number }[] }) => (i.unitPrice + i.modifiers.reduce((s, m) => s + m.priceDelta, 0)) * i.quantity;
import { z } from "zod";
import type { ApiModule } from "../../lib/module.js";

const Range = z.object({ from: z.string().datetime().optional(), to: z.string().datetime().optional() });

const plugin: ApiModule["plugin"] = async (app) => {
  const tags = ["reportes"];

  /** E9-01 · Dashboard en vivo (día en curso) con comparativo contra el mismo día de la semana anterior. */
  app.get("/live", { onRequest: [app.guard("reportes.ver")], schema: { tags } }, async (req) => {
    const { branchId, tenantId } = req.user;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const now = new Date();
    const weekAgo = (d: Date) => new Date(d.getTime() - 7 * 864e5);

    const paysFor = (from: Date, to: Date) =>
      app.db
        .select({ amount: schema.payments.amount, method: schema.payments.method, rate: schema.payments.exchangeRate, checkId: schema.payments.checkId, at: schema.payments.createdAt })
        .from(schema.payments)
        .innerJoin(schema.checks, eq(schema.checks.id, schema.payments.checkId))
        .where(and(eq(schema.checks.branchId, branchId), gte(schema.payments.createdAt, from), lt(schema.payments.createdAt, to)));
    const toMxn = (p: { amount: number; method: string; rate: number | null }) => (p.method === "efectivo_usd" ? Math.round((p.amount * (p.rate ?? 0)) / 100) : p.amount);

    const [today, lastWeek, checksToday, tables, openChecks, itemsToday, stations] = await Promise.all([
      paysFor(start, now),
      paysFor(weekAgo(start), weekAgo(now)),
      app.db.select().from(schema.checks).where(and(eq(schema.checks.branchId, branchId), gte(schema.checks.openedAt, start))),
      app.db.select({ id: schema.tables.id }).from(schema.tables).where(and(eq(schema.tables.branchId, branchId), eq(schema.tables.active, true))),
      app.db.select().from(schema.checks).where(and(eq(schema.checks.branchId, branchId), inArray(schema.checks.status, ["abierta", "pidio_cuenta"]))),
      app.db.select().from(schema.orderItems).where(and(eq(schema.orderItems.branchId, branchId), gte(schema.orderItems.createdAt, start))),
      app.db.select().from(schema.stations).where(eq(schema.stations.branchId, branchId)),
    ]);

    const salesToday = today.reduce((s, p) => s + toMxn(p), 0);
    const salesLastWeek = lastWeek.reduce((s, p) => s + toMxn(p), 0);
    const tickets = new Set(today.map((p) => p.checkId)).size;
    const guests = checksToday.reduce((s, c) => s + (c.guests ?? 0), 0);

    const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, total: 0 }));
    for (const p of today) hourly[p.at.getHours()]!.total += toMxn(p);

    const products = new Map<string, { qty: number; amount: number }>();
    for (const i of itemsToday) {
      if (i.unitPrice === 0 || i.state === "cancelado" || i.state === "devuelto") continue;
      const cur = products.get(i.productName) ?? { qty: 0, amount: 0 };
      cur.qty += i.quantity;
      cur.amount += lineTotal(i);
      products.set(i.productName, cur);
    }
    const topProducts = [...products].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.amount - a.amount).slice(0, 5);

    const methods = new Map<string, number>();
    for (const p of today) methods.set(p.method, (methods.get(p.method) ?? 0) + toMxn(p));

    const hourAgo = new Date(now.getTime() - 3600e3);
    const prepTimes = stations.map((st) => {
      const done = itemsToday.filter((i) => i.stationId === st.id && i.readyAt && i.sentAt && i.readyAt >= hourAgo);
      const avgSec = done.length ? Math.round(done.reduce((s, i) => s + (i.readyAt!.getTime() - i.sentAt!.getTime()) / 1000, 0) / done.length) : null;
      return { station: st.name, avgSec, targetSec: st.defaultTargetSec, samples: done.length };
    });

    const pidio = openChecks.filter((c) => c.status === "pidio_cuenta");
    const occupied = new Set(openChecks.map((c) => c.tableId).filter(Boolean)).size;

    // Alertas operativas
    const alerts: { kind: "cxp" | "insumo" | "fraude"; title: string; detail: string }[] = [];
    const soon = new Date(now.getTime() + 2 * 864e5).toISOString().slice(0, 10);
    const payables = await app.db
      .select({ amount: schema.payables.balance, due: schema.payables.dueAt, supplier: schema.suppliers.name })
      .from(schema.payables)
      .innerJoin(schema.suppliers, eq(schema.suppliers.id, schema.payables.supplierId))
      .where(and(eq(schema.payables.tenantId, tenantId), inArray(schema.payables.status, ["pendiente", "parcial"]), lte(schema.payables.dueAt, soon)));
    if (payables.length)
      alerts.push({ kind: "cxp", title: `${payables.length} cuenta(s) por pagar vencen pronto`, detail: payables.map((p) => `${p.supplier}: $${(p.amount / 100).toLocaleString("es-MX")}`).join(" · ") });
    const low = await app.db
      .select({ name: schema.ingredients.name, min: schema.ingredients.minStock, qty: sql<string>`coalesce(sum(${schema.stock.quantity}),0)`, unit: schema.ingredients.useUnit })
      .from(schema.ingredients)
      .leftJoin(schema.stock, eq(schema.stock.ingredientId, schema.ingredients.id))
      .where(and(eq(schema.ingredients.tenantId, tenantId), eq(schema.ingredients.critical, true)))
      .groupBy(schema.ingredients.id);
    for (const l of low.filter((l) => Number(l.qty) < Number(l.min)))
      alerts.push({ kind: "insumo", title: "Insumo crítico bajo mínimo", detail: `${l.name}: ${Number(l.qty)} ${l.unit} (mínimo ${Number(l.min)})` });
    const courtesies = await app.db
      .select({ by: schema.discounts.appliedBy, n: sql<number>`count(*)::int`, total: sql<number>`sum(${schema.discounts.amount})::int` })
      .from(schema.discounts)
      .where(and(eq(schema.discounts.tenantId, tenantId), gte(schema.discounts.createdAt, start)))
      .groupBy(schema.discounts.appliedBy);
    const flagged = courtesies.filter((c) => c.n >= 3);
    if (flagged.length) {
      const names = await app.db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, flagged.map((f) => f.by)));
      for (const f of flagged)
        alerts.push({ kind: "fraude", title: "Desvío de cortesías detectado", detail: `${names.find((n) => n.id === f.by)?.name ?? ""}: ${f.n} cortesías/descuentos hoy ($${(f.total / 100).toLocaleString("es-MX")})` });
    }

    return {
      salesToday,
      salesLastWeek,
      tickets,
      avgTicket: tickets ? Math.round(salesToday / tickets) : 0,
      guests,
      openChecks: openChecks.length,
      occupancy: { total: tables.length, occupied, pidioCuenta: pidio.length, free: Math.max(0, tables.length - occupied) },
      hourly,
      topProducts,
      paymentMethods: [...methods].map(([method, amount]) => ({ method, amount })),
      prepTimes,
      alerts,
    };
  });

  /** `branch`: otra sucursal o "todas" (E9-06). Solo quien ve el tablero del dueño puede salir de la suya. */
  const Period = z.object({ days: z.coerce.number().int().min(1).max(365).default(7), branch: z.union([z.literal("todas"), z.string().uuid()]).optional() });
  const scopeOf = async (req: { user: Principal; query: { days: number; branch?: string } }): Promise<Scope> => {
    const branches = await app.db.select({ id: schema.branches.id, tz: schema.branches.timezone }).from(schema.branches).where(eq(schema.branches.tenantId, req.user.tenantId));
    let branchIds = [req.user.branchId];
    if (req.query.branch && req.query.branch !== req.user.branchId) {
      if (!(await app.policy.can(req.user, "dashboard.ver"))) throw forbidden("Solo el dueño compara sucursales");
      branchIds = req.query.branch === "todas" ? branches.map((b) => b.id) : branches.filter((b) => b.id === req.query.branch).map((b) => b.id);
      if (!branchIds.length) throw forbidden("Sucursal de otra empresa");
    }
    const from = new Date(Date.now() - req.query.days * 864e5);
    if (req.query.days === 1) from.setHours(0, 0, 0, 0);
    const tz = branches.find((b) => b.id === branchIds[0])?.tz ?? "America/Mexico_City";
    return { tenantId: req.user.tenantId, branchIds, from, to: new Date(), timezone: tz };
  };

  /** E9-06 · Comparativo de sucursales: venta, ticket, propinas, puntualidad de cocina y excepciones. */
  app.get("/branches", { onRequest: [app.guard("dashboard.ver")], schema: { tags, querystring: Period.pick({ days: true }) } }, async (req) => {
    const branches = await app.db.select().from(schema.branches).where(eq(schema.branches.tenantId, req.user.tenantId));
    const base = await scopeOf({ user: req.user, query: { days: req.query.days } });
    const rows = await Promise.all(branches.map(async (b) => {
      const s = { ...base, branchIds: [b.id], timezone: b.timezone };
      const [sales, tips, times, exc, lastSync] = await Promise.all([
        salesReport(app.db, s, "categoria"), tipsReport(app.db, s), prepTimesReport(app.db, s),
        app.db.select({ n: sql<number>`count(*)::int` }).from(schema.events).where(and(eq(schema.events.branchId, b.id), inArray(schema.events.type, ["item.cancelled", "item.returned"]), gte(schema.events.createdAt, s.from))),
        app.db.select({ at: sql<string | null>`max(${schema.devices.lastSeenAt})` }).from(schema.devices).where(and(eq(schema.devices.branchId, b.id), eq(schema.devices.kind, "nodo"))),
      ]);
      return {
        branchId: b.id, name: b.name,
        sales: sales.summary.total, checks: sales.summary.checks, avgTicket: sales.summary.avgTicket, perGuest: sales.summary.perGuest,
        tipsPct: tips.summary.pctOfSales, onTimePct: times.summary.onTimePct, p90Sec: times.summary.p90Sec,
        exceptions: exc[0]?.n ?? 0, topCategory: sales.rows[0]?.label ?? null, lastSyncAt: lastSync[0]?.at ?? null,
      };
    }));
    const total = rows.reduce((n, r) => n + r.sales, 0);
    return { days: req.query.days, total, branches: rows.map((r) => ({ ...r, sharePct: total ? Math.round((r.sales / total) * 1000) / 10 : 0 })).sort((a, b) => b.sales - a.sales) };
  });

  /** E9-02 · Ventas por producto, categoría, mesero, estación, forma de pago u hora. */
  app.get("/sales", { onRequest: [app.guard("reportes.ver")], schema: { tags, querystring: Period.extend({ groupBy: z.enum(["producto", "categoria", "mesero", "estacion", "forma_pago", "hora"]).default("producto") }) } }, async (req) =>
    salesReport(app.db, await scopeOf(req), req.query.groupBy));
  /** E9-03 · Devoluciones, cancelaciones, cortesías y descuentos por motivo y por empleado, con radar de desviación. */
  app.get("/exceptions", { onRequest: [app.guard("reportes.ver")], schema: { tags, querystring: z.object({ days: z.coerce.number().int().min(1).max(90).default(7) }) } }, async (req) => {
    const { tenantId, branchId } = req.user;
    const from = new Date(Date.now() - req.query.days * 864e5);
    const [evs, discounts, reasons, users, tables] = await Promise.all([
      app.db.select().from(schema.events).where(and(eq(schema.events.tenantId, tenantId), gte(schema.events.createdAt, from), inArray(schema.events.type, ["item.cancelled", "item.returned"]))),
      app.db.select().from(schema.discounts).where(and(eq(schema.discounts.tenantId, tenantId), gte(schema.discounts.createdAt, from))),
      app.db.select({ id: schema.reasons.id, label: schema.reasons.label }).from(schema.reasons).where(eq(schema.reasons.tenantId, tenantId)),
      app.db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(eq(schema.users.tenantId, tenantId)),
      app.db.select({ id: schema.tables.id, label: schema.tables.label }).from(schema.tables).where(eq(schema.tables.branchId, branchId)),
    ]);
    const itemIds = evs.map((e) => e.entityId).filter((x): x is string => !!x);
    const items = itemIds.length ? await app.db.select().from(schema.orderItems).where(inArray(schema.orderItems.id, itemIds)) : [];
    const checkIds = [...new Set([...items.map((i) => i.checkId), ...discounts.map((d) => d.checkId)])];
    const checks = checkIds.length ? await app.db.select({ id: schema.checks.id, tableId: schema.checks.tableId, name: schema.checks.name }).from(schema.checks).where(inArray(schema.checks.id, checkIds)) : [];
    const nameOf = (id: string | null | undefined) => users.find((u) => u.id === id)?.name ?? null;
    const reasonOf = (id: unknown) => reasons.find((r) => r.id === id)?.label ?? "Sin motivo";
    const where = (checkId: string) => { const c = checks.find((x) => x.id === checkId); return tables.find((t) => t.id === c?.tableId)?.label ?? (c?.name ? `Barra · ${c.name}` : ""); };

    type Row = { at: string; kind: "devolucion" | "cancelacion" | "cortesia" | "descuento"; product: string | null; where: string; amount: number; reason: string; requestedBy: string | null; authorizedBy: string | null };
    const rows: Row[] = [];
    for (const e of evs) {
      const it = items.find((i) => i.id === e.entityId);
      const d = e.data as Record<string, unknown>;
      rows.push({ at: e.createdAt.toISOString(), kind: e.type === "item.returned" ? "devolucion" : "cancelacion", product: it?.productName ?? null, where: it ? where(it.checkId) : "", amount: it ? lineTotalRaw(it) : 0, reason: reasonOf(d.reasonId), requestedBy: nameOf(e.actorId), authorizedBy: e.authorizedBy && e.authorizedBy !== e.actorId ? nameOf(e.authorizedBy) : null });
    }
    for (const d of discounts)
      rows.push({ at: d.createdAt.toISOString(), kind: d.type === "cortesia" ? "cortesia" : "descuento", product: null, where: where(d.checkId), amount: d.amount, reason: reasonOf(d.reasonId), requestedBy: nameOf(d.appliedBy), authorizedBy: nameOf(d.authorizedBy) });
    rows.sort((a, b) => b.at.localeCompare(a.at));

    const sum = (k: Row["kind"]) => ({ count: rows.filter((r) => r.kind === k).length, amount: rows.filter((r) => r.kind === k).reduce((s, r) => s + r.amount, 0) });
    const byReason = [...rows.reduce((m, r) => m.set(r.reason, (m.get(r.reason) ?? 0) + 1), new Map<string, number>())].map(([reason, count]) => ({ reason, count, pct: rows.length ? Math.round((count / rows.length) * 100) : 0 })).sort((a, b) => b.count - a.count);
    const emp = new Map<string, { count: number; amount: number; authorized: number }>();
    for (const r of rows) {
      if (!r.requestedBy) continue;
      const cur = emp.get(r.requestedBy) ?? { count: 0, amount: 0, authorized: 0 };
      cur.count++; cur.amount += r.amount; if (r.authorizedBy) cur.authorized++;
      emp.set(r.requestedBy, cur);
    }
    const employees = [...emp].map(([name, v]) => {
      const others = [...emp].filter(([n]) => n !== name).map(([, x]) => x.amount);
      const avg = others.length ? others.reduce((a, b) => a + b, 0) / others.length : 0;
      const ratio = avg ? v.amount / avg : null;
      return { name, ...v, ratioVsOthers: ratio, alert: (ratio !== null && ratio >= 3) || v.count >= 5 };
    }).sort((a, b) => b.amount - a.amount);
    return { days: req.query.days, totals: { devolucion: sum("devolucion"), cancelacion: sum("cancelacion"), cortesia: sum("cortesia"), descuento: sum("descuento") }, byReason, employees, rows };
  });
  /** E9-04 · Tiempos de preparación por estación y producto (promedio y percentiles). */
  app.get("/prep-times", { onRequest: [app.guard("reportes.ver")], schema: { tags, querystring: Period } }, async (req) => prepTimesReport(app.db, await scopeOf(req)));
  /** E9-05 · Ingeniería de menú: popularidad vs. margen, costo teórico vs. real (kardex) y recomendaciones. */
  app.get("/menu-engineering", { onRequest: [app.guard("dashboard.ver")], schema: { tags, querystring: Range.extend({ days: z.coerce.number().int().min(1).max(365).default(30) }) } }, async (req) => {
    const { db } = app;
    const to = req.query.to ? new Date(req.query.to) : new Date();
    const from = req.query.from ? new Date(req.query.from) : new Date(to.getTime() - req.query.days * 86_400_000);
    const prevFrom = new Date(from.getTime() - (to.getTime() - from.getTime()));
    const [branch] = await db.select().from(schema.branches).where(eq(schema.branches.id, req.user.branchId));
    const ivaFactor = 1 + (branch?.ivaPct ?? 16) / 100;
    const sold = (a: Date, b: Date) => db
      .select({ item: schema.orderItems })
      .from(schema.orderItems)
      .innerJoin(schema.checks, eq(schema.checks.id, schema.orderItems.checkId))
      .where(and(eq(schema.orderItems.branchId, req.user.branchId), eq(schema.checks.status, "cobrada"), gte(schema.orderItems.createdAt, a), lt(schema.orderItems.createdAt, b)));
    const [rows, prevRows, products, categories, costs, moves] = await Promise.all([
      sold(from, to), sold(prevFrom, from),
      db.select().from(schema.products).where(eq(schema.products.tenantId, req.user.tenantId)),
      db.select().from(schema.categories).where(eq(schema.categories.tenantId, req.user.tenantId)),
      new InventoryService(app).productCosts(req.user.tenantId),
      db.select({ ingredientId: schema.stockMovements.ingredientId, quantity: schema.stockMovements.quantity, type: schema.stockMovements.type })
        .from(schema.stockMovements)
        .where(and(eq(schema.stockMovements.branchId, req.user.branchId), inArray(schema.stockMovements.type, ["venta", "merma", "ajuste"]), gte(schema.stockMovements.createdAt, from), lt(schema.stockMovements.createdAt, to))),
    ]);
    const stats = new Map<string, { units: number; gross: number }>();
    for (const { item: i } of rows) {
      if (i.unitPrice === 0 || i.state === "cancelado" || i.state === "devuelto") continue;
      const s = stats.get(i.productId) ?? { units: 0, gross: 0 };
      s.units += i.quantity; s.gross += lineTotal(i); stats.set(i.productId, s);
    }
    const net = (gross: number, p?: { iepsPct: string }) => breakdownIncludedTaxes(gross, { ivaPct: (branch?.ivaPct ?? 16) as 16 | 8, iepsPct: Number(p?.iepsPct ?? 0) }).base;
    const { items, popThreshold, marginThreshold } = classifyMenu(products.filter((p) => p.active).map((p) => {
      const s = stats.get(p.id) ?? { units: 0, gross: 0 };
      return { productId: p.id, name: p.name, category: categories.find((c) => c.id === p.categoryId)?.name ?? "", units: s.units, netRevenue: net(s.gross, p), unitCost: costs.byProduct.get(p.id) ?? null, price: p.price };
    }));
    const netSales = items.reduce((n, i) => n + i.netRevenue, 0);
    const theoretical = items.reduce((n, i) => n + (i.unitCost ?? 0) * i.units, 0);
    // Costo real: lo que salió del kardex por venta, merma y ajustes negativos, valuado a costo promedio.
    const real = Math.round(moves.reduce((n, m) => { const q = Number(m.quantity); return q < 0 ? n + -q * (costs.ingredientCost.get(m.ingredientId) ?? 0) : n; }, 0));
    const prevGross = prevRows.reduce((n, { item: i }) => n + (i.unitPrice === 0 ? 0 : lineTotal(i)), 0);
    const gross = rows.reduce((n, { item: i }) => n + (i.unitPrice === 0 ? 0 : lineTotal(i)), 0);
    return {
      from: from.toISOString(), to: to.toISOString(),
      summary: {
        grossSales: gross,
        units: items.reduce((n, i) => n + i.units, 0),
        growthPct: prevGross ? Math.round(((gross - prevGross) / prevGross) * 1000) / 10 : null,
        avgMargin: marginThreshold,
        grossMarginPct: netSales ? Math.round(((netSales - theoretical) / netSales) * 1000) / 10 : null,
        theoreticalCostPct: netSales ? Math.round((theoretical / netSales) * 1000) / 10 : null,
        // Si el kardex registró menos de la mitad del consumo teórico, faltan salidas: no se compara.
        kardexIncomplete: theoretical > 0 && real < theoretical * 0.5,
        realCostPct: netSales && real >= theoretical * 0.5 ? Math.round((real / netSales) * 1000) / 10 : null,
        costGap: netSales && real >= theoretical * 0.5 ? real - theoretical : null,
        withoutRecipe: items.filter((i) => i.unitCost === null).length,
      },
      popThreshold, marginThreshold,
      items: items.map((i) => ({ ...i, advice: menuAdvice(i, marginThreshold, ivaFactor) })),
    };
  });
  /** Propinas por mesero y forma de pago. */
  app.get("/tips", { onRequest: [app.guard("reportes.ver")], schema: { tags, querystring: Period } }, async (req) => tipsReport(app.db, await scopeOf(req)));
};

export const reportsModule: ApiModule = { prefix: "reports", plugin };
