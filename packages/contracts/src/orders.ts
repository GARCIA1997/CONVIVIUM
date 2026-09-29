import { z } from "zod";
import { ITEM_STATES } from "@convivium/domain";
import { Cents, Id, Timestamp } from "./common.js";

export const ItemState = z.enum(ITEM_STATES);
export const Course = z.enum(["entrada", "fuerte", "postre", "bebida", "sin_tiempo"]);

/** Cuenta: de mesa o de barra (E3-10). */
export const OpenCheckBody = z.union([
  z.object({ kind: z.literal("mesa"), tableId: Id, guests: z.number().int().min(1), joinTableIds: z.array(Id).max(6).optional() }),
  z.object({ kind: z.literal("barra"), name: z.string().min(1) }),
]);

export const OrderItemInput = z.object({
  productId: Id,
  quantity: z.number().int().min(1),
  modifierIds: z.array(Id).default([]),
  note: z.string().max(140).optional(),
  guest: z.number().int().min(1).optional(),
  course: Course.default("sin_tiempo"),
  /** Si false, se retiene hasta "Marchar" el tiempo (E3-03). */
  fireNow: z.boolean().default(true),
});

export const AddItemsBody = z.object({ items: z.array(OrderItemInput).min(1) });

export const OrderItem = z.object({
  id: Id,
  checkId: Id,
  productId: Id,
  productName: z.string(),
  stationId: Id,
  quantity: z.number().int(),
  modifiers: z.array(z.string()),
  note: z.string().nullable(),
  guest: z.number().int().nullable(),
  course: Course,
  state: ItemState,
  unitPrice: Cents,
  priority: z.enum(["normal", "rehacer"]),
  createdBy: Id,
  sentAt: Timestamp.nullable(),
  readyAt: Timestamp.nullable(),
  deliveredAt: Timestamp.nullable(),
});
export type OrderItem = z.infer<typeof OrderItem>;

export const Check = z.object({
  id: Id,
  kind: z.enum(["mesa", "barra"]),
  tableId: Id.nullable(),
  name: z.string().nullable(),
  guests: z.number().int().nullable(),
  waiterId: Id,
  status: z.enum(["abierta", "pidio_cuenta", "cobrada", "cancelada"]),
  items: z.array(OrderItem),
  subtotal: Cents,
  discounts: Cents,
  total: Cents,
  openedAt: Timestamp,
  tableLabel: z.string().nullable(),
  waiterName: z.string().nullable(),
});

/** Resumen para listas de cuentas abiertas (caja). */
export const CheckSummary = z.object({
  id: Id,
  kind: z.enum(["mesa", "barra"]),
  status: z.enum(["abierta", "pidio_cuenta", "cobrada", "cancelada"]),
  tableLabel: z.string().nullable(),
  name: z.string().nullable(),
  guests: z.number().int().nullable(),
  waiterName: z.string().nullable(),
  total: Cents,
  itemCount: z.number().int(),
  openedAt: Timestamp,
});

export const FireCourseBody = z.object({ course: Course });
export const ItemTransitionBody = z.object({ to: ItemState });
export const CancelItemBody = z.object({ reasonId: Id, note: z.string().optional() });
export const ReturnItemBody = z.object({
  reasonId: Id,
  resolution: z.enum(["rehacer", "retirar_de_cuenta"]),
  note: z.string().optional(),
});
export const MoveItemsBody = z.object({ itemIds: z.array(Id).min(1), toCheckId: Id });
