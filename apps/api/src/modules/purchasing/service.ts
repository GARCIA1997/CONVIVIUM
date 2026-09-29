import { and, desc, eq, inArray, schema, sql, type Db } from "@convivium/db";
import type { FastifyInstance } from "fastify";
import { recordEvent } from "../../lib/audit.js";
import type { Principal } from "../../plugins/auth.js";
import { AppError, conflict, notFound } from "../../plugins/errors.js";
import { InventoryService } from "../inventory/service.js";

const num = (v: string | number | null | undefined) => Number(v ?? 0);
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Compras y cuentas por pagar (E8). Montos en centavos; cantidades de compra en unidad de compra. */
export class PurchasingService {
  private inventory: InventoryService;
  constructor(private app: FastifyInstance, private db: Db = app.db) {
    this.inventory = new InventoryService(app);
  }

  // ---------- Proveedores (E8-01) ----------

  async suppliers(who: Principal) {
    const [rows, prices, payables] = await Promise.all([
      this.db.select().from(schema.suppliers).where(eq(schema.suppliers.tenantId, who.tenantId)),
      this.db.select({ supplierId: schema.supplierPrices.supplierId, ingredientId: schema.supplierPrices.ingredientId, unitPrice: schema.supplierPrices.unitPrice, name: schema.ingredients.name })
        .from(schema.supplierPrices).innerJoin(schema.ingredients, eq(schema.ingredients.id, schema.supplierPrices.ingredientId)),
      this.db.select().from(schema.payables).where(eq(schema.payables.tenantId, who.tenantId)),
    ]);
    return rows.map((s) => ({
      ...s,
      supplies: prices.filter((p) => p.supplierId === s.id).map((p) => ({ ingredientId: p.ingredientId, name: p.name, unitPrice: p.unitPrice })),
      balance: payables.filter((p) => p.supplierId === s.id).reduce((a, p) => a + p.balance, 0),
    }));
  }

  async upsertSupplier(who: Principal, body: { name: string; rfc: string | null; phone: string | null; email: string | null; creditDays: number }, id?: string) {
    if (id) {
      const [r] = await this.db.update(schema.suppliers).set(body).where(and(eq(schema.suppliers.id, id), eq(schema.suppliers.tenantId, who.tenantId))).returning();
      if (!r) throw notFound("Proveedor");
      return r;
    }
    const [r] = await this.db.insert(schema.suppliers).values({ ...body, tenantId: who.tenantId }).returning();
    await recordEvent(this.db, who, { type: "supplier.created", entity: "supplier", entityId: r!.id, data: body });
    return r!;
  }

  // ---------- Órdenes de compra (E8-02) ----------

  private async nextFolio(tenantId: string) {
    const [r] = await this.db.select({ n: sql<number>`count(*)::int` }).from(schema.purchaseOrders).where(eq(schema.purchaseOrders.tenantId, tenantId));
    return `OC-${String((r?.n ?? 0) + 1).padStart(4, "0")}`;
  }

  async createOrder(who: Principal, b: { supplierId: string; warehouseId: string; expectedAt?: string; lines: { ingredientId: string; quantity: number; unitPrice: number }[] }) {
    const [po] = await this.db.insert(schema.purchaseOrders).values({ tenantId: who.tenantId, branchId: who.branchId, folio: await this.nextFolio(who.tenantId), supplierId: b.supplierId, expectedAt: b.expectedAt, createdBy: who.userId }).returning();
    await this.db.insert(schema.purchaseOrderLines).values(b.lines.map((l) => ({ purchaseOrderId: po!.id, ingredientId: l.ingredientId, quantity: String(l.quantity), unitPrice: l.unitPrice })));
    await recordEvent(this.db, who, { type: "po.created", entity: "purchase_order", entityId: po!.id, data: b });
    return this.order(who, po!.id);
  }

  async order(who: Principal, id: string) {
    const [po] = await this.db.select().from(schema.purchaseOrders).where(and(eq(schema.purchaseOrders.id, id), eq(schema.purchaseOrders.tenantId, who.tenantId)));
    if (!po) throw notFound("Orden de compra");
    const [lines, [supplier]] = await Promise.all([
      this.db.select({ id: schema.purchaseOrderLines.id, ingredientId: schema.purchaseOrderLines.ingredientId, quantity: schema.purchaseOrderLines.quantity, unitPrice: schema.purchaseOrderLines.unitPrice, name: schema.ingredients.name, purchaseUnit: schema.ingredients.purchaseUnit })
        .from(schema.purchaseOrderLines).innerJoin(schema.ingredients, eq(schema.ingredients.id, schema.purchaseOrderLines.ingredientId)).where(eq(schema.purchaseOrderLines.purchaseOrderId, id)),
      this.db.select().from(schema.suppliers).where(eq(schema.suppliers.id, po.supplierId)),
    ]);
    const ls = lines.map((l) => ({ ...l, quantity: num(l.quantity), amount: Math.round(num(l.quantity) * l.unitPrice) }));
    return { ...po, createdAt: po.createdAt.toISOString(), supplier: supplier!, lines: ls, total: ls.reduce((s, l) => s + l.amount, 0) };
  }

