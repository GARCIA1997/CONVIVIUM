import { z } from "zod";
import { Cents, Id } from "./common.js";

export const Ingredient = z.object({
  id: Id,
  name: z.string(),
  purchaseUnit: z.string(),
  useUnit: z.enum(["g", "ml", "pz"]),
  conversion: z.number().positive().describe("Unidades de uso por unidad de compra"),
  minStock: z.number(),
  maxStock: z.number(),
  avgCost: Cents.describe("Costo promedio por unidad de uso x 100"),
  critical: z.boolean(),
  lotTracking: z.boolean(),
});
export const RecipeLine = z.object({
  ingredientId: Id.optional(),
  subRecipeId: Id.optional(),
  quantity: z.number().positive(),
  wastePct: z.number().min(0).max(100).default(0),
});
export const Recipe = z.object({
  id: Id,
  productId: Id.nullable(),
  modifierId: Id.nullable(),
  isSubRecipe: z.boolean(),
  yieldQty: z.number().positive().nullable(),
  lines: z.array(RecipeLine),
  steps: z.array(z.string()),
});
export const StockMovementBody = z.object({
  type: z.enum(["merma", "traspaso", "ajuste", "produccion"]),
  ingredientId: Id,
  quantity: z.number(),
  fromWarehouseId: Id.optional(),
  toWarehouseId: Id.optional(),
  reasonId: Id.optional(),
});
export const PhysicalCountBody = z.object({
  warehouseId: Id,
  lines: z.array(z.object({ ingredientId: Id, counted: z.number().min(0) })),
});
