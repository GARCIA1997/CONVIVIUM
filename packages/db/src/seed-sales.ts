/**
 * Ventas de demostración (35 días de cuentas cobradas) para reportes e ingeniería de menú. NO usar en producción.
 * Las cuentas quedan con nombre "DEMO" para poder borrarlas.
 * Uso:    pnpm --filter @convivium/db seed:ventas
 * Borrar: pnpm --filter @convivium/db seed:ventas -- --limpiar
 */
import { and, eq, inArray } from "drizzle-orm";
import { createDb, schema } from "./index.js";

const db = createDb(process.env.DATABASE_URL ?? "postgres://convivium:convivium@localhost:5432/convivium");

// Generador determinista: mismas ventas en cada corrida.
let s = 20260929;
const rnd = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

async function main() {
  const [tenant] = await db.select().from(schema.tenants).limit(1);
  const [branch] = await db.select().from(schema.branches).where(eq(schema.branches.tenantId, tenant!.id));
  const demo = await db.select({ id: schema.checks.id }).from(schema.checks).where(and(eq(schema.checks.branchId, branch!.id), eq(schema.checks.name, "DEMO")));
  if (demo.length) {
    const ids = demo.map((d) => d.id);
    await db.delete(schema.orderItems).where(inArray(schema.orderItems.checkId, ids));
    await db.delete(schema.checks).where(inArray(schema.checks.id, ids));
    console.log(`Borradas ${ids.length} cuentas DEMO`);
  }
  if (process.argv.includes("--limpiar")) return process.exit(0);

  const products = (await db.select().from(schema.products).where(and(eq(schema.products.tenantId, tenant!.id), eq(schema.products.active, true))));
  const routes = await db.select().from(schema.productStations);
  const [waiter] = await db.select().from(schema.users).where(eq(schema.users.tenantId, tenant!.id)).limit(1);
  const tables = await db.select().from(schema.tables).where(eq(schema.tables.branchId, branch!.id));
  // Popularidad distinta por producto para que la matriz tenga los cuatro cuadrantes.
  const weight = new Map(products.map((p, i) => [p.id, [8, 1, 5, 2, 6, 1.5, 3, 0.7, 4, 1][i % 10]!]));
  const total = [...weight.values()].reduce((a, b) => a + b, 0);
  const pick = () => { let r = rnd() * total; for (const p of products) { r -= weight.get(p.id)!; if (r <= 0) return p; } return products[0]!; };

  let checks = 0, items = 0;
  for (let d = 35; d >= 1; d--) {
    const n = 18 + Math.floor(rnd() * 20);
    for (let c = 0; c < n; c++) {
      const opened = new Date(Date.now() - d * 86_400_000); opened.setHours(13 + Math.floor(rnd() * 9), Math.floor(rnd() * 60), 0, 0);
      const closed = new Date(opened.getTime() + (40 + rnd() * 60) * 60_000);
      const table = tables[Math.floor(rnd() * tables.length)];
      const [chk] = await db.insert(schema.checks).values({ tenantId: tenant!.id, branchId: branch!.id, kind: "mesa", tableId: table?.id ?? null, name: "DEMO", guests: 1 + Math.floor(rnd() * 5), waiterId: waiter!.id, status: "cobrada", openedAt: opened, closedAt: closed }).returning();
      const lines = 2 + Math.floor(rnd() * 5);
      const rows = [];
      for (let l = 0; l < lines; l++) {
        const p = pick();
        const station = routes.find((r) => r.productId === p.id)?.stationId;
        if (!station) continue;
        const at = new Date(opened.getTime() + l * 4 * 60_000);
        rows.push({ tenantId: tenant!.id, branchId: branch!.id, checkId: chk!.id, productId: p.id, productName: p.name, stationId: station, quantity: 1 + Math.floor(rnd() * 2), unitPrice: p.price, state: "entregado" as const, targetPrepSec: p.targetPrepSec, createdBy: waiter!.id, createdAt: at, sentAt: at, readyAt: new Date(at.getTime() + p.targetPrepSec * 900), deliveredAt: new Date(at.getTime() + p.targetPrepSec * 1000) });
      }
      if (rows.length) { await db.insert(schema.orderItems).values(rows); items += rows.length; }
      checks++;
    }
  }
  console.log(`Ventas DEMO: ${checks} cuentas cobradas, ${items} renglones en 35 días`);
  process.exit(0);
}
main();
