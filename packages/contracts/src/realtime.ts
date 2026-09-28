import { z } from "zod";
import { OrderItem } from "./orders.js";

/** Eventos que el nodo emite por WebSocket a los dispositivos de la sucursal. */
export const RealtimeEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("item.sent"), item: OrderItem }),
  z.object({ type: z.literal("item.updated"), item: OrderItem }),
  z.object({ type: z.literal("item.ready"), item: OrderItem, tableLabel: z.string().nullable(), waiterId: z.string() }),
  z.object({ type: z.literal("product.sold_out"), productId: z.string(), soldOut: z.boolean() }),
  z.object({ type: z.literal("table.status"), tableId: z.string(), status: z.string() }),
  z.object({ type: z.literal("approval.created"), approvalId: z.string() }),
  z.object({ type: z.literal("approval.resolved"), approvalId: z.string(), status: z.string() }),
]);
export type RealtimeEvent = z.infer<typeof RealtimeEvent>;

/** Canales a los que se suscribe cada dispositivo. */
export type Channel = `station:${string}` | `waiter:${string}` | "floor" | "approvals" | "menu";
