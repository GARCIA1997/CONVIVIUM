import { z } from "zod";
import { Id } from "./common.js";

export const UseUnit = z.enum(["g", "ml", "pz"]);

export const IngredientUpsert = z.object({
  name: z.string().min(1),
  category: z.string().nullable().default(null),
  purchaseUnit: z.string().min(1),
  useUnit: UseUnit,
  conversion: z.number().positive().describe("Unidades de uso por unidad de compra"),
  minStock: z.number().min(0),
  maxStock: z.number().min(0),
  critical: z.boolean().default(false),
  lotTracking: z.boolean().default(false),
});

export const IngredientView = IngredientUpsert.extend({
  id: Id,
  avgCost: z.number().describe("Centavos por unidad de uso"),
  stock: z.number().describe("Existencia en el almacén filtrado (o total)"),
  stockByWarehouse: z.record(z.string(), z.number()),
  belowMin: z.boolean(),
  affectsProducts: z.number().int(),
});

export const RecipeLine = z.object({
  ingredientId: Id.nullable().default(null),
  subRecipeId: Id.nullable().default(null),
  quantity: z.number().positive(),
  wastePct: z.number().min(0).max(100).default(0),
});

export const RecipeUpsert = z.object({
  name: z.string().min(1),
  productId: Id.nullable().default(null),
  modifierId: Id.nullable().default(null),
  isSubRecipe: z.boolean().default(false),
  yieldQty: z.number().positive().nullable().default(null),
  steps: z.array(z.string()).default([]),
  lines: z.array(RecipeLine).min(1),
});

export const StockMovementBody = z.object({
  type: z.enum(["merma", "traspaso", "ajuste"]),
  ingredientId: Id,
  quantity: z.number().positive(),
  warehouseId: Id,
  toWarehouseId: Id.optional(),
  /** Para ajuste: signo del movimiento. */
  direction: z.enum(["entrada", "salida"]).default("salida"),
  reasonId: Id.optional(),
});

export const ProductionBody = z.object({ recipeId: Id, batches: z.number().positive(), warehouseId: Id });

export const PhysicalCountBody = z.object({
  warehouseId: Id,
  lines: z.array(z.object({ ingredientId: Id, counted: z.number().min(0) })).min(1),
});
