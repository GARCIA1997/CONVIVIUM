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
    // La última mesa libre: flows.test.ts usa las primeras (M1–M9) y el orden de archivos no está garantizado.
    const free = [...floor.tables].reverse().find((t: any) => t.status === "libre");
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
    const pdf = (token: string) => getApp().inject({ method: "GET", url: `/v1/purchasing/purchase-orders/${po.body.id}/pdf`, headers: { authorization: `Bearer ${token}` } });
    expect((await pdf(almacenista)).statusCode).toBe(409); // borrador: no se manda al proveedor
    expect((await api("POST", `/purchasing/purchase-orders/${po.body.id}/approve`, almacenista)).status).toBe(403);
    expect((await api("POST", `/purchasing/purchase-orders/${po.body.id}/approve`, owner)).status).toBeLessThan(300);
    // E8-02 · PDF de la OC aprobada; descargarlo no la marca como enviada.
    const res = await pdf(almacenista);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.rawPayload.subarray(0, 5).toString()).toBe("%PDF-");
    expect((await api("GET", `/purchasing/purchase-orders/${po.body.id}`, owner)).body.status).toBe("aprobada");
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

describe("identidad del restaurante (marca blanca)", () => {
  it("el menú digital y el PDF usan logo, nombre y colores del restaurante con 'Powered by CONVIVIUM'", async () => {
    const def = (await api("GET", "/branding", mesero)).body;
    expect(def.primary).toBe("#1E2F28");
    const body = { name: "Mariscos El Faro", slogan: "Del mar a tu mesa", primary: "#12355B", accent: "#E8684A", background: "#F6F1E7", text: "#1A1A1A", fontHeading: "DM Serif Display", fontBody: "Nunito" };
    expect((await api("PUT", "/branding", mesero, body)).status).toBe(403);
    expect((await api("PUT", "/branding", owner, { ...body, primary: "azul" })).status).toBe(400);
    expect((await api("PUT", "/branding", owner, body)).body.name).toBe("Mariscos El Faro");
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    expect((await api("PUT", "/branding/logo", owner, { dataUrl: "data:image/svg+xml;base64,PHN2Zz4=" })).status).toBe(400);
    const logo = (await api("PUT", "/branding/logo", owner, { dataUrl: png })).body.logoUrl;
    expect(logo).toMatch(/^\/media\/logo-.+\.png$/);
    const page = (await getApp().inject({ method: "GET", url: "/m/prueba-centro" })).body;
    expect(page).toContain("Mariscos El Faro");
    expect(page).toContain(logo);
    expect(page).toContain("--brand-primary:18 53 91");
    expect(page).toContain("family=DM+Serif+Display");
    expect(page).toContain("Powered by");
    const pdf = await getApp().inject({ method: "GET", url: "/v1/menus/current/pdf", headers: { authorization: `Bearer ${owner}` } });
    expect(pdf.rawPayload.subarray(0, 5).toString()).toBe("%PDF-");
    await api("DELETE", "/branding/logo", owner);
    expect((await getApp().inject({ method: "GET", url: logo })).statusCode).toBe(404);
  });
});

describe("eliminar recetas", () => {
  it("no borra una subreceta en uso (409); borra la receta y luego la subreceta", async () => {
    const ing = ((await api("GET", "/inventory/ingredients", owner)).body as { id: string }[])[0]!;
    const line = (x: object) => ({ ingredientId: null, subRecipeId: null, quantity: 10, wastePct: 0, ...x });
    const sub = (await api("POST", "/inventory/recipes", owner, { name: "Salsa prueba", productId: null, modifierId: null, isSubRecipe: true, yieldQty: 500, steps: [], lines: [line({ ingredientId: ing.id })] })).body;
    const main = (await api("POST", "/inventory/recipes", owner, { name: "Plato prueba", productId: null, modifierId: null, isSubRecipe: false, yieldQty: null, steps: [], lines: [line({ subRecipeId: sub.id })] })).body;
    const busy = await api("DELETE", `/inventory/recipes/${sub.id}`, owner);
    expect(busy.status).toBe(409);
    expect(busy.body.message).toContain("Plato prueba");
    expect((await api("DELETE", `/inventory/recipes/${main.id}`, mesero)).status).toBe(403);
    expect((await api("DELETE", `/inventory/recipes/${main.id}`, owner)).status).toBe(200);
    expect((await api("DELETE", `/inventory/recipes/${sub.id}`, owner)).status).toBe(200);
    expect((await api("GET", `/inventory/recipes/${sub.id}`, owner)).status).toBe(404);
  });
});

