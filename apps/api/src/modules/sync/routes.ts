import { schema } from "@convivium/db";
import { z } from "zod";
import type { ApiModule } from "../../lib/module.js";
import { forbidden, notImplemented } from "../../plugins/errors.js";

/**
 * Sincronización nodo (edge) ↔ nube (doc 05 §5).
 *  - Nube recibe lotes de eventos de cada nodo (idempotente por id).
 *  - Nube entrega configuración versionada (pendiente).
 */
const EventBatch = z.object({
  branchId: z.string().uuid(),
  events: z.array(
    z.object({
      id: z.string().uuid(),
      tenantId: z.string().uuid(),
      branchId: z.string().uuid().nullable(),
      type: z.string(),
      actorId: z.string().uuid().nullable(),
      authorizedBy: z.string().uuid().nullable(),
      deviceId: z.string().uuid().nullable(),
      entity: z.string(),
      entityId: z.string().uuid().nullable(),
      data: z.unknown(),
      createdAt: z.string(),
    }),
  ).max(1000),
});

const cloudPlugin: ApiModule["plugin"] = async (app) => {
  const tags = ["sync (nube)"];

  app.post("/events", { onRequest: [app.guard()], schema: { tags, body: EventBatch, response: { 200: z.object({ accepted: z.number() }) } } }, async (req) => {
    // Un nodo solo puede subir eventos de su propia empresa y sucursal.
    if (req.body.branchId !== req.user.branchId || req.body.events.some((e) => e.tenantId !== req.user.tenantId)) throw forbidden("Lote de otra sucursal");
    if (!req.body.events.length) return { accepted: 0 };
    const rows = await app.db
      .insert(schema.events)
      .values(req.body.events.map((e) => ({ ...e, data: e.data as object, createdAt: new Date(e.createdAt), syncedAt: new Date().toISOString() })))
      .onConflictDoNothing({ target: schema.events.id })
      .returning({ id: schema.events.id });
    // TODO: proyectar eventos a tablas de reporte consolidadas por sucursal (E9-06).
    return { accepted: rows.length };
  });

  app.get("/config", { onRequest: [app.guard()], schema: { tags, querystring: z.object({ sinceVersion: z.coerce.number().default(0) }) } }, async () => {
    throw notImplemented();
  });
};

export const syncCloudModule: ApiModule = { prefix: "sync", plugin: cloudPlugin, mode: "cloud" };
