import { z } from "zod";
import type { ApiModule } from "../../lib/module.js";
import { notImplemented } from "../../plugins/errors.js";

/**
 * Sincronización nodo (edge) ↔ nube (doc 05 §5).
 *  - Nube: recibe lotes de eventos de cada nodo y entrega configuración versionada.
 *  - Nodo: worker que sube eventos con synced_at nulo y baja configuración.
 */
const EventBatch = z.object({
  branchId: z.string().uuid(),
  events: z.array(z.object({ id: z.string().uuid(), type: z.string(), entity: z.string(), entityId: z.string().nullable(), data: z.unknown(), createdAt: z.string() })),
});

const cloudPlugin: ApiModule["plugin"] = async (app) => {
  const tags = ["sync (nube)"];
  app.post("/events", { onRequest: [app.guard()], schema: { tags, body: EventBatch } }, async () => { throw notImplemented(); });
  app.get("/config", { onRequest: [app.guard()], schema: { tags, querystring: z.object({ sinceVersion: z.coerce.number().default(0) }) } }, async () => { throw notImplemented(); });
};

export const syncCloudModule: ApiModule = { prefix: "sync", plugin: cloudPlugin, mode: "cloud" };
