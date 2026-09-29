import { describe, expect, it } from "vitest";
import { applyPromotions, promoActiveAt, roleEffective, type PromoLine, type Promotion } from "../src/index.js";

const TZ = "America/Mexico_City";
// Martes 29-sep-2026 18:30 en CDMX (UTC-6) = 00:30Z del miércoles.
const TUE_1830 = new Date("2026-09-30T00:30:00Z");
const TUE_2010 = new Date("2026-09-30T02:10:00Z");
const TUE_1700 = new Date("2026-09-29T23:00:00Z");

const promo = (p: Partial<Promotion>): Promotion => ({
  id: "p", name: "p", kind: "dos_por_uno", value: 0, productIds: ["beer"], categoryIds: [], days: [], startTime: null, endTime: null, zones: [], toleranceMin: 0, active: true, ...p,
});
const line = (id: string, l: Partial<PromoLine> = {}): PromoLine => ({ id, productId: "beer", categoryId: "cat", quantity: 1, unitPrice: 8500, chargeable: true, orderedAt: TUE_1830, ...l });
const ctx = { zone: "salon", checkOpenedAt: TUE_1830, timezone: TZ };

describe("promociones", () => {
  it("2x1 regala la unidad más barata aunque se pidan en rondas distintas", () => {
    const r = applyPromotions([line("a", { unitPrice: 9000 }), line("b", { unitPrice: 8500 })], [promo({})], ctx);
    expect(r.get("a")!.discount).toBe(0);
    expect(r.get("b")!.discount).toBe(8500);
  });
  it("2x1 con 3 unidades cobra 2", () => {
    const r = applyPromotions([line("a", { quantity: 3 })], [promo({})], ctx);
    expect(r.get("a")!.discount).toBe(8500);
  });
  it("respeta días y horario, con tolerancia para cuentas abiertas", () => {
    const hh = promo({ days: [1, 2, 3, 4, 5], startTime: "17:00", endTime: "20:00", toleranceMin: 15 });
    expect(promoActiveAt(hh, TUE_1830, TZ)).toBe(true);
    expect(promoActiveAt(hh, TUE_2010, TZ)).toBe(false);
    const lines = [line("a", { orderedAt: TUE_2010 }), line("b", { orderedAt: TUE_2010 })];
    expect(applyPromotions(lines, [hh], ctx).get("b")!.discount).toBe(8500); // abierta a las 18:30
    expect(applyPromotions(lines, [hh], { ...ctx, checkOpenedAt: TUE_2010 }).get("b")!.discount).toBe(0);
    expect(promoActiveAt({ ...hh, days: [0] }, TUE_1700, TZ)).toBe(false);
  });
  it("franja que cruza medianoche pertenece al día en que empieza", () => {
    const night = promo({ days: [2], startTime: "20:00", endTime: "02:00" });
    expect(promoActiveAt(night, new Date("2026-09-30T07:30:00Z"), TZ)).toBe(true); // miércoles 01:30
    expect(promoActiveAt(night, new Date("2026-10-01T07:30:00Z"), TZ)).toBe(false); // jueves 01:30
  });
  it("gana la promoción de mayor beneficio", () => {
    const r = applyPromotions([line("a")], [promo({ id: "pct", kind: "porcentaje", value: 30 }), promo({ id: "esp", kind: "precio_especial", value: 7000 })], ctx);
    expect(r.get("a")).toEqual({ discount: 2550, promotionId: "pct" });
  });
  it("combo: precio fijo por juego completo, ahorro repartido", () => {
    const combo = promo({ kind: "combo", value: 15000, productIds: ["beer", "guac"] });
    const r = applyPromotions([line("a", { quantity: 2 }), line("g", { productId: "guac", unitPrice: 12000 })], [combo], ctx);
    expect(r.get("a")!.discount + r.get("g")!.discount).toBe(8500 + 12000 - 15000);
  });
  it("no aplica fuera de su zona ni a renglones no cobrables", () => {
    expect(applyPromotions([line("a"), line("b")], [promo({ zones: ["barra"] })], ctx).get("b")!.discount).toBe(0);
    expect(applyPromotions([line("a"), line("b", { chargeable: false })], [promo({})], ctx).get("b")!.discount).toBe(0);
  });
});

describe("ajustes de roles por empresa", () => {
  it("un permiso dado al capitán lo hereda el gerente; uno negado no llega al capitán", () => {
    const ov = { capitan: { grant: ["caja.corte_x" as const], deny: ["cortesia.aplicar" as const] } };
    expect(roleEffective("capitan", ov).has("caja.corte_x")).toBe(true);
    expect(roleEffective("capitan", ov).has("cortesia.aplicar")).toBe(false);
    expect(roleEffective("dueno", { dueno: { deny: ["roles.gestionar"] } }).has("roles.gestionar")).toBe(true);
  });
});
