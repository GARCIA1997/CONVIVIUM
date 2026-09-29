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
    expect(ok.body).toEqual({ applied: 1, stale: 0 });
    const back = await api<{ changes: ConfigChange[] }>("GET", `/sync/config?since=${cursor}`, nodeToken);
    expect(back.body.changes).toEqual([]);
    const old = await api("POST", "/sync/config", nodeToken, { changes: [change("2020-01-01T00:00:00.000Z")] });
    expect(old.body).toEqual({ applied: 0, stale: 1 });
  });

  it("rechaza filas de otra empresa y tablas fuera de la lista", async () => {
    const [cat] = (await node.execute(sql`SELECT to_jsonb(c) AS row FROM categories c LIMIT 1`)) as unknown as { row: Record<string, unknown> }[];
    const foreign = { ...cat!.row, tenant_id: "00000000-0000-0000-0000-000000000001" };
    const now = new Date().toISOString();
    expect((await api("POST", "/sync/config", nodeToken, { changes: [{ table: "categories", op: "upsert", pk: { id: foreign.id }, data: foreign, changedAt: now }] })).status).toBe(403);
    expect((await api("POST", "/sync/config", nodeToken, { changes: [{ table: "payments", op: "delete", pk: { id: foreign.id }, data: null, changedAt: now }] })).status).toBe(400);
  });

  it("un nodo revocado ya no sincroniza", async () => {
    const devices = (await api<{ id: string; kind: string }[]>("GET", "/auth/devices", owner)).body;
    const n = devices.find((d) => d.kind === "nodo")!;
    await api("POST", `/auth/devices/${n.id}/revoke`, owner);
    expect((await api("GET", `/sync/config?since=${cursor}`, nodeToken)).status).toBe(403);
  });
});
