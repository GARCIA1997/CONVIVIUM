import { sql } from "drizzle-orm";
import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { branchId, createdAt, id, tenantId } from "./_shared";

export const checkKindEnum = pgEnum("check_kind", ["mesa", "barra", "llevar"]);
export const checkStatusEnum = pgEnum("check_status", ["abierta", "pidio_cuenta", "cobrada", "cancelada"]);
export const itemStateEnum = pgEnum("item_state", ["pendiente", "enviado", "en_preparacion", "listo", "entregado", "cancelado", "devuelto"]);
export const courseEnum = pgEnum("course", ["entrada", "fuerte", "postre", "bebida", "sin_tiempo"]);
export const priorityEnum = pgEnum("item_priority", ["normal", "rehacer"]);

/** Cuenta (mesa o barra). */
export const checks = pgTable("checks", {
  id: id(),
  tenantId: tenantId(),
  branchId: branchId(),
  kind: checkKindEnum("kind").notNull(),
  tableId: uuid("table_id"),
  /** Mesas unidas a la principal para un grupo (E3-10). */
  joinedTableIds: uuid("joined_table_ids").array().notNull().default(sql`'{}'::uuid[]`),
  name: text("name"),
  guests: integer("guests"),
  waiterId: uuid("waiter_id").notNull(),
  status: checkStatusEnum("status").notNull().default("abierta"),
  /** Preparado para CFDI (NF-06). */
  invoiceStatus: text("invoice_status"),
  openedAt: createdAt(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  // ── Para llevar ──
  /** Folio del día por sucursal (L-001…). */
  folio: integer("folio"),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  pickupAt: timestamp("pickup_at", { withTimezone: true }),
  /** mostrador | telefono | whatsapp */
  channel: text("channel"),
  disposables: boolean("disposables"),
  note: text("note"),
  /** Entregado al cliente. */
  handedOverAt: timestamp("handed_over_at", { withTimezone: true }),
});

export const orderItems = pgTable("order_items", {
  id: id(),
  tenantId: tenantId(),
  branchId: branchId(),
  checkId: uuid("check_id").notNull().references(() => checks.id),
  productId: uuid("product_id").notNull(),
  productName: text("product_name").notNull(),
  stationId: uuid("station_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: integer("unit_price").notNull(),
  modifiers: jsonb("modifiers").$type<{ id: string; name: string; priceDelta: number }[]>().notNull().default([]),
  note: text("note"),
  guest: integer("guest"),
  course: courseEnum("course").notNull().default("sin_tiempo"),
  state: itemStateEnum("state").notNull().default("pendiente"),
  priority: priorityEnum("priority").notNull().default("normal"),
  targetPrepSec: integer("target_prep_sec").notNull(),
  createdBy: uuid("created_by").notNull(),
  createdAt: createdAt(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  readyAt: timestamp("ready_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  readyBy: uuid("ready_by"),
  /** Descuento total del renglón por promoción (centavos) y la regla que lo dio. */
  promoDiscount: integer("promo_discount").notNull().default(0),
  promotionId: uuid("promotion_id"),
});

export const approvalKindEnum = pgEnum("approval_kind", ["cancelacion", "devolucion_retiro", "cortesia", "descuento", "reapertura"]);
export const approvalStatusEnum = pgEnum("approval_status", ["pendiente", "aprobada", "rechazada"]);

export const approvals = pgTable("approvals", {
  id: id(),
  tenantId: tenantId(),
  branchId: branchId(),
  kind: approvalKindEnum("kind").notNull(),
  status: approvalStatusEnum("status").notNull().default("pendiente"),
  checkId: uuid("check_id").notNull(),
  itemId: uuid("item_id"),
  amount: integer("amount").notNull().default(0),
  pct: integer("pct"),
  reasonId: uuid("reason_id"),
  note: text("note"),
  payload: jsonb("payload"),
  requestedBy: uuid("requested_by").notNull(),
  resolvedBy: uuid("resolved_by"),
  createdAt: createdAt(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const discounts = pgTable("discounts", {
  id: id(),
  tenantId: tenantId(),
  checkId: uuid("check_id").notNull().references(() => checks.id),
  itemId: uuid("item_id"),
  type: text("type").notNull(),
  amount: integer("amount").notNull(),
  reasonId: uuid("reason_id"),
  appliedBy: uuid("applied_by").notNull(),
  authorizedBy: uuid("authorized_by"),
  createdAt: createdAt(),
});
