import { createDb, type Db } from "@convivium/db";
import fp from "fastify-plugin";
import { config } from "../config.js";

declare module "fastify" {
  interface FastifyInstance {
    db: Db;
  }
}

export default fp(async (app) => {
  app.decorate("db", createDb(config.DATABASE_URL));
});
