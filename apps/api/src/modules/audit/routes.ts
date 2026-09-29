import { and, desc, eq, gte, inArray, lt, schema, sql } from "@convivium/db";
import { z } from "zod";
import type { ApiModule } from "../../lib/module.js";

/** Categorías de la bitácora (E1-06) según el tipo de evento. */
const CATEGORY: [RegExp, string][] = [
  [/^item\.cancelled$/, "cancelacion"],
  [/^item\.returned$/, "devolucion"],
  [/^approval\./, "autorizacion"],
  [/^check\.reopened$/, "reapertura"],
  [/^(product\.(updated|created)|promotion\.)/, "catalogo"],
  [/^(stock\.|count\.|production$|ingredient\.|recipe\.)/, "inventario"],
  [/^(receipt\.|po\.|payable\.|supplier\.)/, "compras"],
  [/^cash\./, "caja"],
  [/^(station\.|user\.|role\.)/, "configuracion"],
];
const categoryOf = (type: string) => CATEGORY.find(([re]) => re.test(type))?.[1] ?? "operacion";
const CRITICAL = new Set(["cancelacion", "devolucion", "reapertura", "catalogo"]);
const money = (c: unknown) => `$${(Number(c ?? 0) / 100).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;

const PERIOD = z.enum(["hoy", "7d", "30d"]).default("hoy");
const since = (p: "hoy" | "7d" | "30d") => {
  const d = new Date();
  if (p === "hoy") d.setHours(0, 0, 0, 0);
  else d.setDate(d.getDate() - (p === "7d" ? 7 : 30));
  return d;
};

const plugin: ApiModule["plugin"] = async (app) => {
  const tags = ["auditoría"];

  /** Texto legible del evento a partir de sus datos. */
  function describe(type: string, data: Record<string, any>, names: { products: Map<string, string>; reasons: Map<string, string> }) {
    switch (type) {
      case "product.updated": {
        const b = data.before ?? {}, a = data.after ?? {};
        return b.price !== a.price ? `${a.name ?? b.name} (${money(b.price)} → ${money(a.price)})` : `${a.name ?? b.name} actualizado`;
      }
      case "item.cancelled": return `Producto cancelado desde estado "${data.fromState}"${data.reasonId ? ` · Motivo: ${names.reasons.get(data.reasonId) ?? ""}` : ""}`;
      case "item.returned": return `Devolución: ${data.resolution === "rehacer" ? "rehacer" : "retirar de cuenta"}${data.reasonId ? ` · Motivo: ${names.reasons.get(data.reasonId) ?? ""}` : ""}`;
      case "check.reopened": return `Cuenta reabierta · Motivo: ${data.reason ?? ""}`;
      case "check.payment": return `Cobro registrado: ${(data.payments ?? []).map((p: any) => `${p.method} ${money(p.amount)}`).join(", ")}`;
      case "cash.corte_X": case "cash.corte_Z": return `Corte ${type.slice(-1)} · diferencia efectivo ${money(data.differences?.efectivo_mxn)}`;
      case "cash.opened": return `Apertura de caja con fondo ${money(data.openingFloat)}`;
      case "approval.aprobada": case "approval.rechazada": return `Solicitud ${type.endsWith("aprobada") ? "aprobada" : "rechazada"}`;
      case "approval.requested": return `Solicitud de ${String(data.kind ?? "").replace("_", " ")}${data.amount ? ` por ${money(data.amount)}` : ""}${data.pct ? ` (${data.pct}%)` : ""}`;
      case "count.approved": case "count.rejected": return `Conteo físico ${type.endsWith("approved") ? "aprobado" : "rechazado"} · diferencia ${money(data.totalDiffValue)}`;
      case "stock.merma": case "stock.ajuste": case "stock.traspaso": return `${type.split(".")[1]} de ${data.quantity} en inventario`;
      case "receipt.created": return `Recepción de mercancía por ${money(data.total)}${data.invoiceFolio ? ` · Factura ${data.invoiceFolio}` : ""}`;
      case "payable.payment": return `Pago a proveedor ${money(data.amount)} (${String(data.method).replace("_", " ")})`;
      case "po.created": return `Orden de compra con ${(data.lines ?? []).length} partidas`;
      case "po.approved": return `Orden de compra aprobada por ${money(data.total)}`;
      case "items.added": return `${(data.items ?? []).length} producto(s) agregados: ${(data.items ?? []).map((i: any) => names.products.get(i.productId) ?? "").filter(Boolean).join(", ")}`;
      default: return type;
    }
  }

  /** E1-06 · Bitácora inmutable con contexto (quién, rol, quién autorizó, dispositivo). */
  app.get("/", {
    onRequest: [app.guard("auditoria.ver")],
    schema: { tags, querystring: z.object({ period: PERIOD, category: z.string().optional(), actorId: z.string().uuid().optional(), before: z.coerce.number().optional(), limit: z.coerce.number().max(200).default(100) }) },
  }, async (req) => {
    const { tenantId, branchId } = req.user;
    const conds = [eq(schema.events.tenantId, tenantId), gte(schema.events.createdAt, since(req.query.period))];
    if (req.query.actorId) conds.push(eq(schema.events.actorId, req.query.actorId));
    if (req.query.before) conds.push(lt(schema.events.seq, req.query.before));
    let rows = await app.db.select().from(schema.events).where(and(...conds)).orderBy(desc(schema.events.seq)).limit(req.query.category ? 1000 : req.query.limit);
    if (req.query.category) rows = rows.filter((r) => categoryOf(r.type) === req.query.category).slice(0, req.query.limit);

    const userIds = [...new Set(rows.flatMap((r) => [r.actorId, r.authorizedBy]).filter((x): x is string => !!x))];
    const deviceIds = [...new Set(rows.map((r) => r.deviceId).filter((x): x is string => !!x))];
    const [users, roles, devices, products, reasons] = await Promise.all([
      userIds.length ? app.db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, userIds)) : [],
      userIds.length ? app.db.select().from(schema.userRoles).where(and(inArray(schema.userRoles.userId, userIds), eq(schema.userRoles.branchId, branchId))) : [],
      deviceIds.length ? app.db.select({ id: schema.devices.id, name: schema.devices.name, kind: schema.devices.kind }).from(schema.devices).where(inArray(schema.devices.id, deviceIds)) : [],
      app.db.select({ id: schema.products.id, name: schema.products.name }).from(schema.products).where(eq(schema.products.tenantId, tenantId)),
      app.db.select({ id: schema.reasons.id, label: schema.reasons.label }).from(schema.reasons).where(eq(schema.reasons.tenantId, tenantId)),
    ]);
    const names = { products: new Map(products.map((p) => [p.id, p.name])), reasons: new Map(reasons.map((r) => [r.id, r.label])) };
    const items = rows.map((r) => ({
      seq: r.seq,
      id: r.id,
      at: r.createdAt.toISOString(),
      type: r.type,
      category: categoryOf(r.type),
      critical: CRITICAL.has(categoryOf(r.type)),
      entity: r.entity,
      detail: describe(r.type, r.data as Record<string, unknown>, names),
      data: r.data,
      actor: r.actorId ? { id: r.actorId, name: users.find((u) => u.id === r.actorId)?.name ?? "", roles: roles.filter((x) => x.userId === r.actorId).map((x) => x.role) } : null,
      authorizedBy: r.authorizedBy && r.authorizedBy !== r.actorId ? users.find((u) => u.id === r.authorizedBy)?.name ?? null : null,
      device: devices.find((d) => d.id === r.deviceId) ?? null,
      synced: !!r.syncedAt,
    }));
    return { items, nextCursor: rows.at(-1)?.seq ?? null };
  });

  /** Indicadores de la bitácora para el periodo. */
  app.get("/summary", { onRequest: [app.guard("auditoria.ver")], schema: { tags, querystring: z.object({ period: PERIOD }) } }, async (req) => {
    const rows = await app.db
      .select({ type: schema.events.type, n: sql<number>`count(*)::int`, authorized: sql<number>`count(${schema.events.authorizedBy})::int` })
      .from(schema.events)
      .where(and(eq(schema.events.tenantId, req.user.tenantId), gte(schema.events.createdAt, since(req.query.period))))
      .groupBy(schema.events.type);
    const byCategory: Record<string, number> = {};
    for (const r of rows) byCategory[categoryOf(r.type)] = (byCategory[categoryOf(r.type)] ?? 0) + r.n;
    const start = since(req.query.period);
    const [disc] = await app.db.select({ total: sql<number>`coalesce(sum(${schema.discounts.amount}),0)::int` }).from(schema.discounts).where(and(eq(schema.discounts.tenantId, req.user.tenantId), gte(schema.discounts.createdAt, start)));
    const [waste] = await app.db
      .select({ total: sql<number>`coalesce(sum(-(${schema.stockMovements.quantity})::numeric * ${schema.ingredients.avgCost}),0)::int` })
      .from(schema.stockMovements)
      .innerJoin(schema.ingredients, eq(schema.ingredients.id, schema.stockMovements.ingredientId))
      .where(and(eq(schema.stockMovements.tenantId, req.user.tenantId), eq(schema.stockMovements.type, "merma"), gte(schema.stockMovements.createdAt, start)));
    return {
      total: rows.reduce((s, r) => s + r.n, 0),
      critical: Object.entries(byCategory).filter(([k]) => CRITICAL.has(k)).reduce((s, [, n]) => s + n, 0),
      authorized: rows.reduce((s, r) => s + r.authorized, 0),
      byCategory,
      discounts: disc?.total ?? 0,
      waste: waste?.total ?? 0,
    };
  });
};

export const auditModule: ApiModule = { prefix: "audit", plugin };
