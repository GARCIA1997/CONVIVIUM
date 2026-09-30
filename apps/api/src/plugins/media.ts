import fastifyStatic from "@fastify/static";
import fp from "fastify-plugin";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../config.js";

/** Carpeta absoluta de fotos de platillos. */
export const mediaDir = resolve(config.MEDIA_DIR);

/** Sirve las fotos subidas en /media/ (menú digital, admin). */
export default fp(async (app) => {
  mkdirSync(mediaDir, { recursive: true });
  await app.register(fastifyStatic, { root: mediaDir, prefix: "/media/", decorateReply: false, maxAge: "7d", immutable: true });
});
