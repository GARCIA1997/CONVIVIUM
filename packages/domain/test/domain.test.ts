import { describe, expect, it } from "vitest";
import { breakdownIncludedTaxes, can, cancelRequirement, canTransition, discountNeedsApproval, semaforo } from "../src/index.js";

describe("roles jerárquicos", () => {
  it("dueño hereda todo lo del gerente y del almacenista", () => {
    expect(can(["dueno"], "cxp.pagar")).toBe(true);
    expect(can(["dueno"], "compras.recibir")).toBe(true);
    expect(can(["dueno"], "comanda.capturar")).toBe(true);
  });
  it("almacenista no paga proveedores", () => {
    expect(can(["almacenista"], "cxp.pagar")).toBe(false);
    expect(can(["almacenista"], "compras.recibir")).toBe(true);
  });
  it("capitán hereda del mesero", () => {
    expect(can(["capitan"], "comanda.capturar")).toBe(true);
    expect(can(["mesero"], "descuento.aplicar")).toBe(false);
  });
});

describe("comanda", () => {
  it("no se puede marcar listo algo cancelado", () => {
    expect(canTransition("cancelado", "listo")).toBe(false);
  });
  it("reglas de cancelación por estado", () => {
    expect(cancelRequirement("pendiente")).toBe("libre");
    expect(cancelRequirement("enviado")).toBe("motivo");
    expect(cancelRequirement("listo")).toBe("autorizacion");
  });
  it("semáforo", () => {
    expect(semaforo(100, 600)).toBe("verde");
    expect(semaforo(500, 600)).toBe("amarillo");
    expect(semaforo(700, 600)).toBe("rojo");
  });
});

describe("impuestos", () => {
  it("IVA 16 % incluido", () => {
    const b = breakdownIncludedTaxes(11600, { ivaPct: 16, iepsPct: 0 });
    expect(b).toEqual({ total: 11600, base: 10000, ieps: 0, iva: 1600 });
  });
  it("suma cuadra con IEPS", () => {
    const b = breakdownIncludedTaxes(16500, { ivaPct: 16, iepsPct: 26.5 });
    expect(b.base + b.ieps + b.iva).toBe(16500);
  });
});

describe("aprobaciones", () => {
  it("capitán hasta 10 %", () => {
    expect(discountNeedsApproval(["capitan"], 10)).toBe(false);
    expect(discountNeedsApproval(["capitan"], 15)).toBe(true);
    expect(discountNeedsApproval(["gerente"], 100)).toBe(false);
  });
});
