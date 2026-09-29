/**
 * Bases de prueba desechables (se recrean y migran una vez por corrida):
 *  - convivium_test: API y nube, con seed de demo.
 *  - convivium_test_node: nodo vacío para probar la sincronización.
 * Requiere Postgres local con el usuario convivium (ver docs/06 §4).
 */
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const ADMIN = "postgres://convivium:convivium@localhost:5432/convivium";
const TEST_DB = "postgres://convivium:convivium@localhost:5432/convivium_test";
const dbDir = resolve(import.meta.dirname, "../../../packages/db");

export default function setup() {
  const psql = (sql: string) => execSync(`psql "${ADMIN}" -qAtc "${sql}"`, { stdio: "pipe" });
  for (const db of ["convivium_test", "convivium_test_node"]) {
    psql(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`);
    psql(`CREATE DATABASE ${db}`);
    execSync("npx drizzle-kit migrate", { cwd: dbDir, env: { ...process.env, DATABASE_URL: ADMIN.replace(/convivium$/, db) }, stdio: "pipe" });
  }
  const env = { ...process.env, DATABASE_URL: TEST_DB };
  execSync("npx tsx src/seed.ts && npx tsx src/seed-inventory.ts", { cwd: dbDir, env, stdio: "pipe" });
}
