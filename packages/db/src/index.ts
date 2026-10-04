import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

export { schema };
export * from "drizzle-orm";

export function createDb(url: string) {
  const client = postgres(url, { max: 10 });
  return drizzle(client, { schema });
}
export type Db = ReturnType<typeof createDb>;
export * from "./sync.js";
export { branchCode, BRANCH_CODE_RE } from "./branch-code.js";
export { runMigrations } from "./migrate.js";
