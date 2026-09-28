import { z } from "zod";
import { Cents, Id, Timestamp } from "./common.js";

export const ApprovalKind = z.enum(["cancelacion", "devolucion_retiro", "cortesia", "descuento", "reapertura"]);
export const Approval = z.object({
  id: Id,
  kind: ApprovalKind,
  status: z.enum(["pendiente", "aprobada", "rechazada"]),
  checkId: Id,
  itemId: Id.nullable(),
  amount: Cents,
  pct: z.number().nullable(),
  reason: z.string(),
  requestedBy: Id,
  resolvedBy: Id.nullable(),
  createdAt: Timestamp,
});
export const ResolveApprovalBody = z.object({
  decision: z.enum(["aprobar", "rechazar"]),
  /** Autorización en el dispositivo del mesero con PIN de gerente (E5-02). */
  approverPin: z.string().optional(),
  approverId: Id.optional(),
});
export const DiscountBody = z.object({
  scope: z.enum(["producto", "cuenta"]),
  itemId: Id.optional(),
  type: z.enum(["porcentaje", "monto", "cortesia"]),
  value: z.number().min(0),
  reasonId: Id,
});
