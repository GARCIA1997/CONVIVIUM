import { and, eq, schema, type Db } from "@convivium/db";
import { promoActiveAt, type Promotion } from "@convivium/domain";

/** Configuración del generador de menú (guardada en menu_publications.config). */
export interface MenuConfig {
  title: string;
  subtitle: string;
  footer: string;
  address: string;
  phone: string;
  whatsapp: string;
  template: "clasica" | "moderna" | "bistro";
  size: "carta" | "media_carta";
  columns: 1 | 2;
  accent: string;
  showDescriptions: boolean;
  /** Agotados: se muestran atenuados con "Agotado hoy" (digital); en el PDF se omiten. */
  showSoldOut: boolean;
  showPromos: boolean;
  /** Orden y visibilidad de categorías; las que no estén se agregan al final visibles. */
  categories: { id: string; visible: boolean }[];
  hiddenProducts: string[];
}

export const DEFAULT_CONFIG: MenuConfig = {
  title: "CONVIVIUM",
  subtitle: "Donde todo sucede en la mesa",
  footer: "Precios en MXN, IVA incluido",
  address: "",
  phone: "",
  whatsapp: "",
  template: "clasica",
  size: "carta",
  columns: 2,
  accent: "#D4AF7C",
  showDescriptions: true,
  showSoldOut: true,
  showPromos: true,
  categories: [],
  hiddenProducts: [],
};

export const BADGES = { nuevo: "Nuevo", picante: "Picante", vegetariano: "Vegetariano", recomendado: "Recomendado" } as const;

export interface MenuView {
  branchName: string;
  config: MenuConfig;
  sections: { id: string; name: string; items: { id: string; name: string; description: string | null; price: number; badges: string[]; soldOut: boolean; photoUrl: string | null }[] }[];
  promos: { name: string; detail: string }[];
  updatedAt: string;
}

/** Contenido listo para pintar (PDF, página pública o vista previa), respetando la configuración. */
export async function buildMenuView(db: Db, branchId: string, rawConfig: Partial<MenuConfig>): Promise<MenuView> {
  const config = { ...DEFAULT_CONFIG, ...rawConfig };
  const [branch] = await db.select().from(schema.branches).where(eq(schema.branches.id, branchId));
  if (!branch) throw new Error("Sucursal no encontrada");
  const [cats, products, avail, promos] = await Promise.all([
    db.select().from(schema.categories).where(and(eq(schema.categories.tenantId, branch.tenantId), eq(schema.categories.active, true))),
    db.select().from(schema.products).where(and(eq(schema.products.tenantId, branch.tenantId), eq(schema.products.active, true))),
    db.select().from(schema.productAvailability).where(eq(schema.productAvailability.branchId, branchId)),
    config.showPromos ? db.select().from(schema.promotions).where(and(eq(schema.promotions.tenantId, branch.tenantId), eq(schema.promotions.status, "activa"))) : Promise.resolve([]),
  ]);
  const order = new Map(config.categories.map((c, i) => [c.id, i]));
  const hidden = new Set(config.hiddenProducts);
  const sorted = [...cats].sort((a, b) => (order.get(a.id) ?? 1000 + a.sortOrder) - (order.get(b.id) ?? 1000 + b.sortOrder));
  const sections = sorted
    .filter((c) => config.categories.find((x) => x.id === c.id)?.visible ?? true)
    .map((c) => ({
      id: c.id,
      name: c.name,
      items: products
        .filter((p) => p.categoryId === c.id && !hidden.has(p.id))
        .map((p) => ({ id: p.id, name: p.name, description: config.showDescriptions ? p.description : null, price: p.price, badges: p.badges, soldOut: avail.find((a) => a.productId === p.id)?.soldOut ?? false, photoUrl: p.photoUrl }))
        .filter((p) => config.showSoldOut || !p.soldOut)
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter((s) => s.items.length);
  const DAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const now = new Date();
  // Vigentes hoy primero; todas las activas se listan con su horario.
  const promoList = [...promos]
    .sort((a, b) => Number(promoActiveAt({ ...b, active: true } as Promotion, now, branch.timezone)) - Number(promoActiveAt({ ...a, active: true } as Promotion, now, branch.timezone)))
    .map((p) => ({
      name: p.name,
      detail: [p.days.length && p.days.length < 7 ? p.days.map((d) => DAYS[d]).join(", ") : "Todos los días", p.startTime ? `${p.startTime}–${p.endTime}` : ""].filter(Boolean).join(" · "),
    }));
  return { branchName: branch.name, config, sections, promos: promoList, updatedAt: now.toISOString() };
}

/** Dirección amigable para el menú público (sin acentos ni espacios). */
export const slugify = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "menu";
