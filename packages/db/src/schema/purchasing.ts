import { sql } from "drizzle-orm";
import { boolean, date, integer, numeric, pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { branchId, createdAt, id, tenantId } from "./_shared";

export const poStatusEnum = pgEnum("po_status", ["borrador", "aprobada", "enviada", "recibida_parcial", "recibida", "cancelada"]);
export const payableStatusEnum = pgEnum("payable_status", ["pendiente", "parcial", "pagada"]);

export const suppliers = pgTable("suppliers", {
  id: id(),
  tenantId: tenantId(),
  name: text("name").notNull(),
  rfc: text("rfc"),
  phone: text("phone"),
  email: text("email"),
  creditDays: integer("credit_days").notNull().default(0),
  deliveryDays: text("delivery_days").array(),
  tradeName: text("trade_name"),
  contactName: text("contact_name"),
  categories: text("categories").array().notNull().default(sql`'{}'::text[]`),
  /** Pedido mínimo en centavos. */
  minOrder: integer("min_order").notNull().default(0),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
});

export const supplierPrices = pgTable("supplier_prices", {
  id: id(),
  supplierId: uuid("supplier_id").notNull().references(() => suppliers.id),
  ingredientId: uuid("ingredient_id").notNull(),
  unitPrice: integer("unit_price").notNull(),
  validFrom: date("valid_from").notNull(),
  /** Orden exacto de captura (varios cambios el mismo día). */
  createdAt: createdAt(),
});

export const purchaseOrders = pgTable("purchase_orders", {
  id: id(),
  tenantId: tenantId(),
  branchId: branchId(),
  folio: text("folio").notNull(),
  /** Consecutivo por sucursal; lo asigna solo la autoridad de la sucursal (su nodo, o la nube si no tiene). */
  seq: integer("seq").notNull(),
  supplierId: uuid("supplier_id").notNull().references(() => suppliers.id),
  status: poStatusEnum("status").notNull().default("borrador"),
  expectedAt: date("expected_at"),
  createdBy: uuid("created_by").notNull(),
  approvedBy: uuid("approved_by"),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("purchase_orders_branch_seq_uq").on(t.branchId, t.seq)]);

export const purchaseOrderLines = pgTable("purchase_order_lines", {
  id: id(),
  purchaseOrderId: uuid("purchase_order_id").notNull().references(() => purchaseOrders.id, { onDelete: "cascade" }),
  ingredientId: uuid("ingredient_id").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  unitPrice: integer("unit_price").notNull(),
});

export const receipts = pgTable("receipts", {
  id: id(),
  tenantId: tenantId(),
  branchId: branchId(),
  purchaseOrderId: uuid("purchase_order_id"),
  supplierId: uuid("supplier_id").notNull(),
  warehouseId: uuid("warehouse_id").notNull(),
  invoiceFolio: text("invoice_folio"),
  cfdiXmlUrl: text("cfdi_xml_url"),
  total: integer("total").notNull(),
  receivedBy: uuid("received_by").notNull(),
  createdAt: createdAt(),
});

export const payables = pgTable("payables", {
  id: id(),
  tenantId: tenantId(),
  supplierId: uuid("supplier_id").notNull(),
  receiptId: uuid("receipt_id"),
  amount: integer("amount").notNull(),
  balance: integer("balance").notNull(),
  dueAt: date("due_at").notNull(),
  status: payableStatusEnum("status").notNull().default("pendiente"),
  createdAt: createdAt(),
});

export const supplierPayments = pgTable("supplier_payments", {
  id: id(),
  tenantId: tenantId(),
  payableId: uuid("payable_id").notNull().references(() => payables.id),
  amount: integer("amount").notNull(),
  method: text("method").notNull(),
  cashSessionId: uuid("cash_session_id"),
  reference: text("reference"),
  createdBy: uuid("created_by").notNull(),
  createdAt: createdAt(),
});
