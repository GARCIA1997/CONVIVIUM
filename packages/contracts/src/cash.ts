import { z } from "zod";
import { Cents, Id } from "./common.js";

export const PaymentMethod = z.enum(["efectivo_mxn", "efectivo_usd", "tarjeta", "transferencia", "vales"]);

export const OpenCashBody = z.object({ registerId: Id, openingFloat: Cents });
export const CashMovementBody = z.object({ type: z.enum(["retiro", "entrada"]), amount: Cents, reason: z.string().min(1) });

export const SplitBody = z.union([
  z.object({ mode: z.literal("iguales"), parts: z.number().int().min(2) }),
  z.object({ mode: z.literal("por_comensal") }),
  z.object({ mode: z.literal("por_producto"), groups: z.array(z.array(Id)) }),
]);

export const PayBody = z.object({
  payments: z.array(z.object({
    method: PaymentMethod,
    amount: Cents,
    /** Para USD: tipo de cambio en centavos por dólar. */
    exchangeRate: z.number().int().optional(),
    reference: z.string().optional(),
  })).min(1),
  tip: z.object({ amount: Cents, method: PaymentMethod }).optional(),
});
export const PayResponse = z.object({ paid: Cents, change: Cents, checkStatus: z.string() });

export const CashCountBody = z.object({
  kind: z.enum(["X", "Z"]),
  counted: z.record(PaymentMethod, Cents),
});
