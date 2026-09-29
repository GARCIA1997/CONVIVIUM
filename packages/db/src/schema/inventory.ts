import { boolean, date, integer, numeric, pgEnum, pgTable, real, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { branchId, createdAt, id, tenantId } from "./_shared";

export const useUnitEnum = pgEnum("use_unit", ["g", "ml", "pz"]);
export const movementTypeEnum = pgEnum("movement_type", ["venta", "merma", "traspaso", "ajuste", "produccion", "recepcion"]);

export const warehouses = pgTable("warehouses", {
  id: id(),
  tenantId: tenantId(),
  branchId: branchId(),
  name: text("name").notNull(),
});

export const ingredients = pgTable("ingredients", {
  id: id(),
  tenantId: tenantId(),
  name: text("name").notNull(),
  purchaseUnit: text("purchase_unit").notNull(),
  useUnit: useUnitEnum("use_unit").notNull(),
  conversion: numeric("conversion", { precision: 12, scale: 4 }).notNull(),
  minStock: numeric("min_stock", { precision: 12, scale: 3 }).notNull().default("0"),
  maxStock: numeric("max_stock", { precision: 12, scale: 3 }).notNull().default("0"),
  /** Costo promedio en centavos por unidad de uso (admite decimales: 0.52 ¢/ml). */
  avgCost: real("avg_cost").notNull().default(0),
  category: text("category"),
  critical: boolean("critical").notNull().default(false),
  lotTracking: boolean("lot_tracking").notNull().default(false),
});

export const stock = pgTable(
  "stock",
  {
    id: id(),
    tenantId: tenantId(),
    warehouseId: uuid("warehouse_id").notNull().references(() => warehouses.id),
    ingredientId: uuid("ingredient_id").notNull().references(() => ingredients.id),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull().default("0"),
  },
  (t) => [unique("stock_warehouse_ingredient").on(t.warehouseId, t.ingredientId)],
);

export const recipes = pgTable("recipes", {
  id: id(),
  tenantId: tenantId(),
  productId: uuid("product_id"),
  modifierId: uuid("modifier_id"),
  isSubRecipe: boolean("is_sub_recipe").notNull().default(false),
  name: text("name").notNull(),
  yieldQty: numeric("yield_qty", { precision: 12, scale: 3 }),
  steps: text("steps").array().notNull().default([]),
  version: integer("version").notNull().default(1),
});

export const recipeLines = pgTable("recipe_lines", {
  id: id(),
  recipeId: uuid("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
  ingredientId: uuid("ingredient_id"),
  subRecipeId: uuid("sub_recipe_id"),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  wastePct: numeric("waste_pct", { precision: 5, scale: 2 }).notNull().default("0"),
});

export const stockMovements = pgTable("stock_movements", {
  id: id(),
  tenantId: tenantId(),
  branchId: branchId(),
  type: movementTypeEnum("type").notNull(),
  ingredientId: uuid("ingredient_id").notNull(),
  warehouseId: uuid("warehouse_id").notNull(),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  unitCost: real("unit_cost"),
  referenceId: uuid("reference_id"),
  reasonId: uuid("reason_id"),
  lot: text("lot"),
  expiresAt: date("expires_at"),
  createdBy: uuid("created_by").notNull(),
  createdAt: createdAt(),
});

export const countStatusEnum = pgEnum("count_status", ["borrador", "pendiente_aprobacion", "aprobado", "rechazado"]);

/** Conteo físico (E7-09); los ajustes los aprueba el gerente (separación de funciones). */
export const inventoryCounts = pgTable("inventory_counts", {
  id: id(),
  tenantId: tenantId(),
  branchId: branchId(),
  warehouseId: uuid("warehouse_id").notNull().references(() => warehouses.id),
  status: countStatusEnum("status").notNull().default("pendiente_aprobacion"),
  countedBy: uuid("counted_by").notNull(),
  approvedBy: uuid("approved_by"),
  createdAt: createdAt(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
});

export const inventoryCountLines = pgTable("inventory_count_lines", {
  id: id(),
  countId: uuid("count_id").notNull().references(() => inventoryCounts.id, { onDelete: "cascade" }),
  ingredientId: uuid("ingredient_id").notNull(),
  theoretical: numeric("theoretical", { precision: 14, scale: 3 }).notNull(),
  counted: numeric("counted", { precision: 14, scale: 3 }).notNull(),
  unitCost: real("unit_cost").notNull().default(0),
});
