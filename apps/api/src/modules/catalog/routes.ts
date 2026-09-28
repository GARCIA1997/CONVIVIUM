import { catalog } from "@convivium/contracts";
import { and, eq, inArray, schema } from "@convivium/db";
import { z } from "zod";
import { recordEvent } from "../../lib/audit.js";
import type { ApiModule } from "../../lib/module.js";
import { notFound } from "../../plugins/errors.js";

const plugin: ApiModule["plugin"] = async (app) => {
  const { db } = app;

  /** Menú completo de la sucursal (mesero y caja lo cachean offline). */
  app.get("/menu", { onRequest: [app.guard()], schema: { tags: ["catálogo"], response: { 200: catalog.Menu } } }, async (req) => {
    const { tenantId, branchId } = req.user;
    const [cats, prods, stations, groups, mods, pmg, avail] = await Promise.all([
      db.select().from(schema.categories).where(eq(schema.categories.tenantId, tenantId)),
      db.select().from(schema.products).where(eq(schema.products.tenantId, tenantId)),
      db.select().from(schema.productStations),
      db.select().from(schema.modifierGroups).where(eq(schema.modifierGroups.tenantId, tenantId)),
      db.select().from(schema.modifiers),
      db.select().from(schema.productModifierGroups),
      db.select().from(schema.productAvailability).where(eq(schema.productAvailability.branchId, branchId)),
    ]);
    const groupById = new Map(groups.map((g) => [g.id, { ...g, modifiers: mods.filter((m) => m.groupId === g.id) }]));
    return {
      version: Date.now(),
      categories: cats,
      products: prods.map((p) => ({
        ...p,
        iepsPct: Number(p.iepsPct),
        stationIds: stations.filter((s) => s.productId === p.id).map((s) => s.stationId),
        modifierGroups: pmg.filter((x) => x.productId === p.id).map((x) => groupById.get(x.groupId)!).filter(Boolean),
        soldOut: avail.find((a) => a.productId === p.id)?.soldOut ?? false,
      })),
    };
  });

  /** E2-01/E2-04 · Alta de producto. */
  app.post("/products", { onRequest: [app.guard("menu.editar")], schema: { tags: ["catálogo"], body: catalog.ProductUpsert, response: { 201: z.object({ id: z.string() }) } } }, async (req, reply) => {
    const { stationIds, modifierGroupIds, soldOut: _s, iepsPct, ...data } = req.body;
    const [p] = await db.insert(schema.products).values({ ...data, iepsPct: String(iepsPct), tenantId: req.user.tenantId }).returning();
    await db.insert(schema.productStations).values(stationIds.map((stationId) => ({ productId: p!.id, stationId })));
    if (modifierGroupIds.length) await db.insert(schema.productModifierGroups).values(modifierGroupIds.map((groupId) => ({ productId: p!.id, groupId })));
    await recordEvent(db, req.user, { type: "product.created", entity: "product", entityId: p!.id, data: req.body });
    return reply.status(201).send({ id: p!.id });
  });

  /** E2-01 · Edición de producto (cambio de precio queda en bitácora con antes/después). */
  app.put("/products/:id", { onRequest: [app.guard("menu.editar")], schema: { tags: ["catálogo"], params: z.object({ id: z.string().uuid() }), body: catalog.ProductUpsert } }, async (req) => {
    const where = and(eq(schema.products.id, req.params.id), eq(schema.products.tenantId, req.user.tenantId));
    const [before] = await db.select().from(schema.products).where(where);
    if (!before) throw notFound("Producto");
    const { stationIds, modifierGroupIds, soldOut: _s, iepsPct, ...data } = req.body;
    await db.update(schema.products).set({ ...data, iepsPct: String(iepsPct), updatedAt: new Date() }).where(where);
    await db.delete(schema.productStations).where(eq(schema.productStations.productId, req.params.id));
    await db.insert(schema.productStations).values(stationIds.map((stationId) => ({ productId: req.params.id, stationId })));
    await db.delete(schema.productModifierGroups).where(eq(schema.productModifierGroups.productId, req.params.id));
    if (modifierGroupIds.length) await db.insert(schema.productModifierGroups).values(modifierGroupIds.map((groupId) => ({ productId: req.params.id, groupId })));
    await recordEvent(db, req.user, { type: "product.updated", entity: "product", entityId: req.params.id, data: { before, after: req.body } });
    return { ok: true };
  });

  /** E2-07 · Marcar agotado; se refleja en meseros en tiempo real. */
  app.put("/products/:id/sold-out", { onRequest: [app.guard("menu.editar")], schema: { tags: ["catálogo"], params: z.object({ id: z.string().uuid() }), body: catalog.SetSoldOutBody } }, async (req) => {
    await db
      .insert(schema.productAvailability)
      .values({ productId: req.params.id, branchId: req.user.branchId, soldOut: req.body.soldOut })
      .onConflictDoUpdate({ target: [schema.productAvailability.productId, schema.productAvailability.branchId], set: { soldOut: req.body.soldOut } });
    app.hub.publish(["menu"], { type: "product.sold_out", productId: req.params.id, soldOut: req.body.soldOut });
    return { ok: true };
  });

  /** E2-08 · Catálogo de motivos. */
  app.get("/reasons", { onRequest: [app.guard()], schema: { tags: ["catálogo"], querystring: z.object({ kind: z.string().optional() }) } }, async (req) => {
    const conds = [eq(schema.reasons.tenantId, req.user.tenantId), eq(schema.reasons.active, true)];
    if (req.query.kind) conds.push(eq(schema.reasons.kind, req.query.kind as never));
    return db.select().from(schema.reasons).where(and(...conds));
  });

  app.get("/stations", { onRequest: [app.guard()], schema: { tags: ["catálogo"] } }, async (req) =>
    db.select().from(schema.stations).where(eq(schema.stations.branchId, req.user.branchId)),
  );

  void inArray;
};

export const catalogModule: ApiModule = { prefix: "catalog", plugin };
