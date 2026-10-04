/**
 * Sincronización de configuración (doc 05 §5): la API corre en modo nube contra convivium_test
 * y convivium_test_node hace de nodo recién instalado.
 */
process.env.CONVIVIUM_MODE = "cloud";
import { applyConfigChanges, createDb, sql, type ConfigChange } from "@convivium/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, getApp, ownerToken, startApp, stopApp } from "./helpers.js";

const node = createDb("postgres://convivium:convivium@localhost:5432/convivium_test_node");
let owner: string, nodeToken: string;
const count = async (db: typeof node, table: string) => Number(((await db.execute(sql.raw(`SELECT count(*)::int AS n FROM "${table}"`))) as unknown as { n: number }[])[0]!.n);

beforeAll(async () => {
  await startApp();
  owner = await ownerToken();
  const code = (await api("POST", "/auth/devices/pairing-code", owner)).body.code;
  const paired = await api("POST", "/auth/devices/pair", undefined, { code, name: "Nodo de pruebas", kind: "nodo" });
  nodeToken = paired.body.deviceToken;
});
afterAll(stopApp);

describe("sincronización de configuración nube ↔ nodo", () => {
  let cursor = 0;

  it("solo un dispositivo tipo nodo puede sincronizar", async () => {
    expect((await api("GET", "/sync/config?since=0", owner)).status).toBe(403);
  });

  it("la foto inicial deja al nodo igual que la nube, sin eco en su registro", async () => {
    const r = await api<{ cursor: number; snapshot: boolean; changes: ConfigChange[] }>("GET", "/sync/config?since=0", nodeToken);
    expect(r.body.snapshot).toBe(true);
    await applyConfigChanges(node, r.body.changes, { silent: true });
    cursor = r.body.cursor;
    const cloud = getApp().db;
    for (const t of ["users", "user_roles", "products", "modifiers", "tables", "recipes", "recipe_lines"]) expect(await count(node, t), t).toBe(await count(cloud, t));
    expect(await count(node, "config_changes")).toBe(0);
  });

  it("un cambio en la nube llega como incremento", async () => {
    await getApp().db.execute(sql`UPDATE products SET price = price + 100 WHERE name LIKE 'Guacamole%'`);
    const r = await api<{ cursor: number; changes: ConfigChange[] }>("GET", `/sync/config?since=${cursor}`, nodeToken);
    expect(r.body.changes.map((c) => c.table)).toEqual(["products"]);
    await applyConfigChanges(node, r.body.changes, { silent: true });
    cursor = r.body.cursor;
    const price = async (db: typeof node) => ((await db.execute(sql`SELECT price FROM products WHERE name LIKE 'Guacamole%'`)) as unknown as { price: number }[])[0]!.price;
    expect(await price(node)).toBe(await price(getApp().db));
  });

  it("lo que sube el nodo se aplica (last-writer-wins), no se le regresa y lo viejo se descarta", async () => {
    const [cat] = (await node.execute(sql`SELECT to_jsonb(c) AS row FROM categories c LIMIT 1`)) as unknown as { row: Record<string, unknown> }[];
    const row = { ...cat!.row, name: "Renombrada en el nodo" };
    const change = (changedAt: string): ConfigChange => ({ table: "categories", op: "upsert", pk: { id: row.id }, data: row, changedAt });
    const ok = await api("POST", "/sync/config", nodeToken, { changes: [change(new Date().toISOString())] });
    expect(ok.body).toEqual({ applied: 1, stale: 0, ops: 0 });
    const back = await api<{ changes: ConfigChange[] }>("GET", `/sync/config?since=${cursor}`, nodeToken);
    expect(back.body.changes).toEqual([]);
    const old = await api("POST", "/sync/config", nodeToken, { changes: [change("2020-01-01T00:00:00.000Z")] });
    expect(old.body).toEqual({ applied: 0, stale: 1, ops: 0 });
  });

  it("rechaza filas de otra empresa y tablas fuera de la lista", async () => {
    const [cat] = (await node.execute(sql`SELECT to_jsonb(c) AS row FROM categories c LIMIT 1`)) as unknown as { row: Record<string, unknown> }[];
    const foreign = { ...cat!.row, tenant_id: "00000000-0000-0000-0000-000000000001" };
    const now = new Date().toISOString();
    expect((await api("POST", "/sync/config", nodeToken, { changes: [{ table: "categories", op: "upsert", pk: { id: foreign.id }, data: foreign, changedAt: now }] })).status).toBe(403);
    expect((await api("POST", "/sync/config", nodeToken, { changes: [{ table: "devices", op: "delete", pk: { id: foreign.id }, data: null, changedAt: now }] })).status).toBe(400);
  });

  it("la operación del nodo sube a la nube (no regresa) y alimenta el comparativo de sucursales", async () => {
    const cloud = getApp().db;
    const [ctx] = (await cloud.execute(sql`SELECT t.id AS tenant, b.id AS branch, (SELECT id FROM users WHERE tenant_id = t.id LIMIT 1) AS waiter, (SELECT to_jsonb(p) FROM products p WHERE p.tenant_id = t.id LIMIT 1) AS product, (SELECT station_id FROM product_stations LIMIT 1) AS station FROM tenants t JOIN branches b ON b.tenant_id = t.id LIMIT 1`)) as unknown as { tenant: string; branch: string; waiter: string; product: any; station: string }[];
    const now = new Date().toISOString();
    const checkId = crypto.randomUUID(), itemId = crypto.randomUUID();
    const check = { id: checkId, tenant_id: ctx!.tenant, branch_id: ctx!.branch, kind: "barra", table_id: null, joined_table_ids: [], name: "Venta del nodo", guests: 2, waiter_id: ctx!.waiter, status: "cobrada", invoice_status: null, created_at: now, closed_at: now };
    const item = { id: itemId, tenant_id: ctx!.tenant, branch_id: ctx!.branch, check_id: checkId, product_id: ctx!.product.id, product_name: ctx!.product.name, station_id: ctx!.station, quantity: 3, unit_price: 10000, modifiers: [], note: null, guest: null, course: "sin_tiempo", state: "entregado", priority: "normal", target_prep_sec: 600, created_by: ctx!.waiter, created_at: now, sent_at: now, ready_at: now, delivered_at: now, ready_by: null, promo_discount: 0, promotion_id: null };
    const before = (await api("GET", "/reports/branches?days=1", owner)).body.branches[0].sales;
    const r = await api("POST", "/sync/config", nodeToken, { changes: [
      { table: "checks", op: "upsert", pk: { id: checkId }, data: check, changedAt: now },
      { table: "order_items", op: "upsert", pk: { id: itemId }, data: item, changedAt: now },
    ] });
    expect(r.body).toEqual({ applied: 0, stale: 0, ops: 2 });
    const after = (await api("GET", "/reports/branches?days=1", owner)).body;
    expect(after.branches[0].sales - before).toBe(30000);
    expect((await api<{ changes: ConfigChange[] }>("GET", `/sync/config?since=${cursor}`, nodeToken)).body.changes).toEqual([]);
    // Otra sucursal o empresa: rechazado.
    const foreign = { ...check, id: crypto.randomUUID(), branch_id: crypto.randomUUID() };
    expect((await api("POST", "/sync/config", nodeToken, { changes: [{ table: "checks", op: "upsert", pk: { id: foreign.id }, data: foreign, changedAt: now }] })).status).toBe(403);
  });

  it("solo el dueño consulta otras sucursales o el consolidado", async () => {
    const gerente = (await api("POST", "/auth/login", undefined, { email: "dueno@demo.mx", password: "demo12345" })).body.accessToken;
    expect((await api("GET", "/reports/sales?days=1&branch=todas", gerente)).status).toBe(200);
    expect((await api("GET", `/reports/sales?days=1&branch=${crypto.randomUUID()}`, gerente)).status).toBe(403);
  });

  it("con nodo vinculado, la nube no crea OC ni recibe mercancía de esa sucursal (autoridad del nodo)", async () => {
    const [sup] = (await api("GET", "/purchasing/suppliers", owner)).body as any[];
    const [wh] = (await api("GET", "/inventory/warehouses", owner)).body as any[];
    const [ing] = (await api("GET", "/inventory/ingredients", owner)).body as any[];
    const lines = [{ ingredientId: ing.id, quantity: 1, unitPrice: 100 }];
    const po = await api("POST", "/purchasing/purchase-orders", owner, { supplierId: sup.id, warehouseId: wh.id, lines });
    expect(po.status).toBe(409);
    expect(po.body.error).toBe("branch_has_node");
    const rec = await api("POST", "/purchasing/receipts", owner, { supplierId: sup.id, warehouseId: wh.id, createPayable: false, lines });
    expect(rec.body.error).toBe("branch_has_node");
  });

  it("un nodo revocado ya no sincroniza", async () => {
    const devices = (await api<{ id: string; kind: string }[]>("GET", "/auth/devices", owner)).body;
    const n = devices.find((d) => d.kind === "nodo")!;
    await api("POST", `/auth/devices/${n.id}/revoke`, owner);
    expect((await api("GET", `/sync/config?since=${cursor}`, nodeToken)).status).toBe(403);
  });
});

describe("órdenes de compra en la nube sin nodo", () => {
  it("con el nodo revocado, la nube vuelve a ser la autoridad y numera por sucursal", async () => {
    const [sup] = (await api("GET", "/purchasing/suppliers", owner)).body as any[];
    const [wh] = (await api("GET", "/inventory/warehouses", owner)).body as any[];
    const [ing] = (await api("GET", "/inventory/ingredients", owner)).body as any[];
    const po = await api("POST", "/purchasing/purchase-orders", owner, { supplierId: sup.id, warehouseId: wh.id, lines: [{ ingredientId: ing.id, quantity: 1, unitPrice: 100 }] });
    expect(po.status).toBe(201);
    expect(po.body.folio).toMatch(/^OC-CEN-\d{4}$/);
  });
});
