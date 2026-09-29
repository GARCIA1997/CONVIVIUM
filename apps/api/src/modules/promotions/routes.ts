import { and, desc, eq, gte, gt, schema, sql } from "@convivium/db";
import { promoActiveAt, type Promotion } from "@convivium/domain";
import { z } from "zod";
import { recordEvent } from "../../lib/audit.js";
import type { ApiModule } from "../../lib/module.js";
import { AppError } from "../../plugins/errors.js";

const Hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const Body = z.object({
  name: z.string().trim().min(3).max(80),
  kind: z.enum(["dos_por_uno", "porcentaje", "precio_especial", "combo"]),
  value: z.number().int().min(0),
  productIds: z.array(z.string().uuid()).max(200),
  categoryIds: z.array(z.string().uuid()).max(50),
  days: z.array(z.number().int().min(0).max(6)).max(7),
  startTime: Hhmm.nullable(),
  endTime: Hhmm.nullable(),
  zones: z.array(z.string()).max(20),
  toleranceMin: z.number().int().min(0).max(120),
  status: z.enum(["activa", "pausada", "borrador"]),
}).superRefine((b, ctx) => {
  if (b.kind === "porcentaje" && (b.value < 1 || b.value > 100)) ctx.addIssue({ code: "custom", message: "El porcentaje debe ir de 1 a 100", path: ["value"] });
  if ((b.kind === "precio_especial" || b.kind === "combo") && b.value < 1) ctx.addIssue({ code: "custom", message: "Indica el precio", path: ["value"] });
  if (b.kind === "combo" && b.productIds.length < 2) ctx.addIssue({ code: "custom", message: "Un combo necesita al menos 2 productos", path: ["productIds"] });
  if (b.kind !== "combo" && !b.productIds.length && !b.categoryIds.length) ctx.addIssue({ code: "custom", message: "Elige productos o categorías", path: ["productIds"] });
  if (!!b.startTime !== !!b.endTime) ctx.addIssue({ code: "custom", message: "Indica inicio y cierre", path: ["endTime"] });
});

/** E4-07 · Reglas de promoción que el comandero y la caja aplican solas. */
const plugin: ApiModule["plugin"] = async (app) => {
  const { db } = app;
  const tags = ["promociones"];

  app.get("/", { onRequest: [app.guard("menu.editar")], schema: { tags } }, async (req) => {
    const [rows, [branch]] = await Promise.all([
      db.select().from(schema.promotions).where(eq(schema.promotions.tenantId, req.user.tenantId)).orderBy(desc(schema.promotions.updatedAt)),
      db.select({ tz: schema.branches.timezone }).from(schema.branches).where(eq(schema.branches.id, req.user.branchId)),
    ]);
    const now = new Date();
    return rows.map((p) => ({ ...p, liveNow: promoActiveAt({ ...p, active: p.status === "activa" } as Promotion, now, branch?.tz ?? "America/Mexico_City") }));
  });

  /** Impacto de hoy: bonificado por promoción, cuentas tocadas y producto más pedido en promo. */
  app.get("/impact", { onRequest: [app.guard("menu.editar")], schema: { tags } }, async (req) => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const rows = await db
      .select({ promotionId: schema.orderItems.promotionId, productName: schema.orderItems.productName, checkId: schema.orderItems.checkId, discount: schema.orderItems.promoDiscount, qty: schema.orderItems.quantity })
      .from(schema.orderItems)
      .where(and(eq(schema.orderItems.branchId, req.user.branchId), gte(schema.orderItems.createdAt, start), gt(schema.orderItems.promoDiscount, 0), sql`${schema.orderItems.state} not in ('cancelado','devuelto')`));
    const byPromo = new Map<string, { discount: number; checks: Set<string> }>();
    const byProduct = new Map<string, number>();
    for (const r of rows) {
      const p = byPromo.get(r.promotionId!) ?? { discount: 0, checks: new Set<string>() };
      p.discount += r.discount; p.checks.add(r.checkId); byPromo.set(r.promotionId!, p);
      byProduct.set(r.productName, (byProduct.get(r.productName) ?? 0) + r.qty);
    }
    const top = [...byProduct.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      totalDiscount: rows.reduce((n, r) => n + r.discount, 0),
      checks: new Set(rows.map((r) => r.checkId)).size,
      byPromotion: [...byPromo.entries()].map(([id, v]) => ({ id, discount: v.discount, checks: v.checks.size })),
      topProduct: top ? { name: top[0], quantity: top[1] } : null,
    };
  });

  app.post("/", { onRequest: [app.guard("menu.editar")], schema: { tags, body: Body } }, async (req) => {
    const [p] = await db.insert(schema.promotions).values({ ...req.body, tenantId: req.user.tenantId }).returning();
    await recordEvent(db, req.user, { type: "promotion.created", entity: "promotion", entityId: p!.id, data: req.body });
    return p;
  });

  app.put("/:id", { onRequest: [app.guard("menu.editar")], schema: { tags, params: z.object({ id: z.string().uuid() }), body: Body } }, async (req) => {
    const [before] = await db.select().from(schema.promotions).where(and(eq(schema.promotions.id, req.params.id), eq(schema.promotions.tenantId, req.user.tenantId)));
    if (!before) throw new AppError(404, "not_found", "Promoción no encontrada");
    const [p] = await db.update(schema.promotions).set({ ...req.body, updatedAt: new Date() }).where(eq(schema.promotions.id, req.params.id)).returning();
    await recordEvent(db, req.user, { type: "promotion.updated", entity: "promotion", entityId: p!.id, data: { before, after: req.body } });
    return p;
  });

  app.delete("/:id", { onRequest: [app.guard("menu.editar")], schema: { tags, params: z.object({ id: z.string().uuid() }) } }, async (req) => {
    // Se conserva la fila (los renglones cobrados la referencian); solo se archiva como borrador.
    await db.update(schema.promotions).set({ status: "borrador", updatedAt: new Date() }).where(and(eq(schema.promotions.id, req.params.id), eq(schema.promotions.tenantId, req.user.tenantId)));
    await recordEvent(db, req.user, { type: "promotion.archived", entity: "promotion", entityId: req.params.id, data: {} });
    return { ok: true };
  });
};

export const promotionsModule: ApiModule = { prefix: "promotions", plugin };
