import { asc, inArray, isNull, schema } from "@convivium/db";
import type { FastifyInstance } from "fastify";
import { config } from "../config.js";

/**
 * Nodo → nube (doc 05 §5). Sube en lotes los eventos no sincronizados y los marca.
 * Idempotente: la nube ignora IDs repetidos. Si no hay internet, reintenta en el siguiente ciclo.
 */
export function startSyncWorker(app: FastifyInstance) {
  if (!config.CLOUD_URL || !config.NODE_TOKEN || !config.BRANCH_ID) {
    app.log.warn("Sync deshabilitado: faltan CLOUD_URL, NODE_TOKEN o BRANCH_ID");
    return;
  }
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      while (true) {
        const batch = await app.db.select().from(schema.events).where(isNull(schema.events.syncedAt)).orderBy(asc(schema.events.seq)).limit(500);
        if (!batch.length) break;
        const res = await fetch(`${config.CLOUD_URL}/v1/sync/events`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${config.NODE_TOKEN}` },
          body: JSON.stringify({
            branchId: config.BRANCH_ID,
            events: batch.map((e) => ({ ...e, createdAt: e.createdAt.toISOString(), syncedAt: undefined, seq: undefined })),
          }),
        });
        if (!res.ok) throw new Error(`nube respondió ${res.status}`);
        await app.db.update(schema.events).set({ syncedAt: new Date().toISOString() }).where(inArray(schema.events.id, batch.map((e) => e.id)));
        app.log.info(`sync: ${batch.length} eventos subidos`);
      }
    } catch (err) {
      app.log.warn(`sync pendiente (sin conexión con la nube): ${(err as Error).message}`);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, config.SYNC_INTERVAL_MS);
  app.addHook("onClose", async () => clearInterval(timer));
}
