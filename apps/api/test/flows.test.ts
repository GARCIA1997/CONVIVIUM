/**
 * Pruebas de integración: API completa en memoria contra una base Postgres real (seed de demo).
 * Cubren los flujos del MVP que cruzan varios módulos y reglas de negocio.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "@convivium/db";
import { api, deviceToken, getApp, ownerToken, pinToken, startApp, stopApp } from "./helpers.js";

let owner: string, mesero: string, capitan: string, cajero: string, cocina: string, gerente: string;
let menu: { products: { id: string; name: string; price: number; categoryId: string }[] };
const product = (name: string) => menu.products.find((p) => p.name.startsWith(name))!;
let floor: { tables: { id: string; label: string; areaId: string; status: string }[] };
const table = (label: string) => floor.tables.find((t) => t.label === label)!;

beforeAll(async () => {
  await startApp();
  [owner, mesero, capitan, cajero, cocina, gerente] = await Promise.all([ownerToken(), pinToken("mesero"), pinToken("capitan"), pinToken("cajero"), pinToken("cocina"), pinToken("gerente")]);
  menu = (await api("GET", "/catalog/menu", mesero)).body;
  floor = (await api("GET", "/floor", mesero)).body;
});
afterAll(stopApp);

async function openTable(label: string, token = mesero, extra: object = {}) {
  const r = await api("POST", "/orders/checks", token, { kind: "mesa", tableId: table(label).id, guests: 2, ...extra });
  expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
  return r.body.id as string;
}
const addItem = (checkId: string, name: string, qty = 1, token = mesero) => api("POST", `/orders/checks/${checkId}/items`, token, { items: [{ productId: product(name).id, quantity: qty }] });
const getCheck = (id: string, token = mesero) => api("GET", `/orders/checks/${id}`, token).then((r) => r.body);

describe("autenticación y permisos", () => {
  it("token inválido o vencido responde 401 (no 500)", async () => {
    const r = await api("GET", "/catalog/menu", "no.es.un.token");
    expect(r.status).toBe(401);
  });
  it("PIN incorrecto se rechaza", async () => {
    const d = await deviceToken();
    const users = (await api("GET", "/auth/devices/users", d.token)).body as { id: string }[];
    expect((await api("POST", "/auth/pin", d.token, { userId: users[0]!.id, pin: "0000" })).status).toBe(401);
  });
  it("jerarquía: el mesero no abre caja; el dueño hereda todo", async () => {
    expect((await api("POST", "/cash/sessions", mesero, { registerId: (await deviceToken()).id, openingFloat: 0 })).status).toBe(403);
    const me = (await api("GET", "/auth/me", owner)).body;
    expect(me.permissions).toEqual(expect.arrayContaining(["caja.corte_z", "compras.recibir", "roles.gestionar"]));
  });
  it("un gerente no puede darse el rol de Dueño", async () => {
    const users = (await api("GET", "/users", gerente)).body as { id: string; name: string; roles: string[] }[];
    const luis = users.find((u) => u.name === "Luis")!;
    const r = await api("PUT", `/users/${luis.id}`, gerente, { name: "Luis", roles: ["gerente", "dueno"], active: true });
    expect(r.status).toBe(403);
  });
});

describe("comanda y cancelaciones", () => {
  it("abre mesa, captura y calcula el total", async () => {
    const id = await openTable("M1");
    await addItem(id, "Hamburguesa", 2);
    const c = await getCheck(id);
    expect(c.total).toBe(product("Hamburguesa").price * 2);
    expect((await api("POST", "/orders/checks", mesero, { kind: "mesa", tableId: table("M1").id, guests: 1 })).status).toBe(409);
  });
  it("cancelar lo ya preparado exige autorización; el capitán no basta, el gerente sí", async () => {
    const id = await openTable("M2");
    await addItem(id, "Tacos al pastor");
    const item = (await getCheck(id)).items.find((i: any) => i.unitPrice > 0);
    const reason = (await api("GET", "/catalog/reasons?kind=cancelacion", mesero)).body[0].id;
    for (const to of ["en_preparacion", "listo"]) expect((await api("POST", `/orders/items/${item.id}/transition`, cocina, { to })).status).toBeLessThan(300);
    expect((await api("POST", `/orders/items/${item.id}/cancel`, mesero, { reasonId: reason })).body.status).toBe("requires_approval");
    expect((await api("POST", `/orders/items/${item.id}/cancel`, capitan, { reasonId: reason })).body.status).toBe("requires_approval");
    expect((await api("POST", `/orders/items/${item.id}/cancel`, gerente, { reasonId: reason })).body.status).toBe("cancelled");
    expect((await getCheck(id)).total).toBe(0);
  });
});

describe("mesas unidas (E3-10)", () => {
  it("solo se unen mesas configuradas como unibles y libres", async () => {
    const layout = (await api("GET", "/floor", owner)).body;
    const tables = layout.tables.map((t: any) => ({ id: t.id, areaId: t.areaId, label: t.label, capacity: t.capacity, shape: t.shape, x: t.x, y: t.y, rotation: t.rotation, assignedUserId: t.assignedUserId, mergeableWith: t.label === "M5" ? ["M6"] : [] }));
    expect((await api("PUT", "/floor/layout", owner, { tables, removed: [], fixtures: [] })).status).toBe(200);
    floor = (await api("GET", "/floor", mesero)).body;
    expect((await api("POST", "/orders/checks", mesero, { kind: "mesa", tableId: table("M5").id, guests: 8, joinTableIds: [table("M7").id] })).status).toBe(409);
    const id = await openTable("M5", mesero, { joinTableIds: [table("M6").id] });
    floor = (await api("GET", "/floor", mesero)).body;
    expect(table("M6")).toMatchObject({ status: "ocupada", joinedTo: "M5" });
    expect((await api("POST", "/orders/checks", mesero, { kind: "mesa", tableId: table("M6").id, guests: 2 })).status).toBe(409);
    expect((await getCheck(id)).kind).toBe("mesa");
  });
});

describe("promociones (E4-07)", () => {
  it("2x1 entre rondas; al cancelar una unidad se cobra completa", async () => {
    const p = product("Tacos al pastor");
    const promo = await api("POST", "/promotions", owner, { name: "2x1 prueba", kind: "dos_por_uno", value: 0, productIds: [p.id], categoryIds: [], days: [], startTime: null, endTime: null, zones: [], toleranceMin: 0, status: "activa" });
    expect(promo.status).toBe(200);
    const id = await openTable("M3");
    await addItem(id, "Tacos al pastor");
    await addItem(id, "Tacos al pastor");
    let c = await getCheck(id);
    expect(c.total).toBe(p.price);
    expect(c.promotions).toEqual([{ name: "2x1 prueba", amount: p.price }]);
    const reason = (await api("GET", "/catalog/reasons?kind=cancelacion", mesero)).body[0].id;
    const last = c.items.filter((i: any) => i.unitPrice > 0).at(-1);
    await api("POST", `/orders/items/${last.id}/cancel`, gerente, { reasonId: reason });
    c = await getCheck(id);
    expect(c.total).toBe(p.price);
    expect(c.promotions).toEqual([]);
    await api("DELETE", `/promotions/${promo.body.id}`, owner);
  });
});

describe("editor de roles (E1-07)", () => {
  it("un permiso otorgado al capitán aplica de inmediato y se revierte al restaurar", async () => {
    expect((await api("GET", "/cash/sessions/current/summary", capitan)).status).toBe(403);
    const put = await api("PUT", "/roles/capitan", owner, { grant: ["caja.corte_x"], deny: [], cap: 10 });
    expect(put.status).toBe(200);
    expect((await api("GET", "/cash/sessions/current/summary", capitan)).status).not.toBe(403);
    await api("DELETE", "/roles/capitan", owner);
    expect((await api("GET", "/cash/sessions/current/summary", capitan)).status).toBe(403);
  });
  it("el Dueño no puede quitarse la gestión de roles", async () => {
    expect((await api("PUT", "/roles/dueno", owner, { grant: [], deny: ["roles.gestionar"], cap: null })).status).toBe(400);
  });
});

describe("caja e inventario", () => {
  it("cobro con cambio, descuento de inventario por receta y corte Z con PIN de gerente", async () => {
    const register = (await deviceToken()).id;
    expect((await api("POST", "/cash/sessions", cajero, { registerId: register, openingFloat: 100000 })).status).toBe(201);
    const stockBefore = (await api("GET", "/inventory/ingredients", owner)).body as { name: string; stock: number }[];
    const id = await openTable("M4");
    await addItem(id, "Hamburguesa");
    const total = (await getCheck(id)).total;
    const pay = await api("POST", `/cash/checks/${id}/pay`, cajero, { payments: [{ method: "efectivo_mxn", amount: total + 5000 }] });
    // `paid` es lo entregado por el cliente; el cambio no cuenta como venta ni en el corte.
    expect(pay.body).toMatchObject({ paid: total + 5000, change: 5000, checkStatus: "cobrada" });
    const stockAfter = (await api("GET", "/inventory/ingredients", owner)).body as { name: string; stock: number }[];
    const moved = stockAfter.filter((a) => a.stock < stockBefore.find((b) => b.name === a.name)!.stock);
    expect(moved.length).toBeGreaterThan(0);
    // El cajero no tiene corte Z: sin PIN se rechaza, con PIN de gerente pasa.
    const counted = { efectivo_mxn: 100000 + total };
    expect((await api("POST", "/cash/sessions/current/counts", cajero, { kind: "Z", counted })).status).toBe(403);
    const z = await api("POST", "/cash/sessions/current/counts", cajero, { kind: "Z", counted, approverPin: "2222" });
    expect(z.status, JSON.stringify(z.body)).toBeLessThan(300);
  });
});

describe("reportes (E9-02, E9-04)", () => {
  it("las ventas cuadran igual por producto, por forma de pago y por hora", async () => {
    const [byProduct, byPay, byHour] = await Promise.all(["producto", "forma_pago", "hora"].map((g) => api("GET", `/reports/sales?days=1&groupBy=${g}`, gerente).then((r) => r.body)));
    expect(byProduct.summary.checks).toBeGreaterThan(0);
    const sum = (r: any) => r.rows.reduce((n: number, x: any) => n + x.amount, 0);
    expect(sum(byProduct)).toBe(byProduct.summary.total);
    expect(sum(byPay)).toBe(byProduct.summary.total); // el cambio entregado no cuenta como venta
    expect(sum(byHour)).toBe(byProduct.summary.total);
    expect(byPay.rows.map((r: any) => r.key)).toEqual(["efectivo_mxn"]);
  });
  it("tiempos de preparación con percentiles por estación", async () => {
    const r = (await api("GET", "/reports/prep-times?days=1", gerente)).body;
    expect(r.summary.samples).toBeGreaterThan(0);
    expect(r.summary.p90Sec).toBeGreaterThanOrEqual(r.summary.p50Sec);
    expect(r.byStation.length).toBeGreaterThan(0);
  });
  it("el mesero no ve reportes", async () => {
    expect((await api("GET", "/reports/tips?days=1", mesero)).status).toBe(403);
  });
});

describe("bitácora inmutable (E1-06)", () => {
  it("todo lo anterior quedó registrado y no se puede borrar", async () => {
    const r = await api("GET", "/audit?period=hoy", owner);
    expect(r.status).toBe(200);
    const types = (r.body.items as { type: string }[]).map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(["check.opened", "item.cancelled", "role.updated", "cash.corte_Z"]));
    const db = getApp().db;
    await expect(db.execute(sql`DELETE FROM events`)).rejects.toThrow(/inmutable/);
    await expect(db.execute(sql`UPDATE events SET type = 'x'`)).rejects.toThrow(/inmutable/);
  });
});
