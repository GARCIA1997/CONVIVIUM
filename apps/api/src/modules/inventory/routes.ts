import { inventory } from "@convivium/contracts";
import { eq, schema } from "@convivium/db";
import { z } from "zod";
import type { ApiModule } from "../../lib/module.js";
import { InventoryService } from "./service.js";

const IdParam = z.object({ id: z.string().uuid() });

const plugin: ApiModule["plugin"] = async (app) => {
  const svc = new InventoryService(app);
  const tags = ["inventario"];

  // E7-01 / E7-02 · Insumos y almacenes
  app.get("/warehouses", { onRequest: [app.guard("inventario.contar")], schema: { tags } }, async (req) =>
    app.db.select().from(schema.warehouses).where(eq(schema.warehouses.branchId, req.user.branchId)),
  );
  app.get("/ingredients", { onRequest: [app.guard("inventario.contar")], schema: { tags, querystring: z.object({ warehouseId: z.string().uuid().optional() }), response: { 200: z.array(inventory.IngredientView) } } }, async (req) =>
    svc.ingredients(req.user, req.query.warehouseId),
  );
  app.post("/ingredients", { onRequest: [app.guard("inventario.gestionar")], schema: { tags, body: inventory.IngredientUpsert } }, async (req, reply) =>
    reply.status(201).send(await svc.upsertIngredient(req.user, req.body)),
  );
  app.put("/ingredients/:id", { onRequest: [app.guard("inventario.gestionar")], schema: { tags, params: IdParam, body: inventory.IngredientUpsert } }, async (req) =>
    svc.upsertIngredient(req.user, req.body, req.params.id),
  );
  // E7-02 / E7-08 · Mermas, traspasos y ajustes
  app.post("/movements", { onRequest: [app.guard("inventario.gestionar")], schema: { tags, body: inventory.StockMovementBody } }, async (req) =>
    svc.manualMovement(req.user, req.body),
  );

  // E7-03 / E7-04 / E7-05 · Recetas y costo teórico
  app.get("/recipes", { onRequest: [app.guard("inventario.contar")], schema: { tags } }, async (req) => svc.recipes(req.user));
  app.get("/recipes/:id", { onRequest: [app.guard("inventario.contar")], schema: { tags, params: IdParam } }, async (req) => svc.recipeDetail(req.user, req.params.id));
  app.post("/recipes", { onRequest: [app.guard("menu.editar")], schema: { tags, body: inventory.RecipeUpsert } }, async (req, reply) =>
    reply.status(201).send(await svc.upsertRecipe(req.user, req.body)),
  );
  app.put("/recipes/:id", { onRequest: [app.guard("menu.editar")], schema: { tags, params: IdParam, body: inventory.RecipeUpsert } }, async (req) =>
    svc.upsertRecipe(req.user, req.body, req.params.id),
  );
  app.post("/production", { onRequest: [app.guard("inventario.gestionar")], schema: { tags, body: inventory.ProductionBody } }, async (req) => svc.produce(req.user, req.body));

  // E7-09 · Conteos físicos con aprobación del gerente
  app.post("/counts", { onRequest: [app.guard("inventario.contar")], schema: { tags, body: inventory.PhysicalCountBody } }, async (req, reply) =>
    reply.status(201).send(await svc.submitCount(req.user, req.body)),
  );
  app.get("/counts", { onRequest: [app.guard("inventario.contar")], schema: { tags, querystring: z.object({ status: z.string().optional() }) } }, async (req) => svc.listCounts(req.user, req.query.status));
  app.post("/counts/:id/approve", { onRequest: [app.guard("inventario.aprobar_ajuste")], schema: { tags, params: IdParam } }, async (req) => svc.resolveCount(req.user, req.params.id, true));
  app.post("/counts/:id/reject", { onRequest: [app.guard("inventario.aprobar_ajuste")], schema: { tags, params: IdParam } }, async (req) => svc.resolveCount(req.user, req.params.id, false));

  // E7-12 · Sugerencia de compra
  app.get("/purchase-suggestions", { onRequest: [app.guard("compras.proponer_oc")], schema: { tags } }, async (req) => svc.purchaseSuggestions(req.user));
};

export const inventoryModule: ApiModule = { prefix: "inventory", plugin };
