import { boolean, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { branchId, createdAt, id, tenantId, updatedAt } from "./_shared";

export const roleEnum = pgEnum("role", ["dueno", "gerente", "capitan", "mesero", "cajero", "cocina", "barra", "almacenista"]);
export const deviceKindEnum = pgEnum("device_kind", ["mesero", "kds_tv", "estacion_tactil", "caja", "admin", "nodo"]);

export const tenants = pgTable("tenants", {
  id: id(),
  name: text("name").notNull(),
  rfc: text("rfc"),
  /** Topes de descuento por rol configurables (E1-05). */
  discountCaps: jsonb("discount_caps").$type<Record<string, number | null>>(),
  createdAt: createdAt(),
});

export const branches = pgTable("branches", {
  id: id(),
  tenantId: tenantId(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("America/Mexico_City"),
  ivaPct: integer("iva_pct").notNull().default(16),
  usdRate: integer("usd_rate_cents"),
  createdAt: createdAt(),
});

export const users = pgTable("users", {
  id: id(),
  tenantId: tenantId(),
  name: text("name").notNull(),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  pinHash: text("pin_hash"),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Un usuario puede tener varios roles, por sucursal (E1-08). */
export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id").notNull().references(() => branches.id),
    role: roleEnum("role").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.branchId, t.role] })],
);

export const devices = pgTable("devices", {
  id: id(),
  tenantId: tenantId(),
  branchId: branchId(),
  name: text("name").notNull(),
  kind: deviceKindEnum("kind").notNull(),
  tokenHash: text("token_hash").notNull(),
  stationId: uuid("station_id"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const pairingCodes = pgTable("pairing_codes", {
  code: text("code").primaryKey(),
  tenantId: tenantId(),
  branchId: branchId(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
