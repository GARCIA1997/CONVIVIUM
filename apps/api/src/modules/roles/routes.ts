import { and, eq, schema, sql } from "@convivium/db";
import { childrenOf, LOCKED_OWNER, ownPermissions, PERMISSIONS, roleEffective, ROLES, type Role, type RoleOverrides } from "@convivium/domain";
import { z } from "zod";
import { recordEvent } from "../../lib/audit.js";
import type { ApiModule } from "../../lib/module.js";
import { AppError } from "../../plugins/errors.js";

/** E1-07 · Editor de roles: ajustes de permisos y topes por rol para toda la empresa. */
const plugin: ApiModule["plugin"] = async (app) => {
  const { db } = app;
  const tags = ["roles"];

  app.get("/", { onRequest: [app.guard("usuarios.gestionar")], schema: { tags } }, async (req) => {
    const { overrides, caps } = await app.policy.get(req.user.tenantId);
    const counts = await db
      .select({ role: schema.userRoles.role, n: sql<number>`count(distinct ${schema.userRoles.userId})::int` })
      .from(schema.userRoles)
      .innerJoin(schema.users, and(eq(schema.users.id, schema.userRoles.userId), eq(schema.users.active, true)))
      .where(eq(schema.userRoles.branchId, req.user.branchId))
      .groupBy(schema.userRoles.role);
    return ROLES.map((role) => {
      const inherited = new Set<string>();
      for (const c of childrenOf(role)) for (const p of roleEffective(c, overrides)) inherited.add(p);
      return {
        role,
        children: childrenOf(role),
        inherited: [...inherited],
        own: ownPermissions(role),
        grant: overrides[role]?.grant ?? [],
        deny: overrides[role]?.deny ?? [],
        effective: [...roleEffective(role, overrides)],
        cap: caps[role],
        users: counts.find((c) => c.role === role)?.n ?? 0,
      };
    });
  });

  app.put("/:role", {
    onRequest: [app.guard("roles.gestionar")],
    schema: { tags, params: z.object({ role: z.enum(ROLES) }), body: z.object({ grant: z.array(z.enum(PERMISSIONS)), deny: z.array(z.enum(PERMISSIONS)), cap: z.number().int().min(0).max(100).nullable() }) },
  }, async (req) => {
    const role = req.params.role as Role;
    const { grant, deny, cap } = req.body;
    if (role === "dueno" && deny.some((p) => LOCKED_OWNER.includes(p))) throw new AppError(400, "locked", "El Dueño siempre conserva la gestión de usuarios y roles");
    const [t] = await db.select({ rp: schema.tenants.rolePermissions, caps: schema.tenants.discountCaps }).from(schema.tenants).where(eq(schema.tenants.id, req.user.tenantId));
    const rp: RoleOverrides = { ...((t?.rp ?? {}) as RoleOverrides) };
    const before = { ...rp[role], cap: (t?.caps ?? {})[role] };
    // Solo guardamos diferencias reales respecto a la base.
    const own = new Set(ownPermissions(role));
    rp[role] = { grant: grant.filter((p) => !own.has(p) && !deny.includes(p)), deny };
    await db.update(schema.tenants).set({ rolePermissions: rp, discountCaps: { ...(t?.caps ?? {}), [role]: cap } }).where(eq(schema.tenants.id, req.user.tenantId));
    app.policy.invalidate(req.user.tenantId);
    await recordEvent(db, req.user, { type: "role.updated", entity: "role", entityId: undefined, data: { role, before, after: { ...rp[role], cap } } });
    return { ok: true };
  });

  /** Restaurar el rol a su configuración base. */
  app.delete("/:role", { onRequest: [app.guard("roles.gestionar")], schema: { tags, params: z.object({ role: z.enum(ROLES) }) } }, async (req) => {
    const role = req.params.role as Role;
    const [t] = await db.select({ rp: schema.tenants.rolePermissions, caps: schema.tenants.discountCaps }).from(schema.tenants).where(eq(schema.tenants.id, req.user.tenantId));
    const rp = { ...((t?.rp ?? {}) as RoleOverrides) }; delete rp[role];
    const caps = { ...(t?.caps ?? {}) }; delete caps[role];
    await db.update(schema.tenants).set({ rolePermissions: rp, discountCaps: caps }).where(eq(schema.tenants.id, req.user.tenantId));
    app.policy.invalidate(req.user.tenantId);
    await recordEvent(db, req.user, { type: "role.reset", entity: "role", data: { role } });
    return { ok: true };
  });
};

export const rolesModule: ApiModule = { prefix: "roles", plugin };
