import { orders } from "@convivium/contracts";
import { z } from "zod";
import type { ApiModule } from "../../lib/module.js";
import { forbidden } from "../../plugins/errors.js";
import { can } from "@convivium/domain";
import { OrdersService } from "./service.js";

const IdParam = z.object({ id: z.string().uuid() });

const plugin: ApiModule["plugin"] = async (app) => {
  const svc = new OrdersService(app);
  const tags = ["comandas"];

  app.get("/checks", {
    onRequest: [app.guard()],
    schema: { tags, querystring: z.object({ status: z.enum(["abierta", "pidio_cuenta", "cobrada", "cancelada"]).optional() }), response: { 200: z.array(orders.CheckSummary) } },
  }, async (req) => {
    const statuses = req.query.status ? [req.query.status] : (["abierta", "pidio_cuenta"] as const);
    return svc.listOpen(req.user, [...statuses]);
  });

  app.post("/checks", { onRequest: [app.guard("mesa.abrir")], schema: { tags, body: orders.OpenCheckBody } }, async (req, reply) =>
    reply.status(201).send(await svc.openCheck(req.user, req.body)),
  );

  app.get("/checks/:id", { onRequest: [app.guard()], schema: { tags, params: IdParam, response: { 200: orders.Check } } }, async (req) =>
    svc.getCheck(req.user, req.params.id),
  );

  app.post("/checks/:id/items", { onRequest: [app.guard("comanda.capturar")], schema: { tags, params: IdParam, body: orders.AddItemsBody } }, async (req, reply) =>
    reply.status(201).send(await svc.addItems(req.user, req.params.id, req.body)),
  );

  app.post("/checks/:id/fire", { onRequest: [app.guard("comanda.capturar")], schema: { tags, params: IdParam, body: orders.FireCourseBody } }, async (req) =>
    svc.fireCourse(req.user, req.params.id, req.body.course),
  );

  app.post("/checks/:id/request-bill", { onRequest: [app.guard("comanda.capturar")], schema: { tags, params: IdParam } }, async (req) =>
    svc.requestBill(req.user, req.params.id),
  );

  app.post("/items/move", { onRequest: [app.guard("comanda.capturar")], schema: { tags, body: orders.MoveItemsBody } }, async (req) =>
    svc.moveItems(req.user, req.body),
  );

  /** Estación marca listo / deshace; mesero marca entregado. */
  app.post("/items/:id/transition", { onRequest: [app.guard()], schema: { tags, params: IdParam, body: orders.ItemTransitionBody } }, async (req) => {
    const need = req.body.to === "entregado" ? "comanda.capturar" : "estacion.despachar";
    if (!can(req.user.roles, need)) throw forbidden(`Requiere permiso ${need}`);
    return svc.transition(req.user, req.params.id, req.body.to);
  });

  app.post("/items/:id/cancel", { onRequest: [app.guard("comanda.cancelar_no_enviado")], schema: { tags, params: IdParam, body: orders.CancelItemBody } }, async (req) => {
    const authorizedBy = can(req.user.roles, "comanda.cancelar_preparado") ? req.user.userId : undefined;
    return svc.cancel(req.user, req.params.id, req.body, authorizedBy);
  });

  app.post("/items/:id/return", { onRequest: [app.guard("comanda.devolver")], schema: { tags, params: IdParam, body: orders.ReturnItemBody } }, async (req) => {
    const authorizedBy = can(req.user.roles, "comanda.cancelar_preparado") ? req.user.userId : undefined;
    return svc.returnItem(req.user, req.params.id, req.body, authorizedBy);
  });
};

export const ordersModule: ApiModule = { prefix: "orders", plugin };
