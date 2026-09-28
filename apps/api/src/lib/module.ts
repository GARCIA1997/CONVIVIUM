import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

export interface ApiModule {
  /** Ruta base: /v1/<prefix> */
  prefix: string;
  plugin: FastifyPluginAsyncZod;
  /** Si se define, el módulo solo se monta en ese modo. */
  mode?: "edge" | "cloud";
}
