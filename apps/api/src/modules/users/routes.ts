import { and, eq, inArray, schema } from "@convivium/db";
import { can, ROLES, type Role } from "@convivium/domain";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { recordEvent } from "../../lib/audit.js";
import type { ApiModule } from "../../lib/module.js";
import { AppError } from "../../plugins/errors.js";

/** Roles que solo el Dueño puede otorgar o quitar (evita que un Gerente se escale). */
const PRIVILEGED: Role[] = ["dueno", "gerente"];
const RoleList = z.array(z.enum(ROLES)).min(1);
const Pin = z.string().regex(/^\d{4,6}$/, "El PIN debe tener de 4 a 6 dígitos");

const plugin: ApiModule["plugin"] = async (app) => {
  const { db } = app;
  const tags = ["usuarios"];
  const guard = { onRequest: [app.guard("usuarios.gestionar")] };

  function checkEscalation(actor: Role[], touched: Role[]) {
    if (touched.some((r) => PRIVILEGED.includes(r)) && !can(actor, "roles.gestionar"))
      throw new AppError(403, "forbidden", "Solo el Dueño puede asignar los roles Dueño o Gerente");
  }

  /** E1-02 · Personal de la sucursal con sus roles. */
  app.get("/", { ...guard, schema: { tags } }, async (req) => {
    const rows = await db
      .select({ id: schema.users.id, name: schema.users.name, active: schema.users.active, hasPin: schema.users.pinHash, role: schema.userRoles.role })
      .from(schema.users)
      .leftJoin(schema.userRoles, and(eq(schema.userRoles.userId, schema.users.id), eq(schema.userRoles.branchId, req.user.branchId)))
      .where(eq(schema.users.tenantId, req.user.tenantId));
    const byId = new Map<string, { id: string; name: string; active: boolean; hasPin: boolean; roles: Role[]}>();
    for (const r of rows) {
      const u = byId.get(r.id) ?? { id: r.id, name: r.name, active: r.active, hasPin: !!r.hasPin, roles: [] };
      if (r.role) u.roles.push(r.role as Role);
      byId.set(r.id, u);
    }
    return [...byId.values()].filter((u) => u.roles.length > 0 || !u.active).sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  });

  app.post("/", { ...guard, schema: { tags, body: z.object({ name: z.string().trim().min(2), roles: RoleList, pin: Pin }) } }, async (req) => {
    checkEscalation(req.user.roles, req.body.roles);
    const [u] = await db.insert(schema.users).values({ tenantId: req.user.tenantId, name: req.body.name, pinHash: await bcrypt.hash(req.body.pin, 10) }).returning({ id: schema.users.id });
    await db.insert(schema.userRoles).values(req.body.roles.map((role) => ({ userId: u!.id, branchId: req.user.branchId, role })));
    await recordEvent(db, req.user, { type: "user.created", entity: "user", entityId: u!.id, data: { name: req.body.name, roles: req.body.roles } });
    return { id: u!.id };
  });

  app.put("/:id", { ...guard, schema: { tags, params: z.object({ id: z.string().uuid() }), body: z.object({ name: z.string().trim().min(2), roles: RoleList, active: z.boolean() }) } }, async (req) => {
    const { id } = req.params;
    const [u] = await db.select().from(schema.users).where(and(eq(schema.users.id, id), eq(schema.users.tenantId, req.user.tenantId)));
    if (!u) throw new AppError(404, "not_found", "Usuario no encontrado");
    const before = (await db.select().from(schema.userRoles).where(and(eq(schema.userRoles.userId, id), eq(schema.userRoles.branchId, req.user.branchId)))).map((r) => r.role as Role);
    const changed = [...before.filter((r) => !req.body.roles.includes(r)), ...req.body.roles.filter((r) => !before.includes(r))];
    checkEscalation(req.user.roles, before.includes("dueno") || before.includes("gerente") ? [...changed, ...before] : changed);
    if (id === req.user.userId && !req.body.active) throw new AppError(400, "self", "No puedes desactivar tu propio usuario");
    await db.transaction(async (tx) => {
      await tx.update(schema.users).set({ name: req.body.name, active: req.body.active }).where(eq(schema.users.id, id));
      await tx.delete(schema.userRoles).where(and(eq(schema.userRoles.userId, id), eq(schema.userRoles.branchId, req.user.branchId)));
      await tx.insert(schema.userRoles).values(req.body.roles.map((role) => ({ userId: id, branchId: req.user.branchId, role })));
    });
    await recordEvent(db, req.user, { type: "user.updated", entity: "user", entityId: id, data: { before: { name: u.name, roles: before, active: u.active }, after: req.body } });
    return { ok: true };
  });

  /** Cambio de PIN (el nuevo PIN nunca se guarda ni se registra en claro). */
  app.post("/:id/pin", { ...guard, schema: { tags, params: z.object({ id: z.string().uuid() }), body: z.object({ pin: Pin }) } }, async (req) => {
    const roles = (await db.select().from(schema.userRoles).where(and(eq(schema.userRoles.userId, req.params.id), inArray(schema.userRoles.role, PRIVILEGED)))).map((r) => r.role as Role);
    if (req.params.id !== req.user.userId) checkEscalation(req.user.roles, roles);
    const r = await db.update(schema.users).set({ pinHash: await bcrypt.hash(req.body.pin, 10) }).where(and(eq(schema.users.id, req.params.id), eq(schema.users.tenantId, req.user.tenantId))).returning({ id: schema.users.id });
    if (!r.length) throw new AppError(404, "not_found", "Usuario no encontrado");
    await recordEvent(db, req.user, { type: "user.pin_changed", entity: "user", entityId: req.params.id, data: {} });
    return { ok: true };
  });
};

export const usersModule: ApiModule = { prefix: "users", plugin };
