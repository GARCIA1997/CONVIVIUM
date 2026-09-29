import { z } from "zod";

const Env = z.object({
  CONVIVIUM_MODE: z.enum(["edge", "cloud"]).default("edge"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(16),
  CLOUD_URL: z.string().url().optional(),
  BRANCH_ID: z.string().optional(),
  /** Carpeta con las PWA compiladas (/srv/web en Docker). */
  WEB_ROOT: z.string().optional(),
  /** Token del nodo para autenticarse con la nube (se obtiene al vincular el nodo). */
  NODE_TOKEN: z.string().optional(),
  SYNC_INTERVAL_MS: z.coerce.number().default(10_000),
});

export const config = Env.parse(process.env);
export const isEdge = config.CONVIVIUM_MODE === "edge";
