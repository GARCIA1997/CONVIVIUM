import { z } from "zod";
import { ITEM_STATES } from "@convivium/domain";
import { Cents, Id, Timestamp } from "./common.js";

export const ItemState = z.enum(ITEM_STATES);
export const Course = z.enum(["entrada", "fuerte", "postre", "bebida", "sin_tiempo"]);

export const TakeoutChannel = z.enum(["mostrador", "telefono", "whatsapp"]);

/** Cuenta: de mesa, de barra o para llevar (E3-10, E3-11). */
export const OpenCheckBody = z.union([
  z.object({ kind: z.literal("mesa"), tableId: Id, guests: z.number().int().min(1), joinTableIds: z.array(Id).max(6).optional() }),
  z.object({ kind: z.literal("barra"), name: z.string().min(1) }),
  z.object({
    kind: z.literal("llevar"),
    customerName: z.string().trim().min(1).max(60),
    customerPhone: z.string().regex(/^\d{10}$/, "Teléfono a 10 dígitos").nullable().default(null),
    /** Nulo = lo antes posible. */
    pickupAt: Timestamp.nullable().default(null),
    channel: TakeoutChannel.default("mostrador"),
    disposables: z.boolean().default(true),
    note: z.string().max(140).nullable().default(null),
  }),
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
  /** Descuento automático por promoción, ya restado del total del renglón. */
  promoDiscount: Cents.default(0),
  promotionName: z.string().nullable().default(null),
  createdBy: Id,
  sentAt: Timestamp.nullable(),
  readyAt: Timestamp.nullable(),
  deliveredAt: Timestamp.nullable(),
});
export type OrderItem = z.infer<typeof OrderItem>;

export const Check = z.object({
  id: Id,
  kind: z.enum(["mesa", "barra", "llevar"]),
  folio: z.number().int().nullable().default(null),
  customerName: z.string().nullable().default(null),
  customerPhone: z.string().nullable().default(null),
  pickupAt: Timestamp.nullable().default(null),
  channel: z.string().nullable().default(null),
  disposables: z.boolean().nullable().default(null),
  note: z.string().nullable().default(null),
  handedOverAt: Timestamp.nullable().default(null),
  tableId: Id.nullable(),
  name: z.string().nullable(),
  guests: z.number().int().nullable(),
  waiterId: Id,
  status: z.enum(["abierta", "pidio_cuenta", "cobrada", "cancelada"]),
  items: z.array(OrderItem),
  subtotal: Cents,
  discounts: Cents,
  total: Cents,
  /** Resumen de promociones aplicadas (ya incluidas en el subtotal). */
  promotions: z.array(z.object({ name: z.string(), amount: Cents })).default([]),
  openedAt: Timestamp,
  tableLabel: z.string().nullable(),
  waiterName: z.string().nullable(),
});

/** Resumen para listas de cuentas abiertas (caja). */
export const CheckSummary = z.object({
  id: Id,
  kind: z.enum(["mesa", "barra", "llevar"]),
  folio: z.number().int().nullable().default(null),
  pickupAt: Timestamp.nullable().default(null),
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
