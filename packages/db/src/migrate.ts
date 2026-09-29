import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/** Carpeta de migraciones versionadas (packages/db/migrations). */
export const MIGRATIONS_DIR = fileURLToPath(new URL("../migrations", import.meta.url));

/**
 * Aplica las migraciones pendientes (idempotente). La API la ejecuta al arrancar para que una
 * instalación nueva o una actualización quede lista sin pasos manuales.
 */
export async function runMigrations(url: string) {
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_DIR });
  } finally {
    await client.end();
  }
}
