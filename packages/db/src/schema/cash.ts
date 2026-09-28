import { integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { branchId, createdAt, id, tenantId } from "./_shared";

export const paymentMethodEnum = pgEnum("payment_method", ["efectivo_mxn", "efectivo_usd", "tarjeta", "transferencia", "vales"]);

export const cashSessions = pgTable("cash_sessions", {
  id: id(),
  tenantId: tenantId(),
  branchId: branchId(),
  registerId: uuid("register_id").notNull(),
  cashierId: uuid("cashier_id").notNull(),
  openingFloat: integer("opening_float").notNull(),
  openedAt: createdAt(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  closedBy: uuid("closed_by"),
});

export const payments = pgTable("payments", {
  id: id(),
  tenantId: tenantId(),
  checkId: uuid("check_id").notNull(),
  cashSessionId: uuid("cash_session_id").notNull(),
  method: paymentMethodEnum("method").notNull(),
  amount: integer("amount").notNull(),
  exchangeRate: integer("exchange_rate"),
  reference: text("reference"),
  createdAt: createdAt(),
});

export const tips = pgTable("tips", {
  id: id(),
  tenantId: tenantId(),
  checkId: uuid("check_id").notNull(),
  waiterId: uuid("waiter_id").notNull(),
  method: paymentMethodEnum("method").notNull(),
  amount: integer("amount").notNull(),
  createdAt: createdAt(),
});

export const cashMovements = pgTable("cash_movements", {
  id: id(),
  tenantId: tenantId(),
  cashSessionId: uuid("cash_session_id").notNull(),
  type: text("type").notNull(),
  amount: integer("amount").notNull(),
  reason: text("reason").notNull(),
  createdBy: uuid("created_by").notNull(),
  createdAt: createdAt(),
});

export const cashCounts = pgTable("cash_counts", {
  id: id(),
  tenantId: tenantId(),
  cashSessionId: uuid("cash_session_id").notNull(),
  kind: text("kind").notNull(),
  expected: jsonb("expected").notNull(),
  counted: jsonb("counted").notNull(),
  createdBy: uuid("created_by").notNull(),
  createdAt: createdAt(),
});
