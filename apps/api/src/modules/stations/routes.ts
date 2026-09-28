import { and, eq, gte, inArray, schema } from "@convivium/db";
import { z } from "zod";
import type { ApiModule } from "../../lib/module.js";
import { toItemDto } from "../orders/mapper.js";

const plugin: ApiModule["plugin"] = async (app) => {
  const tags = ["estaciones (KDS)"];

  /** E4-01 · Cola de la estación: rehacer primero, luego por hora de envío. */
  app.get("/:id/queue", { onRequest: [app.guard()], schema: { tags, params: z.object({ id: z.string().uuid() }) } }, async (req) => {
    const rows = await app.db
      .select()
      .from(schema.orderItems)
      .where(and(eq(schema.orderItems.stationId, req.params.id), inArray(schema.orderItems.state, ["enviado", "en_preparacion", "listo"])));
    return rows
      .sort((a, b) => (a.priority === b.priority ? (a.sentAt?.getTime() ?? 0) - (b.sentAt?.getTime() ?? 0) : a.priority === "rehacer" ? -1 : 1))
      .map((r) => ({ ...toItemDto(r), targetPrepSec: r.targetPrepSec }));
  });

  /** E4-05 · Despachado en el turno (últimas 12 h) para recuperar tarjetas. */
  app.get("/:id/history", { onRequest: [app.guard()], schema: { tags, params: z.object({ id: z.string().uuid() }) } }, async (req) => {
    const since = new Date(Date.now() - 12 * 3600e3);
    const rows = await app.db
      .select()
      .from(schema.orderItems)
      .where(and(eq(schema.orderItems.stationId, req.params.id), inArray(schema.orderItems.state, ["listo", "entregado"]), gte(schema.orderItems.sentAt, since)));
    return rows.map(toItemDto);
  });

  /** E4-06 · Consolidado de productos en preparación. */
  app.get("/:id/consolidated", { onRequest: [app.guard()], schema: { tags, params: z.object({ id: z.string().uuid() }) } }, async (req) => {
    const rows = await app.db
      .select()
      .from(schema.orderItems)
      .where(and(eq(schema.orderItems.stationId, req.params.id), inArray(schema.orderItems.state, ["enviado", "en_preparacion"])));
    const totals = new Map<string, number>();
    for (const r of rows) totals.set(r.productName, (totals.get(r.productName) ?? 0) + r.quantity);
    return [...totals].map(([product, quantity]) => ({ product, quantity }));
  });
};

export const stationsModule: ApiModule = { prefix: "stations", plugin };
