import { z } from "zod";
import { Cents, Id } from "./common.js";

export const SupplierUpsert = z.object({
  name: z.string().trim().min(1).max(120),
  tradeName: z.string().max(80).nullable().default(null),
  rfc: z.string().regex(/^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/i, "RFC inválido").nullable().default(null),
  contactName: z.string().max(80).nullable().default(null),
  phone: z.string().max(20).nullable().default(null),
  email: z.string().email().nullable().default(null),
  creditDays: z.number().int().min(0).max(180).default(0),
  /** L M X J V S D */
  deliveryDays: z.array(z.enum(["L", "M", "X", "J", "V", "S", "D"])).default([]),
  categories: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  minOrder: z.number().int().min(0).default(0),
  notes: z.string().max(500).nullable().default(null),
  active: z.boolean().default(true),
});

/** Lista de precios del proveedor: precio por unidad de compra (centavos). */
export const SupplierPricesBody = z.object({
  prices: z.array(z.object({ ingredientId: Id, unitPrice: Cents })).max(500),
  removed: z.array(Id).max(500).default([]),
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
