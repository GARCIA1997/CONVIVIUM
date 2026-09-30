/** Pedidos para llevar, proveedores y generador de menú (impreso, digital y QR). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, getApp, ownerToken, pinToken, startApp, stopApp } from "./helpers.js";

let owner: string, mesero: string, cajero: string, cocina: string;
let menu: { products: { id: string; name: string; price: number }[] };

beforeAll(async () => {
  await startApp();
  [owner, mesero, cajero, cocina] = await Promise.all([ownerToken(), pinToken("mesero"), pinToken("cajero"), pinToken("cocina")]);
  menu = (await api("GET", "/catalog/menu", mesero)).body;
});
afterAll(stopApp);

describe("pedidos para llevar (E3-11)", () => {
  it("folio del día, listo cuando sale de cocina, no se entrega sin cobrar", async () => {
    const open = (name: string) => api("POST", "/orders/checks", mesero, { kind: "llevar", customerName: name, customerPhone: "5512345678", channel: "telefono" });
    const a = (await open("Mariana")).body, b = (await open("Jorge")).body;
    expect(b.folio).toBe(a.folio + 1);
    expect((await api("POST", "/orders/checks", mesero, { kind: "llevar", customerName: "X", customerPhone: "123" })).status).toBe(400);
    const p = menu.products.find((x) => x.name.startsWith("Hamburguesa"))!;
    await api("POST", `/orders/checks/${a.id}/items`, mesero, { items: [{ productId: p.id, quantity: 2 }] });
    let board = (await api("GET", "/orders/takeout", mesero)).body as any[];
    expect(board.find((x) => x.id === a.id)).toMatchObject({ stage: "preparacion", paid: false, label: `L-${String(a.folio).padStart(3, "0")}`, itemCount: 2 });
    const check = (await api("GET", `/orders/checks/${a.id}`, mesero)).body;
    expect(check.tableLabel).toMatch(/^Llevar L-/);
    for (const it of check.items) for (const to of ["en_preparacion", "listo"]) await api("POST", `/orders/items/${it.id}/transition`, cocina, { to });
    board = (await api("GET", "/orders/takeout", mesero)).body;
    expect(board.find((x) => x.id === a.id).stage).toBe("listo");
    expect((await api("POST", `/orders/checks/${a.id}/hand-over`, mesero)).status).toBe(409);
    await api("POST", "/cash/sessions", cajero, { registerId: crypto.randomUUID(), openingFloat: 0 });
    expect((await api("POST", `/cash/checks/${a.id}/pay`, cajero, { payments: [{ method: "tarjeta", amount: check.total }] })).status).toBe(200);
    expect((await api("POST", `/orders/checks/${a.id}/hand-over`, mesero)).status).toBe(200);
    board = (await api("GET", "/orders/takeout", mesero)).body;
    expect(board.find((x) => x.id === a.id)).toMatchObject({ stage: "entregado", paid: true });
    // No aparece en el plano de mesas.
    const floor = (await api("GET", "/floor", mesero)).body;
    expect(floor.tables.some((t: any) => t.openCheckId === a.id)).toBe(false);
  });
});

describe("captura en mostrador", () => {
  it("el cajero abre y captura pedidos para llevar, pero no puede capturar en una mesa", async () => {
    const p = menu.products.find((x) => x.name.startsWith("Tacos"))!;
    const c = (await api("POST", "/orders/checks", cajero, { kind: "llevar", customerName: "Mostrador" })).body;
    expect((await api("POST", `/orders/checks/${c.id}/items`, cajero, { items: [{ productId: p.id, quantity: 2, fireNow: true }] })).status).toBe(201);
    expect((await api("GET", `/orders/checks/${c.id}`, cajero)).body.total).toBe(p.price * 2);
    expect((await api("POST", "/orders/checks", cajero, { kind: "mesa", tableId: crypto.randomUUID(), guests: 2 })).status).toBe(403);
    const floor = (await api("GET", "/floor", mesero)).body;
    const free = floor.tables.find((t: any) => t.status === "libre");
    const mesa = (await api("POST", "/orders/checks", mesero, { kind: "mesa", tableId: free.id, guests: 2 })).body;
    expect((await api("POST", `/orders/checks/${mesa.id}/items`, cajero, { items: [{ productId: p.id, quantity: 1 }] })).status).toBe(403);
  });
});

describe("proveedores (E8-01)", () => {
  it("alta completa, lista de precios con historial y variación", async () => {
    const ingredients = (await api("GET", "/inventory/ingredients", owner)).body as { id: string; name: string }[];
    const r = await api("POST", "/purchasing/suppliers", owner, { name: "Carnes Selectas del Norte SA de CV", tradeName: "Carnes Norte", rfc: "CSN120304AB1", contactName: "Rubén", phone: "8112345678", email: "ventas@carnesnorte.mx", creditDays: 15, deliveryDays: ["L", "J"], categories: ["Carnes"], minOrder: 150000, notes: null, active: true });
    expect(r.status).toBe(201);
    const id = r.body.id;
    const ing = ingredients[0]!;
    await api("PUT", `/purchasing/suppliers/${id}/prices`, owner, { prices: [{ ingredientId: ing.id, unitPrice: 10000 }] });
    // Mismo precio no genera historial; uno nuevo sí, con variación.
    await api("PUT", `/purchasing/suppliers/${id}/prices`, owner, { prices: [{ ingredientId: ing.id, unitPrice: 10000 }] });
    const d = (await api("PUT", `/purchasing/suppliers/${id}/prices`, owner, { prices: [{ ingredientId: ing.id, unitPrice: 11000 }] })).body;
    expect(d.priceList).toEqual([expect.objectContaining({ ingredientId: ing.id, unitPrice: 11000, previousPrice: 10000, changePct: 10 })]);
    expect(d).toMatchObject({ tradeName: "Carnes Norte", minOrder: 150000, deliveryDays: ["L", "J"] });
    expect((await api("POST", "/purchasing/suppliers", owner, { name: "X", rfc: "NO-ES-RFC" })).status).toBe(400);
  });
  it("una orden de compra manual queda en borrador hasta que el gerente la aprueba", async () => {
    const sup = ((await api("GET", "/purchasing/suppliers", owner)).body as any[]).find((s) => s.tradeName === "Carnes Norte");
    const wh = ((await api("GET", "/inventory/warehouses", owner)).body as any[])[0];
    const almacenista = await pinToken("almacenista");
    const po = await api("POST", "/purchasing/purchase-orders", almacenista, { supplierId: sup.id, warehouseId: wh.id, lines: [{ ingredientId: sup.supplies[0].ingredientId, quantity: 3, unitPrice: 11000 }] });
    expect(po.status).toBe(201);
    expect(po.body.status).toBe("borrador");
    expect((await api("POST", `/purchasing/purchase-orders/${po.body.id}/approve`, almacenista)).status).toBe(403);
    expect((await api("POST", `/purchasing/purchase-orders/${po.body.id}/approve`, owner)).status).toBeLessThan(300);
  });
});

describe("generador de menú (E2-09)", () => {
  it("PDF, QR y menú digital público solo cuando está publicado", async () => {
    const cur = (await api("GET", "/menus/current", owner)).body;
    const res = (url: string) => getApp().inject({ method: "GET", url });
    expect((await res(`/m/${cur.slug}`)).statusCode).toBe(404);
    const hidden = menu.products.find((p) => p.name.startsWith("Rib"))!;
    const put = await api("PUT", "/menus/current", owner, { slug: "prueba-centro", config: { ...cur.config, hiddenProducts: [hidden.id], whatsapp: "5512345678" } });
    expect(put.body.publicUrl).toMatch(/\/m\/prueba-centro$/);
    await api("POST", "/menus/current/publish", owner, { published: true });
    const page = await res("/m/prueba-centro");
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("Hamburguesa Convivium");
    expect(page.body).not.toContain(hidden.name);
    expect(page.body).toContain("wa.me/525512345678");
    const pdf = await getApp().inject({ method: "GET", url: "/v1/menus/current/pdf", headers: { authorization: `Bearer ${owner}` } });
    expect(pdf.headers["content-type"]).toBe("application/pdf");
    expect(pdf.rawPayload.subarray(0, 5).toString()).toBe("%PDF-");
    const qr = await getApp().inject({ method: "GET", url: "/v1/menus/current/qr?format=svg", headers: { authorization: `Bearer ${owner}` } });
    expect(qr.body).toContain("<svg");
    expect((await api("GET", "/menus/current", mesero)).status).toBe(403);
  });
});

describe("foto del platillo", () => {
  it("se sube, se sirve en /media/, aparece en el menú y se puede quitar; solo quien edita el menú", async () => {
    const p = menu.products.find((x) => x.name.startsWith("Guacamole"))!;
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    expect((await api("PUT", `/catalog/products/${p.id}/photo`, mesero, { dataUrl: png })).status).toBe(403);
    expect((await api("PUT", `/catalog/products/${p.id}/photo`, owner, { dataUrl: "data:image/gif;base64,R0lG" })).status).toBe(400);
    const up = await api("PUT", `/catalog/products/${p.id}/photo`, owner, { dataUrl: png });
    expect(up.body.photoUrl).toMatch(/^\/media\/.+\.png$/);
    const file = await getApp().inject({ method: "GET", url: up.body.photoUrl });
    expect(file.statusCode).toBe(200);
    expect(file.headers["content-type"]).toBe("image/png");
    const after = (await api("GET", "/catalog/menu", mesero)).body.products.find((x: { id: string }) => x.id === p.id);
    expect(after.photoUrl).toBe(up.body.photoUrl);
    expect((await getApp().inject({ method: "GET", url: "/m/prueba-centro" })).body).toContain(up.body.photoUrl);
    await api("DELETE", `/catalog/products/${p.id}/photo`, owner);
    expect((await getApp().inject({ method: "GET", url: up.body.photoUrl })).statusCode).toBe(404);
  });
});
