import { z } from "zod";
import { Cents, Id } from "./common.js";

export const Supplier = z.object({
  id: Id,
  name: z.string(),
  rfc: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().email().nullable(),
  creditDays: z.number().int().min(0),
});
export const PurchaseOrderBody = z.object({
  supplierId: Id,
  expectedAt: z.string().date(),
  lines: z.array(z.object({ ingredientId: Id, quantity: z.number().positive(), unitPrice: Cents })).min(1),
});
export const ReceiptBody = z.object({
  purchaseOrderId: Id.optional(),
  supplierId: Id,
  warehouseId: Id,
  invoiceFolio: z.string().optional(),
  lines: z.array(z.object({
    ingredientId: Id,
    quantity: z.number().positive(),
    unitPrice: Cents,
    lot: z.string().optional(),
    expiresAt: z.string().date().optional(),
  })).min(1),
});
export const SupplierPaymentBody = z.object({
  payableId: Id,
  amount: Cents,
  method: z.enum(["transferencia", "efectivo_caja", "cheque"]),
  reference: z.string().optional(),
});
