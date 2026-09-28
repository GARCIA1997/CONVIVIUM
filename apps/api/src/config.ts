import { z } from "zod";

const Env = z.object({
  CONVIVIUM_MODE: z.enum(["edge", "cloud"]).default("edge"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(16),
  CLOUD_URL: z.string().url().optional(),
  BRANCH_ID: z.string().optional(),
});

export const config = Env.parse(process.env);
export const isEdge = config.CONVIVIUM_MODE === "edge";
