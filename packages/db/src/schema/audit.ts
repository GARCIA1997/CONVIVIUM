import { bigserial, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
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
