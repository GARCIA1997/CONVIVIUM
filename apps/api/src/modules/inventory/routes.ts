import { inventory } from "@convivium/contracts";
import { eq, schema } from "@convivium/db";
import { z } from "zod";
import type { ApiModule } from "../../lib/module.js";
import { notImplemented } from "../../plugins/errors.js";

const IdParam = z.object({ id: z.string().uuid() });

const plugin: ApiModule["plugin"] = async (app) => {
  const tags = ["inventario"];
  const todo = async () => { throw notImplemented(); };

  app.get("/ingredients", { onRequest: [app.guard("inventario.contar")], schema: { tags } }, async (req) =>
    app.db.select().from(schema.ingredients).where(eq(schema.ingredients.tenantId, req.user.tenantId)),
  );
  app.get("/warehouses", { onRequest: [app.guard("inventario.contar")], schema: { tags } }, async (req) =>
    app.db.select().from(schema.warehouses).where(eq(schema.warehouses.branchId, req.user.branchId)),
  );
  app.post("/ingredients", { onRequest: [app.guard("inventario.gestionar")], schema: { tags, body: inventory.Ingredient.omit({ id: true, avgCost: true }) } }, todo); // E7-01
  app.get("/stock", { onRequest: [app.guard("inventario.contar")], schema: { tags, querystring: z.object({ warehouseId: z.string().uuid().optional() }) } }, todo);
  app.post("/movements", { onRequest: [app.guard("inventario.gestionar")], schema: { tags, body: inventory.StockMovementBody } }, todo); // E7-02, E7-08
  app.get("/recipes/:id", { onRequest: [app.guard("inventario.contar")], schema: { tags, params: IdParam } }, todo); // E7-03
  app.put("/recipes/:id", { onRequest: [app.guard("menu.editar")], schema: { tags, params: IdParam, body: inventory.Recipe } }, todo); // E7-03/04
  app.get("/recipes/:id/cost", { onRequest: [app.guard("reportes.ver")], schema: { tags, params: IdParam } }, todo); // E7-05
  app.post("/production", { onRequest: [app.guard("inventario.gestionar")], schema: { tags, body: z.object({ recipeId: z.string().uuid(), quantity: z.number().positive(), warehouseId: z.string().uuid() }) } }, todo); // E7-04
  app.post("/counts", { onRequest: [app.guard("inventario.contar")], schema: { tags, body: inventory.PhysicalCountBody } }, todo); // E7-09
  app.post("/counts/:id/approve", { onRequest: [app.guard("inventario.aprobar_ajuste")], schema: { tags, params: IdParam } }, todo);
  app.get("/purchase-suggestions", { onRequest: [app.guard("compras.proponer_oc")], schema: { tags } }, todo); // E7-12
};

export const inventoryModule: ApiModule = { prefix: "inventory", plugin };
