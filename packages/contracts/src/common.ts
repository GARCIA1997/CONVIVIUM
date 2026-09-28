import { z } from "zod";

export const Id = z.string().uuid();
export const Cents = z.number().int().describe("Monto en centavos MXN");
export const Timestamp = z.string().datetime();

export const ErrorResponse = z.object({
  error: z.string(),
  message: z.string(),
});

export const Paginated = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.string().nullable() });

export const ListQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
