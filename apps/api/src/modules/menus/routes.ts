import { and, eq, schema } from "@convivium/db";
import type { FastifyInstance, FastifyRequest } from "fastify";
import QRCode from "qrcode";
import { z } from "zod";
import { config as env } from "../../config.js";
import { recordEvent } from "../../lib/audit.js";
import type { ApiModule } from "../../lib/module.js";
import { AppError } from "../../plugins/errors.js";
import { renderMenuPdf } from "./pdf.js";
import { renderPublicMenu } from "./public-page.js";
import { buildMenuView, DEFAULT_CONFIG, slugify, type MenuConfig } from "./render.js";

const ConfigBody = z.object({
  title: z.string().trim().min(1).max(40),
  subtitle: z.string().max(80),
  footer: z.string().max(120),
  address: z.string().max(140),
  phone: z.string().max(20),
  whatsapp: z.string().max(20),
  template: z.enum(["clasica", "moderna", "bistro"]),
  size: z.enum(["carta", "media_carta"]),
  columns: z.union([z.literal(1), z.literal(2)]),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  showDescriptions: z.boolean(),
  showSoldOut: z.boolean(),
  showPromos: z.boolean(),
  categories: z.array(z.object({ id: z.string().uuid(), visible: z.boolean() })).max(100),
  hiddenProducts: z.array(z.string().uuid()).max(2000),
});

/** URL pública del menú digital (la del QR). */
export const publicMenuUrl = (req: FastifyRequest, slug: string) => `${env.PUBLIC_MENU_URL ?? `${req.protocol}://${req.headers.host}`}/m/${slug}`;

/** Publicación de la sucursal (se crea con valores por omisión la primera vez). */
async function currentPublication(app: FastifyInstance, tenantId: string, branchId: string) {
  const [pub] = await app.db.select().from(schema.menuPublications).where(eq(schema.menuPublications.branchId, branchId));
  if (pub) return pub;
  const [branch] = await app.db.select().from(schema.branches).where(eq(schema.branches.id, branchId));
  let slug = slugify(branch?.name ?? "menu");
  const [taken] = await app.db.select({ id: schema.menuPublications.id }).from(schema.menuPublications).where(eq(schema.menuPublications.slug, slug));
  if (taken) slug = `${slug}-${branchId.slice(0, 4)}`;
  const [created] = await app.db.insert(schema.menuPublications).values({ tenantId, branchId, slug, config: DEFAULT_CONFIG as unknown as Record<string, unknown> }).returning();
  return created!;
}

