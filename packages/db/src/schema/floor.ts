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
});
