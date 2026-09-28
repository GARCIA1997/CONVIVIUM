import { purchasing } from "@convivium/contracts";
import { eq, schema } from "@convivium/db";
import { z } from "zod";
import type { ApiModule } from "../../lib/module.js";
import { notImplemented } from "../../plugins/errors.js";

const IdParam = z.object({ id: z.string().uuid() });

const plugin: ApiModule["plugin"] = async (app) => {
  const tags = ["compras y CxP"];
  const todo = async () => { throw notImplemented(); };

  app.get("/suppliers", { onRequest: [app.guard("compras.proponer_oc")], schema: { tags } }, async (req) =>
    app.db.select().from(schema.suppliers).where(eq(schema.suppliers.tenantId, req.user.tenantId)),
  );
  app.post("/suppliers", { onRequest: [app.guard("compras.aprobar_oc")], schema: { tags, body: purchasing.Supplier.omit({ id: true }) } }, todo); // E8-01
  app.post("/purchase-orders", { onRequest: [app.guard("compras.proponer_oc")], schema: { tags, body: purchasing.PurchaseOrderBody } }, todo); // E8-02
  app.post("/purchase-orders/:id/approve", { onRequest: [app.guard("compras.aprobar_oc")], schema: { tags, params: IdParam } }, todo);
  app.get("/purchase-orders/:id/pdf", { onRequest: [app.guard("compras.proponer_oc")], schema: { tags, params: IdParam } }, todo);
  app.post("/receipts", { onRequest: [app.guard("compras.recibir")], schema: { tags, body: purchasing.ReceiptBody } }, todo); // E8-03, genera CxP (E8-05)
  app.post("/receipts/parse-cfdi", { onRequest: [app.guard("compras.recibir")], schema: { tags, body: z.object({ xml: z.string() }) } }, todo); // E8-04
  app.get("/payables", { onRequest: [app.guard("cxp.pagar")], schema: { tags, querystring: z.object({ status: z.string().optional() }) } }, todo); // E8-07
  app.post("/payables/payments", { onRequest: [app.guard("cxp.pagar")], schema: { tags, body: purchasing.SupplierPaymentBody } }, todo); // E8-06
};

export const purchasingModule: ApiModule = { prefix: "purchasing", plugin };
