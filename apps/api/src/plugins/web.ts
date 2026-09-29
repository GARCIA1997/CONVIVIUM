import fastifyStatic from "@fastify/static";
import fp from "fastify-plugin";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { config, isEdge } from "../config.js";

/**
 * Sirve las PWA compiladas: en el nodo local las 4 apps; en la nube solo admin.
 * Busca /srv/web/<app> (imagen Docker) o apps/<app>/dist (desarrollo).
 */
export default fp(async (app) => {
  const apps = isEdge ? ["mesero", "estacion", "caja", "admin"] : ["admin"];
  const root = config.WEB_ROOT;
  let first = true;
  for (const name of apps) {
    const dir = [root && join(root, name), resolve(import.meta.dirname, `../../../${name}/dist`)].find((d) => d && existsSync(d));
    if (!dir) continue;
    await app.register(fastifyStatic, { root: dir, prefix: `/${name}/`, decorateReply: first, wildcard: false });
    first = false;
    // Fallback SPA: rutas del cliente devuelven index.html
    app.get(`/${name}/*`, { schema: { hide: true } }, (_req, reply) => reply.sendFile("index.html", dir));
    app.log.info(`PWA /${name}/ ← ${dir}`);
  }
  app.get("/", { schema: { hide: true } }, (_req, reply) => reply.redirect(isEdge ? "/mesero/" : "/admin/"));

  // Manual de uso para el cliente (docs/sitio-cliente), en /ayuda/.
  const manual = resolve(import.meta.dirname, "../../../../docs/sitio-cliente/index.html");
  if (existsSync(manual)) {
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">${readFileSync(manual, "utf8")}`;
    app.get("/ayuda", { schema: { hide: true } }, (_req, reply) => reply.redirect("/ayuda/"));
    app.get("/ayuda/", { schema: { hide: true } }, (_req, reply) => reply.type("text/html; charset=utf-8").header("cache-control", "public, max-age=300").send(html));
  }
});
