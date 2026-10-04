import { branding as contract } from "@convivium/contracts";
import { eq, schema, type Db } from "@convivium/db";
import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { recordEvent } from "../../lib/audit.js";
import type { ApiModule } from "../../lib/module.js";
import { AppError, notFound } from "../../plugins/errors.js";
import { mediaDir } from "../../plugins/media.js";

/** Identidad efectiva del restaurante: la guardada sobre los valores por omisión (nombre = razón comercial). */
export async function resolveBranding(db: Db, tenantId: string): Promise<contract.Branding> {
  const [t] = await db.select({ name: schema.tenants.name, branding: schema.tenants.branding }).from(schema.tenants).where(eq(schema.tenants.id, tenantId));
  if (!t) throw notFound("Restaurante");
  const parsed = contract.Branding.partial().safeParse(t.branding ?? {});
  return { ...contract.DEFAULT_BRANDING, name: t.name, ...(parsed.success ? parsed.data : {}) } as contract.Branding;
}

/** Identidad del restaurante (menú digital, PDF, QR). Solo dueño/gerente la editan. */
const plugin: ApiModule["plugin"] = async (app) => {
  const { db } = app;
  const tags = ["identidad"];
  const save = async (tenantId: string, patch: Partial<contract.Branding>) => {
    const current = await resolveBranding(db, tenantId);
    const next = { ...current, ...patch };
    await db.update(schema.tenants).set({ branding: next }).where(eq(schema.tenants.id, tenantId));
    app.hub.publish(["menu"], { type: "menu.updated" });
    return next;
  };

  app.get("/", { onRequest: [app.guard()], schema: { tags } }, async (req) => resolveBranding(db, req.user.tenantId));

  app.put("/", { onRequest: [app.guard("sucursal.configurar")], schema: { tags, body: contract.BrandingUpdate } }, async (req) => {
    const before = await resolveBranding(db, req.user.tenantId);
    const after = await save(req.user.tenantId, req.body);
    await recordEvent(db, req.user, { type: "branding.updated", entity: "tenant", entityId: req.user.tenantId, data: { before, after } });
    return after;
  });

  const dropOld = async (url: string | null) => { if (url?.startsWith("/media/")) await unlink(join(mediaDir, url.slice(7))).catch(() => {}); };
  app.put("/logo", { onRequest: [app.guard("sucursal.configurar")], bodyLimit: 4 * 1024 * 1024, schema: { tags, body: contract.BrandLogoBody } }, async (req) => {
    const [, type, b64] = req.body.dataUrl.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/s)!;
    const buf = Buffer.from(b64!, "base64");
    if (buf.length > 2 * 1024 * 1024) throw new AppError(413, "logo_too_large", "El logo pesa más de 2 MB");
    const file = `logo-${randomUUID()}.${type === "jpeg" ? "jpg" : type}`;
    await writeFile(join(mediaDir, file), buf);
    const before = await resolveBranding(db, req.user.tenantId);
    const after = await save(req.user.tenantId, { logoUrl: `/media/${file}` });
    await dropOld(before.logoUrl);
    await recordEvent(db, req.user, { type: "branding.logo", entity: "tenant", entityId: req.user.tenantId, data: { logoUrl: after.logoUrl } });
    return after;
  });

  app.delete("/logo", { onRequest: [app.guard("sucursal.configurar")], schema: { tags } }, async (req) => {
    const before = await resolveBranding(db, req.user.tenantId);
    const after = await save(req.user.tenantId, { logoUrl: null });
    await dropOld(before.logoUrl);
    return after;
  });
};

export const brandingModule: ApiModule = { prefix: "branding", plugin };
