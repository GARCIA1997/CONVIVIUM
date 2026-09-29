import { client } from "@convivium/app-shell";
export type { Ingredient, Warehouse, RecipeDetail, RecipeSummary, InventoryCount } from "@convivium/api-client";

/** Acceso a inventario para las pantallas de administración. */
export const InventoryApi = client.inventory;
