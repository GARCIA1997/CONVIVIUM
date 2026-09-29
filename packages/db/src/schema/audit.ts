import { bigserial, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createdAt, tenantId } from "./_shared";

/**
 * Bitácora inmutable (E1-06) y log de sincronización nodo ↔ nube.
 * Solo INSERT; la migración revoca UPDATE/DELETE para el rol de la aplicación.
 */
export const events = pgTable("events", {
  seq: bigserial("seq", { mode: "number" }).primaryKey(),
  id: uuid("id").notNull().unique().defaultRandom(),
  tenantId: tenantId(),
  branchId: uuid("branch_id"),
  type: text("type").notNull(),
  actorId: uuid("actor_id"),
  authorizedBy: uuid("authorized_by"),
  deviceId: uuid("device_id"),
  entity: text("entity").notNull(),
  entityId: uuid("entity_id"),
  data: jsonb("data").notNull(),
  createdAt: createdAt(),
  /** Nulo mientras el evento no se ha subido a la nube (solo en modo edge). */
  syncedAt: text("synced_at"),
});

/**
 * Registro de cambios de configuración (doc 05 §5). Lo llena un trigger en cada tabla de configuración;
 * la nube lo sirve a los nodos y los nodos le suben el suyo. Los cambios aplicados por la
 * sincronización no se vuelven a registrar en el nodo (sin eco).
 */
export const configChanges = pgTable("config_changes", {
  seq: bigserial("seq", { mode: "number" }).primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  /** Nulo = aplica a toda la empresa. */
  branchId: uuid("branch_id"),
  tableName: text("table_name").notNull(),
  pk: jsonb("pk").$type<Record<string, unknown>>().notNull(),
  op: text("op").$type<"upsert" | "delete">().notNull(),
  data: jsonb("data").$type<Record<string, unknown>>(),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  /** config: nube ↔ nodo · ops: operación de la sucursal, solo sube del nodo a la nube (reportes consolidados). */
  kind: text("kind").$type<"config" | "ops">().notNull().default("config"),
  /** Dispositivo (nodo) que originó el cambio; la nube no se lo regresa. */
  originDevice: uuid("origin_device"),
});

/** Cursores de sincronización del nodo (clave → valor). */
export const syncState = pgTable("sync_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