  async orders(who: Principal, status?: string) {
    const rows = await this.db.select().from(schema.purchaseOrders).where(and(eq(schema.purchaseOrders.branchId, who.branchId), ...(status ? [eq(schema.purchaseOrders.status, status as never)] : []))).orderBy(desc(schema.purchaseOrders.createdAt)).limit(50);
    return Promise.all(rows.map((r) => this.order(who, r.id)));
  }

  /** El gerente aprueba la OC que propuso el almacenista (separación de funciones). */
  async approveOrder(who: Principal, id: string) {
    const po = await this.order(who, id);
    if (po.status !== "borrador") throw conflict("bad_status", "Solo se aprueban órdenes en borrador");
    await this.db.update(schema.purchaseOrders).set({ status: "aprobada", approvedBy: who.userId }).where(eq(schema.purchaseOrders.id, id));
    await recordEvent(this.db, who, { type: "po.approved", entity: "purchase_order", entityId: id, data: { total: po.total }, authorizedBy: who.userId });
    return this.order(who, id);
  }

  /** Texto para enviar la OC por WhatsApp/correo (sin API de WhatsApp: enlace para compartir). */
  async orderShareText(who: Principal, id: string) {
    const po = await this.order(who, id);
    if (po.status === "borrador") throw conflict("not_approved", "La orden debe estar aprobada");
    const money = (c: number) => `$${(c / 100).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
    const text = [`*Orden de compra ${po.folio}*`, `Proveedor: ${po.supplier.name}`, po.expectedAt ? `Entrega: ${po.expectedAt}` : "", "", ...po.lines.map((l) => `• ${l.quantity} × ${l.purchaseUnit} ${l.name} — ${money(l.amount)}`), "", `Total: ${money(po.total)} MXN`].filter((x) => x !== undefined).join("\n");
    if (po.status === "aprobada") await this.db.update(schema.purchaseOrders).set({ status: "enviada" }).where(eq(schema.purchaseOrders.id, id));
    const phone = (po.supplier.phone ?? "").replace(/\D/g, "");
    return { text, whatsappUrl: `https://wa.me/${phone ? `52${phone.slice(-10)}` : ""}?text=${encodeURIComponent(text)}`, mailto: `mailto:${po.supplier.email ?? ""}?subject=${encodeURIComponent(`Orden de compra ${po.folio}`)}&body=${encodeURIComponent(text)}` };
  }

  // ---------- Recepción (E8-03) y CxP (E8-05) ----------

  async receive(who: Principal, b: { purchaseOrderId?: string; supplierId: string; warehouseId: string; invoiceFolio?: string; createPayable: boolean; lines: { ingredientId: string; quantity: number; unitPrice: number; lot?: string; expiresAt?: string }[] }) {
    const lines = b.lines.filter((l) => l.quantity > 0);
    if (!lines.length) throw conflict("empty_receipt", "No hay cantidades recibidas");
    const total = Math.round(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0));
    const [rec] = await this.db.insert(schema.receipts).values({ tenantId: who.tenantId, branchId: who.branchId, purchaseOrderId: b.purchaseOrderId, supplierId: b.supplierId, warehouseId: b.warehouseId, invoiceFolio: b.invoiceFolio, total, receivedBy: who.userId }).returning();
    for (const l of lines) await this.inventory.receive(who, b.warehouseId, l.ingredientId, l.quantity, l.unitPrice, rec!.id);

    // Historial de precios del proveedor (precio real recibido).
    for (const l of lines) await this.db.insert(schema.supplierPrices).values({ supplierId: b.supplierId, ingredientId: l.ingredientId, unitPrice: l.unitPrice, validFrom: isoDate(new Date()) });

