import { describe, expect, it } from "vitest";
import { costPct, explode, purchaseSuggestion, recipeCost, weightedAvgCost, type RecipeInput } from "../src/index.js";

const jarabe: RecipeInput = { id: "jarabe", yieldQty: 1000, lines: [{ ingredientId: "tamarindo", quantity: 400, wastePct: 0 }, { ingredientId: "azucar", quantity: 300, wastePct: 0 }] };
const margarita: RecipeInput = {
  id: "marg",
  yieldQty: null,
  lines: [
    { ingredientId: "tequila", quantity: 45, wastePct: 0 },
    { subRecipeId: "jarabe", quantity: 30, wastePct: 0 },
    { ingredientId: "limon", quantity: 20, wastePct: 10 },
  ],
};
const recipes = new Map([["jarabe", jarabe], ["marg", margarita]]);

describe("recetas", () => {
  it("explota subrecetas proporcionalmente al rendimiento", () => {
    const m = explode(margarita, recipes, 2);
    expect(m.get("tequila")).toBe(90);
    expect(m.get("tamarindo")).toBeCloseTo(24); // 30 ml de 1000 ml → 3% de 400 g, ×2
    expect(m.get("limon")).toBeCloseTo(44); // 20 ml + 10% merma, ×2
  });
  it("costo teórico", () => {
    const cost = recipeCost(margarita, recipes, new Map([["tequila", 52], ["tamarindo", 8], ["azucar", 2], ["limon", 4]]));
    // 45×52 + 30×(0.4×8+0.3×2) + 22×4 = 2340 + 114 + 88
    expect(cost).toBe(2542);
    expect(costPct(2542, 11379)).toBe(22.3);
  });
});

describe("costos y compras", () => {
  it("costo promedio ponderado", () => {
    expect(weightedAvgCost(10, 100, 10, 200)).toBe(150);
    expect(weightedAvgCost(-5, 100, 10, 200)).toBe(200 * 10 / 5);
  });
  it("sugerencia de compra en unidades de compra", () => {
    expect(purchaseSuggestion(2000, 5000, 12000, 1000)).toBe(10);
    expect(purchaseSuggestion(6000, 5000, 12000, 1000)).toBe(0);
  });
});
