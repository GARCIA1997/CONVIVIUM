import { timestamp, uuid } from "drizzle-orm/pg-core";

/** Columnas comunes: id, tenant (aislamiento multi-tenant) y marcas de tiempo. */
export const id = () => uuid("id").primaryKey().defaultRandom();
export const tenantId = () => uuid("tenant_id").notNull();
export const branchId = () => uuid("branch_id").notNull();
export const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
export const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
