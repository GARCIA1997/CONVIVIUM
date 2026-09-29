import { runMigrations } from "@convivium/db";
import { config } from "./config.js";
import { buildServer } from "./server.js";

if (config.AUTO_MIGRATE) await runMigrations(config.DATABASE_URL);

const app = await buildServer();
await app.listen({ port: config.PORT, host: "0.0.0.0" });
app.log.info(`CONVIVIUM API en modo ${config.CONVIVIUM_MODE} · docs en /docs`);
