import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import { jsonSchemaTransform, serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { config, isEdge } from "./config.js";
import { modules } from "./modules/index.js";
import authPlugin from "./plugins/auth.js";
import dbPlugin from "./plugins/db.js";
import errorsPlugin from "./plugins/errors.js";
import realtimePlugin from "./plugins/realtime.js";
import webPlugin from "./plugins/web.js";
import { startSyncWorker } from "./lib/sync-worker.js";
import { publicMenuRoutes } from "./modules/menus/routes.js";

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      // Nunca registrar tokens: el WebSocket los recibe en la query.
      serializers: { req: (req) => ({ method: req.method, url: req.url.replace(/token=[^&]+/, "token=[redactado]") }) },
    },
  }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cors, { origin: true });
  await app.register(swagger, {
    openapi: {
      info: { title: "CONVIVIUM API", version: "0.1.0", description: `Modo ${config.CONVIVIUM_MODE}` },
      components: { securitySchemes: { bearer: { type: "http", scheme: "bearer" } } },
      security: [{ bearer: [] }],
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  await app.register(errorsPlugin);
  await app.register(dbPlugin);
  await app.register(authPlugin);
  await app.register(realtimePlugin);

  app.get("/health", { schema: { hide: true } }, async () => ({ ok: true, mode: config.CONVIVIUM_MODE }));

  for (const mod of modules) {
    // Algunos módulos solo existen en un modo (p. ej. sync ingest en la nube).
    if (mod.mode && mod.mode !== (isEdge ? "edge" : "cloud")) continue;
    await app.register(mod.plugin, { prefix: `/v1/${mod.prefix}` });
  }
  await app.register(publicMenuRoutes);
  await app.register(webPlugin);
  if (isEdge) startSyncWorker(app);
  return app;
}

export type App = Awaited<ReturnType<typeof buildServer>>;
