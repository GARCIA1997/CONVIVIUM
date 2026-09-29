/**
 * Motor de promociones (HU E4-07).
 * Recalcula el descuento de cada renglón de una cuenta. Es puro y determinista: se vuelve a
 * ejecutar cada vez que la cuenta cambia (alta, cancelación, devolución, traspaso), así que
 * un 2x1 o un combo se forma aunque los productos se pidan en rondas distintas.
 *
 * Si varias reglas aplican a un renglón, gana la de mayor beneficio para el comensal.
 */
export type PromoKind = "dos_por_uno" | "porcentaje" | "precio_especial" | "combo";

export interface Promotion {
  id: string;
  name: string;
  kind: PromoKind;
  /** porcentaje: 1–100 · precio_especial y combo: precio en centavos · dos_por_uno: sin uso. */
  value: number;
  productIds: string[];
  categoryIds: string[];
  /** 0 = domingo … 6 = sábado. Vacío = todos los días. */
  days: number[];
  /** "HH:MM" locales. Si fin < inicio, cruza la medianoche. Nulos = todo el día. */
  startTime: string | null;
  endTime: string | null;
  /** Ids de área de mesas y/o "barra". Vacío = todo el local. */
  zones: string[];
  /** Minutos extra para cuentas abiertas dentro de la franja. */
  toleranceMin: number;
  active: boolean;
}

export interface PromoLine {
  id: string;
  productId: string;
  categoryId: string;
  quantity: number;
  /** Precio de lista por unidad (sin modificadores). */
  unitPrice: number;
  /** Solo participan renglones cobrables (no cancelados/devueltos, estación principal). */
  chargeable: boolean;
  orderedAt: Date;
}

export interface PromoContext {
  /** Zona de la cuenta: id de área de la mesa o "barra". */
  zone: string;
  checkOpenedAt: Date;
  timezone: string;
}

export interface PromoResult { discount: number; promotionId: string | null }

/** Día (0–6) y minutos desde medianoche en la zona horaria de la sucursal. */
export function localClock(d: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

const toMin = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h! * 60 + m!; };

/** ¿La promoción está vigente en ese instante? (con `extra` minutos de tolerancia al cierre). */
export function promoActiveAt(p: Promotion, at: Date, timezone: string, extra = 0): boolean {
  if (!p.active) return false;
  const { day, minutes } = localClock(at, timezone);
  if (!p.startTime || !p.endTime) return p.days.length === 0 || p.days.includes(day);
  const start = toMin(p.startTime), end = toMin(p.endTime) + extra;
  if (start <= toMin(p.endTime)) {
    return (p.days.length === 0 || p.days.includes(day)) && minutes >= start && minutes < end;
  }
  // Cruza medianoche: la parte de madrugada pertenece al día anterior.
  if (minutes >= start) return p.days.length === 0 || p.days.includes(day);
  const prev = (day + 6) % 7;
  return (p.days.length === 0 || p.days.includes(prev)) && minutes < end;
}

function eligible(p: Promotion, l: PromoLine, ctx: PromoContext): boolean {
  if (!l.chargeable) return false;
  if (!(p.productIds.includes(l.productId) || p.categoryIds.includes(l.categoryId))) return false;
  if (p.zones.length && !p.zones.includes(ctx.zone)) return false;
  // Vigente al pedir, o la cuenta se abrió en franja y se pide dentro de la tolerancia.
  return promoActiveAt(p, l.orderedAt, ctx.timezone) ||
    (p.toleranceMin > 0 && promoActiveAt(p, ctx.checkOpenedAt, ctx.timezone) && promoActiveAt(p, l.orderedAt, ctx.timezone, p.toleranceMin));
}

/** Descuento que una sola promoción da a cada renglón. */
function discountsFor(p: Promotion, lines: PromoLine[], ctx: PromoContext): Map<string, number> {
  const out = new Map<string, number>();
  const el = lines.filter((l) => eligible(p, l, ctx));
  if (!el.length) return out;
  switch (p.kind) {
    case "porcentaje":
      for (const l of el) out.set(l.id, Math.round((l.unitPrice * l.quantity * Math.min(100, Math.max(0, p.value))) / 100));
      break;
    case "precio_especial":
      for (const l of el) if (p.value < l.unitPrice) out.set(l.id, (l.unitPrice - p.value) * l.quantity);
      break;
    case "dos_por_uno": {
      // Cada par regala la unidad más barata: ordenamos unidades de mayor a menor precio y cobramos 1 de cada 2.
      const units = el.flatMap((l) => Array.from({ length: l.quantity }, () => l)).sort((a, b) => b.unitPrice - a.unitPrice || a.id.localeCompare(b.id));
      units.forEach((l, i) => { if (i % 2 === 1) out.set(l.id, (out.get(l.id) ?? 0) + l.unitPrice); });
      break;
    }
    case "combo": {
      // Un combo = una unidad de cada producto listado; se cobra `value` por combo completo.
      if (!p.productIds.length) break;
      const pools = p.productIds.map((pid) => el.filter((l) => l.productId === pid).flatMap((l) => Array.from({ length: l.quantity }, () => l)));
      const sets = Math.min(...pools.map((u) => u.length));
      for (let s = 0; s < sets; s++) {
        const members = pools.map((u) => u[s]!);
        const full = members.reduce((n, l) => n + l.unitPrice, 0);
        let saving = Math.max(0, full - p.value);
        // Reparte el ahorro proporcionalmente al precio de cada integrante.
        members.forEach((l, i) => {
          const part = i === members.length - 1 ? saving : Math.round(((full - p.value) * l.unitPrice) / full);
          const d = Math.min(part, saving);
          saving -= d;
          out.set(l.id, (out.get(l.id) ?? 0) + d);
        });
      }
      break;
    }
  }
  return out;
}

/** Descuento final por renglón: la promoción de mayor beneficio gana en cada uno. */
export function applyPromotions(lines: PromoLine[], promos: Promotion[], ctx: PromoContext): Map<string, PromoResult> {
  const best = new Map<string, PromoResult>(lines.map((l) => [l.id, { discount: 0, promotionId: null }]));
  for (const p of promos) {
    for (const [id, d] of discountsFor(p, lines, ctx)) {
      const line = lines.find((l) => l.id === id)!;
      const capped = Math.min(d, line.unitPrice * line.quantity);
      if (capped > best.get(id)!.discount) best.set(id, { discount: capped, promotionId: p.id });
    }
  }
  return best;
}
