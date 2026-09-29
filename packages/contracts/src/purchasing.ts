import { z } from "zod";
import { Cents, Id } from "./common.js";

export const SupplierUpsert = z.object({
  name: z.string().min(1),
  rfc: z.string().nullable().default(null),
  phone: z.string().nullable().default(null),
  email: z.string().email().nullable().default(null),
  creditDays: z.number().int().min(0).default(0),
});

export const PurchaseOrderBody = z.object({
  supplierId: Id,
  warehouseId: Id,
  expectedAt: z.string().date().optional(),
  lines: z.array(z.object({ ingredientId: Id, quantity: z.number().positive().describe("En unidad de compra"), unitPrice: Cents.describe("Por unidad de compra") })).min(1),
});

export const ReceiptBody = z.object({
  purchaseOrderId: Id.optional(),
  supplierId: Id,
  warehouseId: Id,
  invoiceFolio: z.string().optional(),
  /** Si la mercancía llega con factura/nota se genera la cuenta por pagar. */
  createPayable: z.boolean().default(true),
  lines: z.array(z.object({
    ingredientId: Id,
    quantity: z.number().min(0).describe("Recibido, en unidad de compra"),
    unitPrice: Cents.describe("Precio real por unidad de compra"),
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
