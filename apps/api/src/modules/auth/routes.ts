import { auth } from "@convivium/contracts";
import { and, eq, gt, isNull, schema } from "@convivium/db";
import { permissionsOf, type Role } from "@convivium/domain";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { ApiModule } from "../../lib/module.js";
import { AppError } from "../../plugins/errors.js";

const plugin: ApiModule["plugin"] = async (app) => {
  const { db } = app;

  async function sessionFor(userId: string, branchId: string, tenantId: string, name: string, deviceId?: string) {
    const rows = await db.select().from(schema.userRoles).where(and(eq(schema.userRoles.userId, userId), eq(schema.userRoles.branchId, branchId)));
    const roles = rows.map((r) => r.role) as Role[];
    const accessToken = app.jwt.sign({ userId, tenantId, branchId, roles, deviceId });
    return { accessToken, user: { id: userId, name, roles }, permissions: [...permissionsOf(roles)], branchId };
  }

  /** E1-04 · Vincula un dispositivo del restaurante con código de 6 dígitos. */
  app.post("/devices/pair", { schema: { tags: ["auth"], security: [], body: auth.PairDeviceBody, response: { 200: auth.PairDeviceResponse } } }, async (req) => {
    const [pc] = await db.select().from(schema.pairingCodes).where(and(eq(schema.pairingCodes.code, req.body.code), gt(schema.pairingCodes.expiresAt, new Date())));
    if (!pc) throw new AppError(400, "invalid_code", "Código inválido o vencido");
    const [device] = await db
      .insert(schema.devices)
      .values({ tenantId: pc.tenantId, branchId: pc.branchId, name: req.body.name, kind: req.body.kind, tokenHash: "jwt" })
      .returning();
    const deviceToken = app.jwt.sign({ userId: "", tenantId: pc.tenantId, branchId: pc.branchId, roles: [], deviceId: device!.id }, { expiresIn: "365d" });
    return { deviceId: device!.id, deviceToken, branchId: pc.branchId };
  });

  /** Usuarios de la sucursal para la pantalla de PIN (requiere dispositivo vinculado). */
  app.get("/devices/users", {
    onRequest: [app.guard()],
    schema: { tags: ["auth"], response: { 200: z.array(z.object({ id: z.string(), name: z.string() })) } },
  }, async (req) => {
    const rows = await db
      .selectDistinct({ id: schema.users.id, name: schema.users.name })
      .from(schema.users)
      .innerJoin(schema.userRoles, eq(schema.userRoles.userId, schema.users.id))
      .where(and(eq(schema.userRoles.branchId, req.user.branchId), eq(schema.users.active, true)));
    return rows;
  });

  /** E1-03 · Login por PIN desde un dispositivo vinculado. */
  app.post("/pin", { onRequest: [app.guard()], schema: { tags: ["auth"], body: auth.PinLoginBody, response: { 200: auth.Session } } }, async (req) => {
    if (!req.user.deviceId) throw new AppError(401, "device_required", "Se requiere un dispositivo vinculado");
    const [device] = await db.select().from(schema.devices).where(and(eq(schema.devices.id, req.user.deviceId), isNull(schema.devices.revokedAt)));
    if (!device) throw new AppError(401, "device_revoked", "Dispositivo revocado");
    const [user] = await db.select().from(schema.users).where(and(eq(schema.users.id, req.body.userId), eq(schema.users.active, true)));
    if (!user?.pinHash || !(await bcrypt.compare(req.body.pin, user.pinHash))) throw new AppError(401, "bad_pin", "PIN incorrecto");
    return sessionFor(user.id, device.branchId, device.tenantId, user.name, device.id);
  });

  /** Login remoto (dueño/gerente) con correo y contraseña. */
  app.post("/login", { schema: { tags: ["auth"], security: [], body: auth.EmailLoginBody, response: { 200: auth.Session } } }, async (req) => {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, req.body.email));
    if (!user?.passwordHash || !(await bcrypt.compare(req.body.password, user.passwordHash))) throw new AppError(401, "bad_credentials", "Credenciales incorrectas");
    const [role] = await db.select().from(schema.userRoles).where(eq(schema.userRoles.userId, user.id));
    if (!role) throw new AppError(403, "no_branch", "Usuario sin sucursal");
    return sessionFor(user.id, role.branchId, user.tenantId, user.name);
  });

  app.get("/me", { onRequest: [app.guard()], schema: { tags: ["auth"] } }, async (req) => ({ ...req.user, permissions: [...permissionsOf(req.user.roles)] }));
};

export const authModule: ApiModule = { prefix: "auth", plugin };
