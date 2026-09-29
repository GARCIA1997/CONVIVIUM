import type { orders } from "@convivium/contracts";
import type { schema } from "@convivium/db";
import type { z } from "zod";

type Row = typeof schema.orderItems.$inferSelect;
const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function toItemDto(r: Row): z.infer<typeof orders.OrderItem> {
  return {
    id: r.id,
    checkId: r.checkId,
    productId: r.productId,
    productName: r.productName,
    stationId: r.stationId,
    quantity: r.quantity,
    modifiers: r.modifiers.map((m) => m.name),
    note: r.note,
    guest: r.guest,
    course: r.course,
    state: r.state,
    unitPrice: r.unitPrice,
    priority: r.priority,
    promoDiscount: r.promoDiscount,
    promotionName: null,
    createdBy: r.createdBy,
    sentAt: iso(r.sentAt),
    readyAt: iso(r.readyAt),
    deliveredAt: iso(r.deliveredAt),
  };
}

export function lineTotal(r: Row): number {
  if (r.state === "cancelado" || r.state === "devuelto") return 0;
  return (r.unitPrice + r.modifiers.reduce((s, m) => s + m.priceDelta, 0)) * r.quantity - r.promoDiscount;
}
