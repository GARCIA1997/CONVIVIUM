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
    const [branch] = await db.select({ ivaPct: schema.branches.ivaPct }).from(schema.branches).where(eq(schema.branches.id, branchId));
    const groupById = new Map(groups.map((g) => [g.id, { ...g, modifiers: mods.filter((m) => m.groupId === g.id) }]));
    return {
      version: Date.now(),
      ivaPct: branch?.ivaPct ?? 16,
      categories: cats,
      products: prods.map((p) => ({
        ...p,
        iepsPct: Number(p.iepsPct),
        badges: p.badges.filter((b): b is "nuevo" | "picante" | "vegetariano" | "recomendado" => ["nuevo", "picante", "vegetariano", "recomendado"].includes(b)),
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
    app.hub.publish(["menu"], { type: "menu.updated" });
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
    app.hub.publish(["menu"], { type: "menu.updated" });
    return { ok: true };
  });

  /** E2-02 · Grupos de modificadores (reutilizables entre productos). */
  app.get("/modifier-groups", { onRequest: [app.guard("menu.editar")], schema: { tags: ["catálogo"] } }, async (req) => {
    const [groups, mods, links] = await Promise.all([
      db.select().from(schema.modifierGroups).where(eq(schema.modifierGroups.tenantId, req.user.tenantId)),
      db.select().from(schema.modifiers),
      db.select().from(schema.productModifierGroups),
    ]);
    return groups.map((g) => ({ ...g, modifiers: mods.filter((m) => m.groupId === g.id), productCount: links.filter((l) => l.groupId === g.id).length }));
  });

  const saveGroup = async (groupId: string, body: z.infer<typeof catalog.ModifierGroupUpsert>) => {
    await db.update(schema.modifierGroups).set({ name: body.name, minSelect: body.minSelect, maxSelect: body.maxSelect }).where(eq(schema.modifierGroups.id, groupId));
    const existing = await db.select().from(schema.modifiers).where(eq(schema.modifiers.groupId, groupId));
    const keep = new Set(body.modifiers.map((m) => m.id).filter(Boolean));
    for (const m of existing) if (!keep.has(m.id)) await db.delete(schema.modifiers).where(eq(schema.modifiers.id, m.id));
    for (const m of body.modifiers) {
      if (m.id && existing.some((e) => e.id === m.id)) await db.update(schema.modifiers).set({ name: m.name, priceDelta: m.priceDelta }).where(eq(schema.modifiers.id, m.id));
      else await db.insert(schema.modifiers).values({ groupId, name: m.name, priceDelta: m.priceDelta });
    }
  };

  app.post("/modifier-groups", { onRequest: [app.guard("menu.editar")], schema: { tags: ["catálogo"], body: catalog.ModifierGroupUpsert } }, async (req) => {
    const [g] = await db.insert(schema.modifierGroups).values({ tenantId: req.user.tenantId, name: req.body.name, minSelect: req.body.minSelect, maxSelect: req.body.maxSelect }).returning();
    await saveGroup(g!.id, req.body);
    await recordEvent(db, req.user, { type: "modifier_group.created", entity: "modifier_group", entityId: g!.id, data: req.body });
    app.hub.publish(["menu"], { type: "menu.updated" });
    return { id: g!.id };
  });

  app.put("/modifier-groups/:id", { onRequest: [app.guard("menu.editar")], schema: { tags: ["catálogo"], params: z.object({ id: z.string().uuid() }), body: catalog.ModifierGroupUpsert } }, async (req) => {
    const [g] = await db.select().from(schema.modifierGroups).where(and(eq(schema.modifierGroups.id, req.params.id), eq(schema.modifierGroups.tenantId, req.user.tenantId)));
    if (!g) throw notFound("Grupo de modificadores");
    await saveGroup(g.id, req.body);
    await recordEvent(db, req.user, { type: "modifier_group.updated", entity: "modifier_group", entityId: g.id, data: req.body });
    app.hub.publish(["menu"], { type: "menu.updated" });
    return { ok: true };
  });

  /** E2-01 · Categorías de la carta. */
  app.post("/categories", { onRequest: [app.guard("menu.editar")], schema: { tags: ["catálogo"], body: catalog.CategoryUpsert } }, async (req) => {
    const existing = await db.select({ id: schema.categories.id }).from(schema.categories).where(eq(schema.categories.tenantId, req.user.tenantId));
    const [c] = await db.insert(schema.categories).values({ tenantId: req.user.tenantId, name: req.body.name, sortOrder: existing.length + 1 }).returning();
    await recordEvent(db, req.user, { type: "category.created", entity: "category", entityId: c!.id, data: req.body });
    return c;
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

  /** E2-03 · Alta y configuración de estaciones (salida, impresora, respaldo, tiempo objetivo). */
  const StationBody = z.object({
    name: z.string().min(1),
    kind: z.enum(["cocina", "barra"]),
    output: z.enum(["pantalla", "impresora", "ambos"]).default("pantalla"),
    printerFallback: z.boolean().default(true),
    printerAddress: z.string().regex(/^[\w.-]+(:\d+)?$/).nullable().default(null),
    defaultTargetSec: z.number().int().positive().default(900),
  });
  app.post("/stations", { onRequest: [app.guard("estaciones.editar")], schema: { tags: ["catálogo"], body: StationBody } }, async (req, reply) => {
    const [st] = await db.insert(schema.stations).values({ ...req.body, tenantId: req.user.tenantId, branchId: req.user.branchId }).returning();
    await recordEvent(db, req.user, { type: "station.created", entity: "station", entityId: st!.id, data: req.body });
    return reply.status(201).send(st);
  });
  app.put("/stations/:id", { onRequest: [app.guard("estaciones.editar")], schema: { tags: ["catálogo"], params: z.object({ id: z.string().uuid() }), body: StationBody } }, async (req) => {
    const [st] = await db.update(schema.stations).set(req.body).where(and(eq(schema.stations.id, req.params.id), eq(schema.stations.branchId, req.user.branchId))).returning();
    if (!st) throw notFound("Estación");
    await recordEvent(db, req.user, { type: "station.updated", entity: "station", entityId: st.id, data: req.body });
    return st;
  });

  /** E2-03 / E4-09 · Estaciones con pantallas conectadas en este momento y categorías que reciben. */
  app.get("/stations/overview", { onRequest: [app.guard("estaciones.editar")], schema: { tags: ["catálogo"] } }, async (req) => {
    const [stations, routes, products, cats] = await Promise.all([
      db.select().from(schema.stations).where(eq(schema.stations.branchId, req.user.branchId)),
      db.select().from(schema.productStations),
      db.select({ id: schema.products.id, categoryId: schema.products.categoryId }).from(schema.products).where(eq(schema.products.tenantId, req.user.tenantId)),
      db.select().from(schema.categories).where(eq(schema.categories.tenantId, req.user.tenantId)),
    ]);
    return stations.map((st) => {
      const catIds = new Set(routes.filter((r) => r.stationId === st.id).map((r) => products.find((p) => p.id === r.productId)?.categoryId).filter(Boolean));
      return { ...st, screensOnline: app.hub.count(`station:${st.id}`), categories: cats.filter((c) => catIds.has(c.id)).map((c) => c.name), productCount: routes.filter((r) => r.stationId === st.id).length };
    });
  });

  void inArray;
};

export const catalogModule: ApiModule = { prefix: "catalog", plugin };
