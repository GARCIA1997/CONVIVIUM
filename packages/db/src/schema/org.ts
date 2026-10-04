import { boolean, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { branchId, createdAt, id, tenantId, updatedAt } from "./_shared";

export const roleEnum = pgEnum("role", ["dueno", "gerente", "capitan", "mesero", "cajero", "cocina", "barra", "almacenista"]);
export const deviceKindEnum = pgEnum("device_kind", ["mesero", "kds_tv", "estacion_tactil", "caja", "admin", "nodo"]);

export const tenants = pgTable("tenants", {
  id: id(),
  name: text("name").notNull(),
  rfc: text("rfc"),
  /** Topes de descuento por rol configurables (E1-05). */
  discountCaps: jsonb("discount_caps").$type<Record<string, number | null>>(),
  /** Permisos adicionales/denegados por rol (E1-07). */
  rolePermissions: jsonb("role_permissions").$type<Record<string, { grant?: string[]; deny?: string[] }>>(),
  /** Identidad del restaurante para menú digital, PDF y QR (ver contracts/branding). Nulo = valores por omisión. */
  branding: jsonb("branding").$type<Record<string, unknown>>(),
  createdAt: createdAt(),
});

export const branches = pgTable("branches", {
  id: id(),
  tenantId: tenantId(),
  name: text("name").notNull(),
  /** Clave corta de la sucursal (2–6 letras/dígitos), única por restaurante. Va en los folios: OC-CEN-0001. */
  code: text("code").notNull(),
  timezone: text("timezone").notNull().default("America/Mexico_City"),
  ivaPct: integer("iva_pct").notNull().default(16),
  usdRate: integer("usd_rate_cents"),
  /** Minutos sin actividad antes de regresar a la pantalla de PIN, por tipo de app (E1-03). */
  idleMinutesMesero: integer("idle_minutes_mesero").notNull().default(5),
  idleMinutesCaja: integer("idle_minutes_caja").notNull().default(30),
  idleMinutesEstacion: integer("idle_minutes_estacion").notNull().default(720),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("branches_tenant_code_uq").on(t.tenantId, t.code)]);

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
