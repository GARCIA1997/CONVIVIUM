import jwt from "@fastify/jwt";
import { schema, eq } from "@convivium/db";
import { can, DEFAULT_DISCOUNT_CAP, type Permission, type Role, type RoleOverrides } from "@convivium/domain";
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
    /** Política de la empresa: ajustes de permisos por rol y topes de descuento (E1-05, E1-07). */
    policy: {
      get(tenantId: string): Promise<Policy>;
      can(p: { tenantId: string; roles: Role[] }, permission: Permission): Promise<boolean>;
      invalidate(tenantId: string): void;
    };
  }
}

export interface Policy {
  overrides: RoleOverrides;
  caps: Record<Role, number | null>;
}

export default fp(async (app) => {
  const cache = new Map<string, Policy>();
  const policy = {
    async get(tenantId: string) {
      let p = cache.get(tenantId);
      if (!p) {
        const [t] = await app.db.select({ rp: schema.tenants.rolePermissions, caps: schema.tenants.discountCaps }).from(schema.tenants).where(eq(schema.tenants.id, tenantId));
        p = { overrides: (t?.rp ?? {}) as RoleOverrides, caps: { ...DEFAULT_DISCOUNT_CAP, ...(t?.caps ?? {}) } as Policy["caps"] };
        cache.set(tenantId, p);
      }
      return p;
    },
    async can(who: { tenantId: string; roles: Role[] }, permission: Permission) {
      return can(who.roles, permission, (await policy.get(who.tenantId)).overrides);
    },
    invalidate: (tenantId: string) => void cache.delete(tenantId),
  };
  app.decorate("policy", policy);
  await app.register(jwt, { secret: config.JWT_SECRET, sign: { expiresIn: "12h" } });
  app.decorate("guard", (permission?: Permission) => async (req: FastifyRequest) => {
    await req.jwtVerify();
    if (permission && !(await policy.can(req.user, permission))) throw forbidden(`Requiere permiso ${permission}`);
  });
});
