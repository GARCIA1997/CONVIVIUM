import { purchasing } from "@convivium/contracts";
import { z } from "zod";
import type { ApiModule } from "../../lib/module.js";
import { PurchasingService } from "./service.js";

const IdParam = z.object({ id: z.string().uuid() });

const plugin: ApiModule["plugin"] = async (app) => {
  const svc = new PurchasingService(app);
  const tags = ["compras y CxP"];

  // E8-01 · Proveedores
  app.get("/suppliers", { onRequest: [app.guard("compras.proponer_oc")], schema: { tags } }, async (req) => svc.suppliers(req.user));
  app.post("/suppliers", { onRequest: [app.guard("compras.aprobar_oc")], schema: { tags, body: purchasing.SupplierUpsert } }, async (req, reply) => reply.status(201).send(await svc.upsertSupplier(req.user, req.body)));
  app.get("/suppliers/:id", { onRequest: [app.guard("compras.proponer_oc")], schema: { tags, params: IdParam } }, async (req) => svc.supplierDetail(req.user, req.params.id));
  app.put("/suppliers/:id/prices", { onRequest: [app.guard("compras.proponer_oc")], schema: { tags, params: IdParam, body: purchasing.SupplierPricesBody } }, async (req) => svc.setSupplierPrices(req.user, req.params.id, req.body));
  app.put("/suppliers/:id", { onRequest: [app.guard("compras.aprobar_oc")], schema: { tags, params: IdParam, body: purchasing.SupplierUpsert } }, async (req) => svc.upsertSupplier(req.user, req.body, req.params.id));

  // E8-02 · Órdenes de compra
  app.get("/purchase-orders", { onRequest: [app.guard("compras.proponer_oc")], schema: { tags, querystring: z.object({ status: z.string().optional() }) } }, async (req) => svc.orders(req.user, req.query.status));
  app.get("/purchase-orders/:id", { onRequest: [app.guard("compras.proponer_oc")], schema: { tags, params: IdParam } }, async (req) => svc.order(req.user, req.params.id));
  app.post("/purchase-orders", { onRequest: [app.guard("compras.proponer_oc")], schema: { tags, body: purchasing.PurchaseOrderBody } }, async (req, reply) => reply.status(201).send(await svc.createOrder(req.user, req.body)));
  app.post("/purchase-orders/:id/approve", { onRequest: [app.guard("compras.aprobar_oc")], schema: { tags, params: IdParam } }, async (req) => svc.approveOrder(req.user, req.params.id));
  app.post("/purchase-orders/:id/share", { onRequest: [app.guard("compras.proponer_oc")], schema: { tags, params: IdParam } }, async (req) => svc.orderShareText(req.user, req.params.id));

  // E8-03 / E8-04 · Recepción y lectura de CFDI
  app.post("/receipts", { onRequest: [app.guard("compras.recibir")], schema: { tags, body: purchasing.ReceiptBody } }, async (req, reply) => reply.status(201).send(await svc.receive(req.user, req.body)));
  app.post("/receipts/parse-cfdi", { onRequest: [app.guard("compras.recibir")], schema: { tags, body: z.object({ xml: z.string().max(2_000_000) }) } }, async (req) => svc.parseCfdi(req.user, req.body.xml));

  // E8-05 / E8-06 / E8-07 · Cuentas por pagar
  app.get("/payables", { onRequest: [app.guard("cxp.pagar")], schema: { tags } }, async (req) => svc.payables(req.user));
  app.post("/payables/payments", { onRequest: [app.guard("cxp.pagar")], schema: { tags, body: purchasing.SupplierPaymentBody } }, async (req) => svc.pay(req.user, req.body));
};

export const purchasingModule: ApiModule = { prefix: "purchasing", plugin };
