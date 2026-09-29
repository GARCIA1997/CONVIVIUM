/**
 * Reglas de inventario y recetas (HU E7-03, E7-04, E7-05, E7-06, E7-09).
 * Cantidades siempre en unidad de uso (g, ml, pz). Costos en centavos por unidad de uso (decimales permitidos).
 */

export interface RecipeLineInput {
  ingredientId?: string | null;
  subRecipeId?: string | null;
  quantity: number;
  wastePct: number;
}

export interface RecipeInput {
  id: string;
  yieldQty: number | null;
  lines: RecipeLineInput[];
}

/** Cantidad bruta a descontar considerando la merma de la línea. */
export const grossQty = (l: RecipeLineInput) => l.quantity * (1 + l.wastePct / 100);

/**
 * Explota una receta en insumos base (resuelve subrecetas recursivamente).
 * `factor` multiplica todas las cantidades (p. ej. unidades vendidas).
 */
export function explode(recipe: RecipeInput, recipes: Map<string, RecipeInput>, factor = 1, depth = 0): Map<string, number> {
  if (depth > 5) throw new Error("Subrecetas anidadas demasiado profundo (¿ciclo?)");
  const out = new Map<string, number>();
  for (const l of recipe.lines) {
    const qty = grossQty(l) * factor;
    if (l.ingredientId) out.set(l.ingredientId, (out.get(l.ingredientId) ?? 0) + qty);
    else if (l.subRecipeId) {
      const sub = recipes.get(l.subRecipeId);
      if (!sub) continue;
      const perUnit = qty / (sub.yieldQty || 1);
      for (const [id, q] of explode(sub, recipes, perUnit, depth + 1)) out.set(id, (out.get(id) ?? 0) + q);
    }
  }
  return out;
}

/** Costo teórico en centavos de una receta (por porción, o por lote de rendimiento en subrecetas). */
export function recipeCost(recipe: RecipeInput, recipes: Map<string, RecipeInput>, unitCost: Map<string, number>): number {
  let total = 0;
  for (const [id, q] of explode(recipe, recipes)) total += q * (unitCost.get(id) ?? 0);
  return Math.round(total);
}

/** % de costo sobre precio de venta sin impuestos. */
export function costPct(cost: number, priceWithoutTaxes: number): number {
  return priceWithoutTaxes > 0 ? Math.round((cost / priceWithoutTaxes) * 1000) / 10 : 0;
}

/** Costo promedio ponderado al recibir mercancía. */
export function weightedAvgCost(stockQty: number, avgCost: number, inQty: number, inCost: number): number {
  const total = stockQty + inQty;
  if (total <= 0) return inCost;
  return (Math.max(0, stockQty) * avgCost + inQty * inCost) / total;
}

/** Sugerencia de compra: llevar al máximo si está por debajo del mínimo, en unidades de compra redondeadas hacia arriba. */
export function purchaseSuggestion(stock: number, min: number, max: number, conversion: number): number {
  if (stock >= min) return 0;
  const need = Math.max(0, max - stock);
  return Math.ceil(need / (conversion || 1));
}
