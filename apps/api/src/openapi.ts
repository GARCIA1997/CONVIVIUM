/** Genera docs/openapi.json a partir de las rutas (sin levantar el servidor). */
import { writeFileSync } from "node:fs";
import { buildServer } from "./server.js";

const app = await buildServer();
await app.ready();
writeFileSync(new URL("../../../docs/openapi.json", import.meta.url), JSON.stringify(app.swagger(), null, 2));
console.log("docs/openapi.json generado");
await app.close();
