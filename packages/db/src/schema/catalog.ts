import { sql } from "drizzle-orm";
import { boolean, integer, numeric, pgEnum, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { branchId, createdAt, id, tenantId, updatedAt } from "./_shared";

export const stationKindEnum = pgEnum("station_kind", ["cocina", "barra"]);
export const stationOutputEnum = pgEnum("station_output", ["pantalla", "impresora", "ambos"]);

export const stations = pgTable("stations", {
  id: id(),
  tenantId: tenantId(),
  branchId: branchId(),
  name: text("name").notNull(),
  kind: stationKindEnum("kind").notNull(),
  output: stationOutputEnum("output").notNull().default("pantalla"),
  printerFallback: boolean("printer_fallback").notNull().default(true),
  printerAddress: text("printer_address"),
  defaultTargetSec: integer("default_target_sec").notNull().default(900),
});

export const categories = pgTable("categories", {
  id: id(),
  tenantId: tenantId(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const products = pgTable("products", {
  id: id(),
  tenantId: tenantId(),
  categoryId: uuid("category_id").notNull().references(() => categories.id),
  name: text("name").notNull(),
  /** Precio con impuestos incluidos, en centavos. */
  price: integer("price").notNull(),
  iepsPct: numeric("ieps_pct", { precision: 5, scale: 2 }).notNull().default("0"),
  targetPrepSec: integer("target_prep_sec").notNull().default(900),
  photoUrl: text("photo_url"),
  active: boolean("active").notNull().default(true),
  /** Preparado para CFDI 4.0 (NF-06). */
  satProductKey: text("sat_product_key"),
  satUnitKey: text("sat_unit_key"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Disponibilidad por sucursal ("agotado", E2-07). */
export const productAvailability = pgTable(
  "product_availability",
  {
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    branchId: branchId(),
    soldOut: boolean("sold_out").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.productId, t.branchId] })],
);

/** Un producto puede ir a varias estaciones (doc 02 §8.1). */
export const productStations = pgTable(
  "product_stations",
  {
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    stationId: uuid("station_id").notNull().references(() => stations.id),
  },
  (t) => [primaryKey({ columns: [t.productId, t.stationId] })],
);

export const modifierGroups = pgTable("modifier_groups", {
  id: id(),
  tenantId: tenantId(),
  name: text("name").notNull(),
  minSelect: integer("min_select").notNull().default(0),
  maxSelect: integer("max_select").notNull().default(1),
});

export const modifiers = pgTable("modifiers", {
  id: id(),
  groupId: uuid("group_id").notNull().references(() => modifierGroups.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  priceDelta: integer("price_delta").notNull().default(0),
});

export const productModifierGroups = pgTable(
  "product_modifier_groups",
  {
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").notNull().references(() => modifierGroups.id),
  },
  (t) => [primaryKey({ columns: [t.productId, t.groupId] })],
);

export const reasonKindEnum = pgEnum("reason_kind", ["devolucion", "cortesia", "cancelacion", "merma", "descuento"]);
export const reasons = pgTable("reasons", {
  id: id(),
  tenantId: tenantId(),
  kind: reasonKindEnum("kind").notNull(),
  label: text("label").notNull(),
  active: boolean("active").notNull().default(true),
});

export const promoKindEnum = pgEnum("promo_kind", ["dos_por_uno", "porcentaje", "precio_especial", "combo"]);
export const promoStatusEnum = pgEnum("promo_status", ["activa", "pausada", "borrador"]);

/** Reglas de promoción (E4-07). Ver motor en @convivium/domain/promotions. */
export const promotions = pgTable("promotions", {
  id: id(),
  tenantId: tenantId(),
  name: text("name").notNull(),
  kind: promoKindEnum("kind").notNull(),
  value: integer("value").notNull().default(0),
  productIds: uuid("product_ids").array().notNull().default(sql`'{}'::uuid[]`),
  categoryIds: uuid("category_ids").array().notNull().default(sql`'{}'::uuid[]`),
  days: integer("days").array().notNull().default(sql`'{}'::int[]`),
  startTime: text("start_time"),
  endTime: text("end_time"),
  /** Ids de área o "barra". */
  zones: text("zones").array().notNull().default(sql`'{}'::text[]`),
  toleranceMin: integer("tolerance_min").notNull().default(0),
  status: promoStatusEnum("status").notNull().default("borrador"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
