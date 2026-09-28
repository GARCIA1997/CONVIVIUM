import { schema, type Db } from "@convivium/db";
import type { Principal } from "../plugins/auth.js";

/** Registra un evento inmutable (bitácora E1-06 + log de sincronización). */
export async function recordEvent(
  db: Db,
  who: Principal,
  e: { type: string; entity: string; entityId?: string; data: unknown; authorizedBy?: string },
) {
  await db.insert(schema.events).values({
    tenantId: who.tenantId,
    branchId: who.branchId,
    actorId: who.userId,
    deviceId: who.deviceId,
    type: e.type,
    entity: e.entity,
    entityId: e.entityId,
    data: e.data as object,
    authorizedBy: e.authorizedBy,
  });
}
