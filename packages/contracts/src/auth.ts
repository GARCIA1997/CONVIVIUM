import { z } from "zod";
import { ROLES } from "@convivium/domain";
import { Id } from "./common.js";

export const Role = z.enum(ROLES);

/** E1-04: vincular un dispositivo del restaurante con un código de 6 dígitos. */
export const PairDeviceBody = z.object({
  code: z.string().regex(/^\d{6}$/),
  name: z.string().min(1).max(60),
  kind: z.enum(["mesero", "kds_tv", "estacion_tactil", "caja", "admin", "nodo"]),
});
export const PairDeviceResponse = z.object({ deviceId: Id, deviceToken: z.string(), branchId: Id });

/** E1-03: login rápido por PIN en dispositivo vinculado. */
export const PinLoginBody = z.object({ userId: Id, pin: z.string().regex(/^\d{4,6}$/) });

/** Login remoto (dueño/gerente fuera del local) con correo. */
export const EmailLoginBody = z.object({ email: z.string().email(), password: z.string().min(8) });

export const Session = z.object({
  accessToken: z.string(),
  user: z.object({ id: Id, name: z.string(), roles: z.array(Role) }),
  permissions: z.array(z.string()),
  branchId: Id,
});
export type Session = z.infer<typeof Session>;
