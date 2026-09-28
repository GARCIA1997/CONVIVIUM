import jwt from "@fastify/jwt";
import { can, type Permission, type Role } from "@convivium/domain";
import type { FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { config } from "../config.js";
import { forbidden } from "./errors.js";

export interface Principal {
  userId: string;
  tenantId: string;
  branchId: string;
  roles: Role[];
  deviceId?: string;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: Principal;
    user: Principal;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    /** preHandler: exige sesión y, opcionalmente, un permiso. */
    guard: (permission?: Permission) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(async (app) => {
  await app.register(jwt, { secret: config.JWT_SECRET, sign: { expiresIn: "12h" } });
  app.decorate("guard", (permission?: Permission) => async (req: FastifyRequest) => {
    await req.jwtVerify();
    if (permission && !can(req.user.roles, permission)) throw forbidden(`Requiere permiso ${permission}`);
  });
});