/** E2-09 · Generador de menú: impreso (PDF), digital (página pública) y QR. */
const plugin: ApiModule["plugin"] = async (app) => {
  const tags = ["menú publicado"];
  const guard = { onRequest: [app.guard("menu.editar")] };

  app.get("/current", { ...guard, schema: { tags } }, async (req) => {
    const pub = await currentPublication(app, req.user.tenantId, req.user.branchId);
    const config = { ...DEFAULT_CONFIG, ...(pub.config as Partial<MenuConfig>) };
    return { id: pub.id, slug: pub.slug, published: pub.published, publishedAt: pub.publishedAt?.toISOString() ?? null, updatedAt: pub.updatedAt.toISOString(), config, publicUrl: publicMenuUrl(req, pub.slug) };
  });

  /** Vista previa con configuración sin guardar (para el editor en vivo). */
  app.post("/preview", { ...guard, schema: { tags, body: ConfigBody } }, async (req) => buildMenuView(app.db, req.user.branchId, req.body as MenuConfig));

  app.put("/current", { ...guard, schema: { tags, body: z.object({ slug: z.string().regex(/^[a-z0-9-]{3,60}$/, "Solo minúsculas, números y guiones"), config: ConfigBody }) } }, async (req) => {
    const pub = await currentPublication(app, req.user.tenantId, req.user.branchId);
    const [clash] = await app.db.select({ id: schema.menuPublications.id }).from(schema.menuPublications).where(eq(schema.menuPublications.slug, req.body.slug));
    if (clash && clash.id !== pub.id) throw new AppError(409, "slug_taken", "Esa dirección ya la usa otro menú");
    await app.db.update(schema.menuPublications).set({ slug: req.body.slug, config: req.body.config as unknown as Record<string, unknown>, updatedAt: new Date() }).where(eq(schema.menuPublications.id, pub.id));
    await recordEvent(app.db, req.user, { type: "menu.config_updated", entity: "menu_publication", entityId: pub.id, data: { slug: req.body.slug } });
    return { ok: true, publicUrl: publicMenuUrl(req, req.body.slug) };
  });

  app.post("/current/publish", { ...guard, schema: { tags, body: z.object({ published: z.boolean() }) } }, async (req) => {
    const pub = await currentPublication(app, req.user.tenantId, req.user.branchId);
    await app.db.update(schema.menuPublications).set({ published: req.body.published, publishedAt: req.body.published ? new Date() : pub.publishedAt }).where(eq(schema.menuPublications.id, pub.id));
    await recordEvent(app.db, req.user, { type: req.body.published ? "menu.published" : "menu.unpublished", entity: "menu_publication", entityId: pub.id, data: {} });
    return { ok: true };
  });

  /** PDF listo para imprimir (con QR hacia el menú digital). */
  app.get("/current/pdf", { ...guard, schema: { tags } }, async (req, reply) => {
    const pub = await currentPublication(app, req.user.tenantId, req.user.branchId);
    const view = await buildMenuView(app.db, req.user.branchId, pub.config as Partial<MenuConfig>);
    const pdf = await renderMenuPdf(view, publicMenuUrl(req, pub.slug));
    return reply.header("content-type", "application/pdf").header("content-disposition", `attachment; filename="menu-${pub.slug}.pdf"`).send(pdf);
  });

  /** QR del menú digital: PNG (para imprimir en mesa) o SVG. */
  app.get("/current/qr", { ...guard, schema: { tags, querystring: z.object({ format: z.enum(["png", "svg"]).default("png"), size: z.coerce.number().int().min(128).max(2048).default(1024) }) } }, async (req, reply) => {
    const pub = await currentPublication(app, req.user.tenantId, req.user.branchId);
    const url = publicMenuUrl(req, pub.slug);
    const opts = { margin: 2, color: { dark: "#1E2F28", light: "#FFFFFF" } };
    if (req.query.format === "svg") return reply.header("content-type", "image/svg+xml").send(await QRCode.toString(url, { ...opts, type: "svg" }));
    return reply.header("content-type", "image/png").header("content-disposition", `attachment; filename="qr-menu-${pub.slug}.png"`).send(await QRCode.toBuffer(url, { ...opts, width: req.query.size }));
  });
};

export const menusModule: ApiModule = { prefix: "menus", plugin };

/** Página pública del menú digital (/m/:slug), sin sesión. Solo si está publicado. */
export async function publicMenuRoutes(app: FastifyInstance) {
  app.get<{ Params: { slug: string } }>("/m/:slug", { schema: { hide: true } }, async (req, reply) => {
    const [pub] = await app.db.select().from(schema.menuPublications).where(and(eq(schema.menuPublications.slug, req.params.slug.toLowerCase()), eq(schema.menuPublications.published, true)));
    if (!pub) return reply.status(404).type("text/html; charset=utf-8").send("<!doctype html><meta charset=utf-8><title>Menú no disponible</title><p style='font-family:sans-serif;padding:40px;text-align:center'>Este menú no está disponible.</p>");
    const view = await buildMenuView(app.db, pub.branchId, pub.config as Partial<MenuConfig>);
    // Siempre al día (precios y agotados): caché corta.
    return reply.header("cache-control", "public, max-age=60").type("text/html; charset=utf-8").send(renderPublicMenu(view));
  });
}
