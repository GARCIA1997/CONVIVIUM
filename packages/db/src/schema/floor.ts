import { sql } from "drizzle-orm";
import { boolean, integer, pgEnum, pgTable, real, text, uuid } from "drizzle-orm/pg-core";
import { branchId, id, tenantId } from "./_shared";

export const tableShapeEnum = pgEnum("table_shape", ["redonda", "cuadrada", "rectangular", "periquera"]);

export const areas = pgTable("areas", {
  id: id(),
  tenantId: tenantId(),
  branchId: branchId(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const tables = pgTable("tables", {
  id: id(),
  tenantId: tenantId(),
  branchId: branchId(),
  areaId: uuid("area_id").notNull().references(() => areas.id),
  label: text("label").notNull(),
  capacity: integer("capacity").notNull().default(4),
  shape: tableShapeEnum("shape").notNull().default("cuadrada"),
  x: real("x").notNull().default(0),
  y: real("y").notNull().default(0),
  active: boolean("active").notNull().default(true),
  /** Grados (0, 90, 180, 270) — E3-10. */
  rotation: integer("rotation").notNull().default(0),
  /** Mesas con las que puede unirse para un grupo grande (se abre una sola cuenta). */
  mergeableWith: uuid("mergeable_with").array().notNull().default(sql`'{}'::uuid[]`),
  /** Mesero asignado por defecto (sección). */
  assignedUserId: uuid("assigned_user_id"),
});

export const fixtureKindEnum = pgEnum("fixture_kind", ["muro", "barra", "puerta", "estacion_servicio", "ventanal", "cocina"]);

/** Elementos fijos del plano: muros, puertas, barra, estaciones de servicio… (E3-10). */
export const floorFixtures = pgTable("floor_fixtures", {
  id: id(),
  tenantId: tenantId(),
  branchId: branchId(),
  areaId: uuid("area_id").notNull().references(() => areas.id),
  kind: fixtureKindEnum("kind").notNull(),
  label: text("label").notNull().default(""),
  x: real("x").notNull().default(0),
  y: real("y").notNull().default(0),
  w: real("w").notNull().default(120),
  h: real("h").notNull().default(16),
  rotation: integer("rotation").notNull().default(0),
});
