import { and, desc, eq, lt, schema } from "@convivium/db";
import { z } from "zod";
import type { ApiModule } from "../../lib/module.js";

const plugin: ApiModule["plugin"] = async (app) => {
  /** E1-06 · Bitácora inmutable, paginada por secuencia. */
  app.get("/", {
    onRequest: [app.guard("auditoria.ver")],
    schema: { tags: ["auditoría"], querystring: z.object({ actorId: z.string().uuid().optional(), type: z.string().optional(), before: z.coerce.number().optional(), limit: z.coerce.number().max(200).default(50) }) },
  }, async (req) => {
    const conds = [eq(schema.events.tenantId, req.user.tenantId)];
    if (req.query.actorId) conds.push(eq(schema.events.actorId, req.query.actorId));
    if (req.query.type) conds.push(eq(schema.events.type, req.query.type));
    if (req.query.before) conds.push(lt(schema.events.seq, req.query.before));
    const items = await app.db.select().from(schema.events).where(and(...conds)).orderBy(desc(schema.events.seq)).limit(req.query.limit);
    return { items, nextCursor: items.at(-1)?.seq ?? null };
  });
};

export const auditModule: ApiModule = { prefix: "audit", plugin };
