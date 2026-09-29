/**
 * Ingeniería de menú (HU E9-05), método Kasavana–Smith.
 * - Popularidad alta: unidades ≥ 70 % del promedio por platillo.
 * - Margen alto: margen de contribución unitario ≥ promedio ponderado por ventas.
 */
export type MenuClass = "estrella" | "vaca" | "incognita" | "perro";

export interface MenuItemStats {
  productId: string;
  name: string;
  category: string;
  units: number;
  /** Venta neta (sin impuestos) del periodo, en centavos. */
  netRevenue: number;
  /** Costo teórico unitario de receta; null si el platillo no tiene receta. */
  unitCost: number | null;
  /** Precio de carta con impuestos. */
  price: number;
}

export interface MenuItemResult extends MenuItemStats {
  class: MenuClass;
  netPrice: number;
  margin: number;
  costPct: number | null;
  contribution: number;
}

export function classifyMenu(items: MenuItemStats[]) {
  const sold = items.filter((i) => i.units > 0);
  const totalUnits = sold.reduce((n, i) => n + i.units, 0);
  const popThreshold = sold.length ? (totalUnits / sold.length) * 0.7 : 0;
  const rows = sold.map((i) => {
    const netPrice = Math.round(i.netRevenue / i.units);
    const margin = netPrice - (i.unitCost ?? 0);
    return { ...i, netPrice, margin, costPct: i.unitCost === null || !netPrice ? null : Math.round((i.unitCost / netPrice) * 1000) / 10, contribution: margin * i.units };
  });
  const marginThreshold = totalUnits ? Math.round(rows.reduce((n, r) => n + r.contribution, 0) / totalUnits) : 0;
  const result: MenuItemResult[] = rows.map((r) => {
    const popular = r.units >= popThreshold;
    const profitable = r.margin >= marginThreshold;
    return { ...r, class: popular ? (profitable ? "estrella" : "vaca") : profitable ? "incognita" : "perro" };
  });
  return { items: result, popThreshold: Math.round(popThreshold), marginThreshold };
}

export interface MenuAdvice { productId: string; priority: number; action: string; detail: string; impact: number | null }

/**
 * Recomendaciones accionables por platillo. `ivaFactor` convierte margen neto a precio de carta (1.16).
 * Las "vacas" reciben un aumento sugerido que las acerque al margen promedio, tope +15 % y redondeado a $5.
 */
export function menuAdvice(r: MenuItemResult, marginThreshold: number, ivaFactor = 1.16): MenuAdvice {
  if (r.unitCost === null)
    return { productId: r.productId, priority: 2, action: "Capturar receta", detail: "Sin receta no hay costo ni margen reales; clasificado solo por precio.", impact: null };
  if (r.costPct !== null && r.costPct > 38)
    return { productId: r.productId, priority: 1, action: "Auditar receta", detail: `Costo de ${r.costPct}% sobre precio neto: revisar gramajes, merma o costo de insumos.`, impact: null };
  switch (r.class) {
    case "estrella":
      return { productId: r.productId, priority: 3, action: "Mantener", detail: "Blindar receta y porciones; no subir precio.", impact: null };
    case "vaca": {
      const gap = Math.max(0, marginThreshold - r.margin);
      const raw = Math.min(gap * ivaFactor, r.price * 0.15);
      const increase = Math.max(500, Math.round(raw / 500) * 500);
      const newNet = Math.round((r.price + increase) / ivaFactor);
      return { productId: r.productId, priority: 1, action: "Subir precio", detail: `Sugerido ${fmt(r.price + increase)} (+${fmt(increase)}). Se vende bien; el margen está bajo el promedio.`, impact: (newNet - r.netPrice) * r.units };
    }
    case "incognita":
      return { productId: r.productId, priority: 2, action: "Impulsar venta", detail: "Buen margen, poca venta: reubicar en la carta y sugerirlo en mesa.", impact: null };
    case "perro":
      return { productId: r.productId, priority: 2, action: "Evaluar retiro", detail: "Poca venta y bajo margen: sustituir o retirar de la carta.", impact: null };
  }
}

const fmt = (c: number) => `$${(c / 100).toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;
