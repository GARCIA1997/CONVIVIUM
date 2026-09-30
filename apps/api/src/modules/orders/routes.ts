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

  /** E4-10 · Vista del capitán (requiere poder resolver autorizaciones). */
  app.get("/floor-overview", { onRequest: [app.guard("aprobacion.resolver")], schema: { tags, querystring: z.object({ delayMin: z.coerce.number().int().min(1).max(60).default(5) }) } }, async (req) =>
    svc.floorOverview(req.user, req.query.delayMin),
  );
  app.post("/items/:id/nudge", { onRequest: [app.guard("aprobacion.resolver")], schema: { tags, params: IdParam } }, async (req) => svc.nudge(req.user, req.params.id));

  app.post("/checks", { onRequest: [app.guard()], schema: { tags, body: orders.OpenCheckBody } }, async (req, reply) => {
    const need = req.body.kind === "llevar" ? "pedido_llevar.abrir" : "mesa.abrir";
    if (!(await app.policy.can(req.user, need))) throw forbidden(`Requiere permiso ${need}`);
    return reply.status(201).send(await svc.openCheck(req.user, req.body));
  });

  /** E3-10 · Unir más mesas a una cuenta abierta o soltar una. */
  app.post("/checks/:id/join", { onRequest: [app.guard("mesa.abrir")], schema: { tags, params: IdParam, body: z.object({ tableIds: z.array(z.string().uuid()).min(1).max(8) }) } }, async (req) =>
    svc.joinTables(req.user, req.params.id, req.body.tableIds));
  app.post("/checks/:id/unjoin", { onRequest: [app.guard("mesa.abrir")], schema: { tags, params: IdParam, body: z.object({ tableId: z.string().uuid() }) } }, async (req) =>
    svc.unjoinTable(req.user, req.params.id, req.body.tableId));

  /** E3-11 · Pedidos para llevar del día y entrega al cliente. */
  app.get("/takeout", { onRequest: [app.guard("pedido_llevar.abrir")], schema: { tags } }, async (req) => svc.takeoutBoard(req.user));
  app.post("/checks/:id/hand-over", { onRequest: [app.guard("pedido_llevar.abrir")], schema: { tags, params: IdParam } }, async (req) => svc.handOver(req.user, req.params.id));

  app.get("/checks/:id", { onRequest: [app.guard()], schema: { tags, params: IdParam, response: { 200: orders.Check } } }, async (req) =>
    svc.getCheck(req.user, req.params.id),
  );

  // Capturar: comanda.capturar en cualquier cuenta; quien atiende pedidos para llevar (p. ej. cajero en mostrador)
  // puede capturar solo en cuentas "llevar".
  app.post("/checks/:id/items", { onRequest: [app.guard()], schema: { tags, params: IdParam, body: orders.AddItemsBody } }, async (req, reply) => {
    if (!(await app.policy.can(req.user, "comanda.capturar"))) {
      const check = await svc.getCheck(req.user, req.params.id);
      if (check.kind !== "llevar" || !(await app.policy.can(req.user, "pedido_llevar.abrir"))) throw forbidden("Requiere permiso comanda.capturar");
    }
    return reply.status(201).send(await svc.addItems(req.user, req.params.id, req.body));
  });

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
    if (!(await app.policy.can(req.user, need))) throw forbidden(`Requiere permiso ${need}`);
    return svc.transition(req.user, req.params.id, req.body.to);
  });

  app.post("/items/:id/cancel", { onRequest: [app.guard("comanda.cancelar_no_enviado")], schema: { tags, params: IdParam, body: orders.CancelItemBody } }, async (req) => {
    const authorizedBy = (await app.policy.can(req.user, "comanda.cancelar_preparado")) ? req.user.userId : undefined;
    return svc.cancel(req.user, req.params.id, req.body, authorizedBy);
  });

  app.post("/items/:id/return", { onRequest: [app.guard("comanda.devolver")], schema: { tags, params: IdParam, body: orders.ReturnItemBody } }, async (req) => {
    const authorizedBy = (await app.policy.can(req.user, "comanda.cancelar_preparado")) ? req.user.userId : undefined;
    return svc.returnItem(req.user, req.params.id, req.body, authorizedBy);
  });
};

export const ordersModule: ApiModule = { prefix: "orders", plugin };