describe("agotado automático por insumo crítico (E7-07)", () => {
  it("al quedar en cero en la sucursal marca agotado el platillo, una sola vez y con bitácora", async () => {
    const ing = (await api("POST", "/inventory/ingredients", owner, { name: "Trufa prueba", purchaseUnit: "kg", useUnit: "g", conversion: 1000, minStock: 0, maxStock: 100, critical: true })).body;
    // Producto propio: no tocar recetas del seed que usan otras pruebas en paralelo.
    const base = (menu.products as any[]).find((x) => x.name.startsWith("Hamburguesa"))!;
    const created = (await api("POST", "/catalog/products", owner, { categoryId: base.categoryId, name: "Platillo trufado prueba", price: 25000, targetPrepSec: 600, stationIds: base.stationIds, photoUrl: null, active: true, soldOut: false })).body;
    const p = { id: created.id as string, name: "Platillo trufado prueba" };
    await api("POST", "/inventory/recipes", owner, { name: p.name, productId: p.id, modifierId: null, isSubRecipe: false, yieldQty: null, steps: [], lines: [{ ingredientId: ing.id, subRecipeId: null, quantity: 5, wastePct: 0 }] });
    const wh = ((await api("GET", "/inventory/warehouses", owner)).body as any[])[0];
    const mv = (direction: string, type: string) => api("POST", "/inventory/movements", owner, { type, ingredientId: ing.id, quantity: 10, warehouseId: wh.id, direction });
    await mv("entrada", "ajuste");
    const soldOut = async () => ((await api("GET", "/catalog/menu", mesero)).body.products as any[]).find((x) => x.id === p.id).soldOut;
    expect(await soldOut()).toBe(false);
    await mv("salida", "merma");
    expect(await soldOut()).toBe(true);
    await mv("salida", "merma"); // ya agotado: no debe volver a registrar
    const { schema, eq, and } = await import("@convivium/db");
    const events = await getApp().db.select().from(schema.events).where(and(eq(schema.events.type, "product.auto_sold_out"), eq(schema.events.entityId, p.id)));
    expect(events).toHaveLength(1);
  });
});

describe("cierre de sesión por inactividad (E1-03)", () => {
  it("la sucursal guarda minutos por app; cualquier rol los lee y se validan rangos", async () => {
    const b = (await api("GET", "/branch", mesero)).body;
    expect(b.idleMinutes).toEqual({ mesero: 5, caja: 30, estacion: 720 });
    const { id: _id, idleMinutes: _idle, ...body } = b;
    expect((await api("PUT", "/branch", owner, { ...body, idleMinutes: { mesero: 0, caja: 30, estacion: 720 } })).status).toBe(400);
    expect((await api("PUT", "/branch", mesero, { ...body, idleMinutes: { mesero: 10, caja: 30, estacion: 720 } })).status).toBe(403);
    expect((await api("PUT", "/branch", owner, { ...body, idleMinutes: { mesero: 10, caja: 45, estacion: 600 } })).status).toBe(200);
    expect((await api("GET", "/branch", cajero)).body.idleMinutes).toEqual({ mesero: 10, caja: 45, estacion: 600 });
    // Sin idleMinutes (clientes anteriores) no se tocan.
    expect((await api("PUT", "/branch", owner, body)).status).toBe(200);
    expect((await api("GET", "/branch", owner)).body.idleMinutes.mesero).toBe(10);
    await api("PUT", "/branch", owner, { ...body, idleMinutes: { mesero: 5, caja: 30, estacion: 720 } });
  });
});

describe("favoritos del comandero (E3-02)", () => {
  it("devuelve hasta 8 productos de la carta, el más vendido primero", async () => {
    const r = await api("GET", "/catalog/favorites", mesero);
    expect(r.status).toBe(200);
    const ids = r.body.productIds as string[];
    expect(ids.length).toBeGreaterThan(0); // flows.test.ts y este archivo ya registraron ventas
    expect(ids.length).toBeLessThanOrEqual(8);
    const known = new Set(menu.products.map((p) => p.id));
    expect(ids.every((id) => known.has(id))).toBe(true);
    const { schema, sql } = await import("@convivium/db");
    const sold = await getApp().db
      .select({ productId: schema.orderItems.productId, q: sql<number>`sum(${schema.orderItems.quantity})::int` })
      .from(schema.orderItems)
      .where(sql`${schema.orderItems.state} not in ('cancelado','devuelto')`)
      .groupBy(schema.orderItems.productId);
    const qty = new Map(sold.map((x) => [x.productId, x.q]));
    expect(qty.get(ids[0]!)).toBe(Math.max(...sold.map((x) => x.q))); // empates no vuelven intermitente la prueba
  });
});
