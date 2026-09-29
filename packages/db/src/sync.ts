import { sql } from "drizzle-orm";
import type { Db } from "./index.js";

/**
 * Tablas de configuración que se sincronizan, en orden de dependencias (padres primero).
 * `scope` indica cómo filtrar por empresa/sucursal para la foto inicial.
 */
export const CONFIG_TABLES = [
  { table: "tenants", pk: ["id"], scope: "SELECT to_jsonb(cfg_row) FROM tenants cfg_row WHERE cfg_row.id = $T" },
  { table: "branches", pk: ["id"], scope: "SELECT to_jsonb(cfg_row) FROM branches cfg_row WHERE cfg_row.tenant_id = $T" },
  { table: "users", pk: ["id"], scope: "SELECT to_jsonb(cfg_row) FROM users cfg_row WHERE cfg_row.tenant_id = $T" },
  { table: "user_roles", pk: ["user_id", "branch_id", "role"], scope: "SELECT to_jsonb(cfg_row) FROM user_roles cfg_row WHERE cfg_row.branch_id = $B" },
  { table: "categories", pk: ["id"], scope: "SELECT to_jsonb(cfg_row) FROM categories cfg_row WHERE cfg_row.tenant_id = $T" },
  { table: "stations", pk: ["id"], scope: "SELECT to_jsonb(cfg_row) FROM stations cfg_row WHERE cfg_row.branch_id = $B" },
  { table: "products", pk: ["id"], scope: "SELECT to_jsonb(cfg_row) FROM products cfg_row WHERE cfg_row.tenant_id = $T" },
  { table: "product_stations", pk: ["product_id", "station_id"], scope: "SELECT to_jsonb(cfg_row) FROM product_stations cfg_row JOIN stations s ON s.id = cfg_row.station_id WHERE s.branch_id = $B" },
  { table: "modifier_groups", pk: ["id"], scope: "SELECT to_jsonb(cfg_row) FROM modifier_groups cfg_row WHERE cfg_row.tenant_id = $T" },
  { table: "modifiers", pk: ["id"], scope: "SELECT to_jsonb(cfg_row) FROM modifiers cfg_row JOIN modifier_groups g ON g.id = cfg_row.group_id WHERE g.tenant_id = $T" },
  { table: "product_modifier_groups", pk: ["product_id", "group_id"], scope: "SELECT to_jsonb(cfg_row) FROM product_modifier_groups cfg_row JOIN products p ON p.id = cfg_row.product_id WHERE p.tenant_id = $T" },
  { table: "product_availability", pk: ["product_id", "branch_id"], scope: "SELECT to_jsonb(cfg_row) FROM product_availability cfg_row WHERE cfg_row.branch_id = $B" },
  { table: "promotions", pk: ["id"], scope: "SELECT to_jsonb(cfg_row) FROM promotions cfg_row WHERE cfg_row.tenant_id = $T" },
  { table: "reasons", pk: ["id"], scope: "SELECT to_jsonb(cfg_row) FROM reasons cfg_row WHERE cfg_row.tenant_id = $T" },
  { table: "areas", pk: ["id"], scope: "SELECT to_jsonb(cfg_row) FROM areas cfg_row WHERE cfg_row.branch_id = $B" },
  { table: "tables", pk: ["id"], scope: "SELECT to_jsonb(cfg_row) FROM tables cfg_row WHERE cfg_row.branch_id = $B" },
  { table: "floor_fixtures", pk: ["id"], scope: "SELECT to_jsonb(cfg_row) FROM floor_fixtures cfg_row WHERE cfg_row.branch_id = $B" },
  { table: "warehouses", pk: ["id"], scope: "SELECT to_jsonb(cfg_row) FROM warehouses cfg_row WHERE cfg_row.branch_id = $B" },
  { table: "ingredients", pk: ["id"], scope: "SELECT to_jsonb(cfg_row) FROM ingredients cfg_row WHERE cfg_row.tenant_id = $T" },
  { table: "recipes", pk: ["id"], scope: "SELECT to_jsonb(cfg_row) FROM recipes cfg_row WHERE cfg_row.tenant_id = $T" },
  { table: "recipe_lines", pk: ["id"], scope: "SELECT to_jsonb(cfg_row) FROM recipe_lines cfg_row JOIN recipes r ON r.id = cfg_row.recipe_id WHERE r.tenant_id = $T" },
] as const;

export type ConfigTable = (typeof CONFIG_TABLES)[number]["table"];
export interface ConfigChange {
  table: ConfigTable;
  op: "upsert" | "delete";
  pk: Record<string, unknown>;
  data: Record<string, unknown> | null;
  changedAt: string;
}
const TABLES = new Set<string>(CONFIG_TABLES.map((t) => t.table));
export const isConfigTable = (t: string): t is ConfigTable => TABLES.has(t);

/** Foto completa de la configuración de una sucursal, en orden de dependencias. */
export async function configSnapshot(db: Db, tenantId: string, branchId: string): Promise<ConfigChange[]> {
  const now = new Date().toISOString();
  const out: ConfigChange[] = [];
  for (const t of CONFIG_TABLES) {
    const q = t.scope.replace("$T", "'" + tenantId.replace(/[^0-9a-f-]/gi, "") + "'::uuid").replace("$B", "'" + branchId.replace(/[^0-9a-f-]/gi, "") + "'::uuid");
    const rows = (await db.execute(sql.raw(q))) as unknown as { to_jsonb: Record<string, unknown> }[];
    for (const r of rows) out.push({ table: t.table, op: "upsert", pk: Object.fromEntries(t.pk.map((c) => [c, r.to_jsonb[c]])), data: r.to_jsonb, changedAt: now });
  }
  return out;
}

/**
 * Aplica cambios en una transacción. `silent`: no registrar (nodo recibiendo de la nube).
 * `origin`: dispositivo que originó el cambio (la nube no se lo regresa).
 */
export async function applyConfigChanges(db: Db, changes: ConfigChange[], opts: { silent: boolean; origin?: string | null }) {
  await db.transaction(async (tx) => {
    for (const c of changes) {
      if (!isConfigTable(c.table)) throw new Error(`Tabla no sincronizable: ${c.table}`);
      await tx.execute(sql`SELECT apply_config_change(${c.table}, ${c.op}, ${JSON.stringify(c.pk)}::jsonb, ${c.data ? JSON.stringify(c.data) : null}::jsonb, ${opts.silent}, ${opts.origin ?? null}::uuid)`);
    }
  });
}
