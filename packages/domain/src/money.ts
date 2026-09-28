/**
 * Dinero en centavos (enteros) para evitar errores de punto flotante.
 * Los precios de menú incluyen impuestos (HU E2-01); aquí se desglosan.
 */
export type Cents = number;

export interface TaxConfig {
  /** IVA de la sucursal: 16 o 8 (región fronteriza). */
  ivaPct: 16 | 8;
  /** IEPS del producto en %, 0 si no aplica. */
  iepsPct: number;
}

export interface TaxBreakdown {
  total: Cents;
  base: Cents;
  ieps: Cents;
  iva: Cents;
}

/** Desglosa un precio con impuestos incluidos. El IVA se calcula sobre base + IEPS. */
export function breakdownIncludedTaxes(total: Cents, { ivaPct, iepsPct }: TaxConfig): TaxBreakdown {
  const factor = (1 + iepsPct / 100) * (1 + ivaPct / 100);
  const base = Math.round(total / factor);
  const ieps = Math.round(base * (iepsPct / 100));
  const iva = total - base - ieps;
  return { total, base, ieps, iva };
}

export function pct(amount: Cents, percent: number): Cents {
  return Math.round((amount * percent) / 100);
}

export function formatMXN(cents: Cents): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);
}
