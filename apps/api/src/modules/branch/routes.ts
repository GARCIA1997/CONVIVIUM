import { eq, schema } from "@convivium/db";
import { z } from "zod";
import { recordEvent } from "../../lib/audit.js";
import type { ApiModule } from "../../lib/module.js";
import { notFound } from "../../plugins/errors.js";

const Body = z.object({
  name: z.string().trim().min(2).max(80),
  timezone: z.string().refine((tz) => { try { new Intl.DateTimeFormat("es-MX", { timeZone: tz }); return true; } catch { return false; } }, "Zona horaria inválida"),
  ivaPct: z.union([z.literal(16), z.literal(8)]),
  /** Centavos de MXN por 1 USD; nulo = no se aceptan dólares. */
  usdRate: z.number().int().min(100).max(10_000).nullable(),
  /** E1-03 · Minutos sin actividad antes de pedir PIN otra vez. Opcional para no romper clientes anteriores. */
  idleMinutes: z
    .object({ mesero: z.number().int().min(1).max(60), caja: z.number().int().min(1).max(240), estacion: z.number().int().min(1).max(1440) })
    .optional(),
});

/** Configuración de la sucursal: nombre, zona horaria, IVA (16 % u 8 % frontera) y tipo de cambio. */
const plugin: ApiModule["plugin"] = async (app) => {
  const tags = ["sucursal"];
  app.get("/", { onRequest: [app.guard()], schema: { tags } }, async (req) => {
    const [b] = await app.db.select().from(schema.branches).where(eq(schema.branches.id, req.user.branchId));
    if (!b) throw notFound("Sucursal");
    return {
      id: b.id, name: b.name, timezone: b.timezone, ivaPct: b.ivaPct, usdRate: b.usdRate,
      idleMinutes: { mesero: b.idleMinutesMesero, caja: b.idleMinutesCaja, estacion: b.idleMinutesEstacion },
    };
  });
  app.put("/", { onRequest: [app.guard("sucursal.configurar")], schema: { tags, body: Body } }, async (req) => {
    const [before] = await app.db.select().from(schema.branches).where(eq(schema.branches.id, req.user.branchId));
    const { idleMinutes, ...rest } = req.body;
    const idle = idleMinutes ? { idleMinutesMesero: idleMinutes.mesero, idleMinutesCaja: idleMinutes.caja, idleMinutesEstacion: idleMinutes.estacion } : {};
    await app.db.update(schema.branches).set({ ...rest, ...idle }).where(eq(schema.branches.id, req.user.branchId));
    await recordEvent(app.db, req.user, { type: "branch.updated", entity: "branch", entityId: req.user.branchId, data: { before, after: req.body } });
    return { ok: true };
  });
};

export const branchModule: ApiModule = { prefix: "branch", plugin };