    let payable = null;
    if (b.createPayable) {
      const [sup] = await this.db.select().from(schema.suppliers).where(eq(schema.suppliers.id, b.supplierId));
      const due = new Date(Date.now() + (sup?.creditDays ?? 0) * 864e5);
      [payable] = await this.db.insert(schema.payables).values({ tenantId: who.tenantId, supplierId: b.supplierId, receiptId: rec!.id, amount: total, balance: total, dueAt: isoDate(due) }).returning();
    }
    if (b.purchaseOrderId) {
      const po = await this.order(who, b.purchaseOrderId);
      const complete = po.lines.every((pl) => lines.some((l) => l.ingredientId === pl.ingredientId && l.quantity >= pl.quantity));
      await this.db.update(schema.purchaseOrders).set({ status: complete ? "recibida" : "recibida_parcial" }).where(eq(schema.purchaseOrders.id, b.purchaseOrderId));
    }
    await recordEvent(this.db, who, { type: "receipt.created", entity: "receipt", entityId: rec!.id, data: { ...b, total } });
    return { receiptId: rec!.id, total, payable };
  }

  /** E8-04 · Lee un CFDI 4.0 de proveedor: emisor, folio, total y conceptos; intenta ligar conceptos a insumos por nombre. */
  async parseCfdi(who: Principal, xml: string) {
    const attr = (tag: string, name: string) => xml.match(new RegExp(`<(?:cfdi:)?${tag}\\b[^>]*\\s${name}="([^"]*)"`, "i"))?.[1] ?? null;
    const conceptos = [...xml.matchAll(/<(?:cfdi:)?Concepto\b([^>]*)\/?>/gi)].map((m) => {
      const a = (n: string) => m[1]!.match(new RegExp(`\\s${n}="([^"]*)"`, "i"))?.[1] ?? "";
      return { description: a("Descripcion"), quantity: Number(a("Cantidad")), unit: a("Unidad") || a("ClaveUnidad"), unitPrice: Math.round(Number(a("ValorUnitario")) * 100), amount: Math.round(Number(a("Importe")) * 100) };
    });
    if (!conceptos.length) throw new AppError(400, "bad_cfdi", "El archivo no parece un CFDI válido");
    const rfc = attr("Emisor", "Rfc");
    const [supplier] = rfc ? await this.db.select().from(schema.suppliers).where(and(eq(schema.suppliers.tenantId, who.tenantId), eq(schema.suppliers.rfc, rfc))) : [];
    const ings = await this.db.select().from(schema.ingredients).where(eq(schema.ingredients.tenantId, who.tenantId));
    const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    return {
      emisor: { rfc, name: attr("Emisor", "Nombre") },
      supplierId: supplier?.id ?? null,
      folio: [attr("Comprobante", "Serie"), attr("Comprobante", "Folio")].filter(Boolean).join("-") || null,
      uuid: attr("TimbreFiscalDigital", "UUID"),
      total: Math.round(Number(attr("Comprobante", "Total") ?? 0) * 100),
      conceptos: conceptos.map((c) => ({ ...c, ingredientId: ings.find((i) => norm(c.description).includes(norm(i.name).split(" ")[0]!))?.id ?? null })),
    };
  }

  async payables(who: Principal) {
    const rows = await this.db
      .select({ p: schema.payables, supplier: schema.suppliers.name, folio: schema.receipts.invoiceFolio, receivedAt: schema.receipts.createdAt })
      .from(schema.payables)
      .innerJoin(schema.suppliers, eq(schema.suppliers.id, schema.payables.supplierId))
      .leftJoin(schema.receipts, eq(schema.receipts.id, schema.payables.receiptId))
      .where(eq(schema.payables.tenantId, who.tenantId))
      .orderBy(schema.payables.dueAt);
    const today = isoDate(new Date());
    const ids = rows.map((r) => r.p.id);
    const payments = ids.length ? await this.db.select().from(schema.supplierPayments).where(inArray(schema.supplierPayments.payableId, ids)) : [];
    return rows.map(({ p, supplier, folio, receivedAt }) => {
      const days = Math.round((Date.parse(p.dueAt) - Date.parse(today)) / 864e5);
      const state = p.status === "pagada" ? "pagada" : days < 0 ? "vencida" : days <= 7 ? "por_vencer" : p.status === "parcial" ? "parcial" : "al_corriente";
      return {
        id: p.id, supplierId: p.supplierId, supplier, folio, receivedAt: receivedAt?.toISOString() ?? null, dueAt: p.dueAt, amount: p.amount, balance: p.balance, status: p.status, state, daysToDue: days,
        payments: payments.filter((x) => x.payableId === p.id).map((x) => ({ amount: x.amount, method: x.method, reference: x.reference, at: x.createdAt.toISOString() })),
      };
    });
  }

  /** E8-06 · Pago parcial o total; en efectivo sale de la caja abierta del usuario y afecta su corte. */
  async pay(who: Principal, b: { payableId: string; amount: number; method: "transferencia" | "efectivo_caja" | "cheque"; reference?: string }) {
    const [p] = await this.db.select().from(schema.payables).where(and(eq(schema.payables.id, b.payableId), eq(schema.payables.tenantId, who.tenantId)));
    if (!p) throw notFound("Cuenta por pagar");
    if (b.amount <= 0 || b.amount > p.balance) throw conflict("bad_amount", "El monto excede el saldo pendiente");
    let cashSessionId: string | null = null;
    if (b.method === "efectivo_caja") {
      const [s] = await this.db.select().from(schema.cashSessions).where(and(eq(schema.cashSessions.branchId, who.branchId), eq(schema.cashSessions.cashierId, who.userId), sql`${schema.cashSessions.closedAt} is null`));
      if (!s) throw conflict("no_session", "Para pagar en efectivo necesitas una caja abierta");
      cashSessionId = s.id;
    }
    await this.db.insert(schema.supplierPayments).values({ tenantId: who.tenantId, payableId: p.id, amount: b.amount, method: b.method, cashSessionId, reference: b.reference, createdBy: who.userId });
    const balance = p.balance - b.amount;
    await this.db.update(schema.payables).set({ balance, status: balance === 0 ? "pagada" : "parcial" }).where(eq(schema.payables.id, p.id));
    await recordEvent(this.db, who, { type: "payable.payment", entity: "payable", entityId: p.id, data: b });
    return { balance, status: balance === 0 ? "pagada" : "parcial" };
  }
}
