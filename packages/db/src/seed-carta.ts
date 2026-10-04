/**
 * Carta de demostración igual al diseño Stitch del menú digital (design/stitch/menu-digital-qr.html):
 * platillos, descripciones, precios, etiquetas, fotos, un agotado, happy hour y datos de contacto. NO usar en producción.
 * Se puede correr varias veces: actualiza por nombre, no duplica. Los platillos del seed básico se renombran
 * (conservan su historial de ventas).
 * Uso: pnpm --filter @convivium/db seed:carta
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { and, eq } from "drizzle-orm";
import { createDb, schema } from "./index.js";

const db = createDb(process.env.DATABASE_URL ?? "postgres://convivium:convivium@localhost:5432/convivium");
/** Misma carpeta que usa la API en desarrollo (MEDIA_DIR relativo a apps/api). */
const MEDIA = resolve(import.meta.dirname, "../../../apps/api", process.env.MEDIA_DIR ?? "data/media");
const FOTOS = resolve(import.meta.dirname, "../../../design/stitch/fotos");

type Dish = { name: string; was?: string; cat: string; price: number; desc: string; badges: string[]; photo?: string; bar?: boolean; soldOut?: boolean };
const CATS = ["Entradas", "Tacos", "Fuertes", "Postres", "Bebidas"];
const DISHES: Dish[] = [
  { name: "Guacamole Rústico con Chapulines", was: "Guacamole", cat: "Entradas", price: 18500, badges: ["vegetariano", "nuevo"], photo: "guacamole-rustico-con-chapulines", desc: "Aguacate Hass machacado en molcajete, queso cotija añejo, totopos de maíz azul y chapulines crujientes al ajillo." },
  { name: "Queso Fundido al Horno de Leña", cat: "Entradas", price: 16500, badges: ["nuevo"], photo: "queso-fundido-al-horno-de-lena", desc: "Queso menonita y quesillo Oaxaca gratinados con chorizo artesanal y chiles toreados con orégano silvestre." },
  { name: "Tuétanos Asados al Grill (2 pzas)", cat: "Entradas", price: 24000, badges: [], soldOut: true, desc: "Canoas de tuétano a las brasas con chimichurri rústico de cilantro silvestre y tortillas de comal recién infladas." },
  { name: "Tacos de Rib Eye con Tuétano", cat: "Tacos", price: 31000, badges: ["picante"], photo: "tacos-de-rib-eye-con-tuetano", desc: "Láminas de rib eye selladas a fuego vivo sobre costra de queso Oaxaca, cebollitas cambray y salsa tatemada." },
  { name: "Tacos al Pastor de Lechón", was: "Tacos al pastor (3)", cat: "Tacos", price: 27000, badges: ["nuevo"], photo: "tacos-al-pastor-de-lechon", desc: "Lechón confitado 12 horas en adobo de chiles secos, piña asada al carbón, cebolla morada encurtida y cilantro." },
  { name: "Rib Eye al Mezcal y Café de Olla (400g)", was: "Rib eye 400 g", cat: "Fuertes", price: 62000, badges: ["nuevo", "recomendado"], photo: "rib-eye-al-mezcal-y-cafe-de-olla-400g", desc: "Sellado con mantequilla de romero silvestre, sal de grano de Colima y papas cambray doradas." },
  { name: "Hamburguesa Artesanal Convivium", was: "Hamburguesa Convivium", cat: "Fuertes", price: 26500, badges: ["recomendado"], photo: "hamburguesa-artesanal-convivium", desc: "Picaña molida a mano, provolone ahumado, cebolla caramelizada al vino tinto y brioche tostado." },
  { name: "Enchiladas Suizas de Pato Confitado", cat: "Fuertes", price: 29500, badges: [], photo: "enchiladas-suizas-de-pato-confitado", desc: "Tortillas de maíz criollo en salsa cremosa de tomatillo, pato desmenuzado y gratín de queso de cuadro de Chiapas." },
  { name: "Pulpo Enamorado a la Parrilla", cat: "Fuertes", price: 38000, badges: ["picante", "nuevo"], photo: "pulpo-enamorado-a-la-parrilla", desc: "Tentáculo a las brasas con adobo de tres chiles, puré de camote amarillo y reducción de naranja agria." },
  { name: "Pastel de Elote Tierno con Helado de Mezcal", cat: "Postres", price: 14500, badges: ["vegetariano"], photo: "pastel-de-elote-tierno-con-helado-de-mezcal", desc: "Bizcocho húmedo de maíz criollo, cajeta de Celaya al romero y helado artesanal de mezcal." },
  { name: "Margarita de Tamarindo y Morita", was: "Margarita de tamarindo", cat: "Bebidas", price: 16500, badges: ["picante", "nuevo", "recomendado"], photo: "margarita-de-tamarindo-y-morita", bar: true, desc: "Mezcal joven, pulpa de tamarindo criollo, escarchado de sal de gusano y chile morita." },
  { name: "Carajillo Oaxaqueño", cat: "Bebidas", price: 18000, badges: [], photo: "carajillo-oaxaqueno", bar: true, desc: "Espresso doble de Chiapas, Licor 43 batido a mano, toque de mezcal tobalá y canela flameada en mesa." },
  { name: "Mezcal Espadín (copa)", cat: "Bebidas", price: 13000, badges: [], bar: true, desc: "Mezcal espadín joven de Oaxaca, servido con naranja y sal de gusano." },
];

async function main() {
  const [tenant] = await db.select().from(schema.tenants).limit(1);
  const t = tenant!.id;
  const [branch] = await db.select().from(schema.branches).where(eq(schema.branches.tenantId, t));
  const stations = await db.select().from(schema.stations).where(eq(schema.stations.tenantId, t));
  const kitchen = stations.find((s) => s.kind !== "barra") ?? stations[0]!;
  const bar = stations.find((s) => s.kind === "barra") ?? kitchen;
  mkdirSync(MEDIA, { recursive: true });

  // Categorías en el orden del diseño; "Cocteles" del seed básico pasa a "Bebidas".
  const cats = await db.select().from(schema.categories).where(eq(schema.categories.tenantId, t));
  const old = cats.find((c) => c.name === "Cocteles");
  if (old && !cats.some((c) => c.name === "Bebidas")) await db.update(schema.categories).set({ name: "Bebidas" }).where(eq(schema.categories.id, old.id));
  const catId: Record<string, string> = {};
  for (const [i, name] of CATS.entries()) {
    const [found] = await db.select().from(schema.categories).where(and(eq(schema.categories.tenantId, t), eq(schema.categories.name, name)));
    const row = found ? (await db.update(schema.categories).set({ sortOrder: i + 1, active: true }).where(eq(schema.categories.id, found.id)).returning())[0]! : (await db.insert(schema.categories).values({ tenantId: t, name, sortOrder: i + 1 }).returning())[0]!;
    catId[name] = row.id;
  }

  for (const d of DISHES) {
    const photoUrl = d.photo ? `/media/carta-${d.photo}.jpg` : null;
    if (d.photo) copyFileSync(`${FOTOS}/${d.photo}.jpg`, `${MEDIA}/carta-${d.photo}.jpg`);
    const data = { name: d.name, categoryId: catId[d.cat]!, price: d.price, description: d.desc, badges: d.badges, photoUrl, active: true, updatedAt: new Date() };
    const byName = async (n: string) => (await db.select().from(schema.products).where(and(eq(schema.products.tenantId, t), eq(schema.products.name, n))))[0];
    const existing = (await byName(d.name)) ?? (d.was ? await byName(d.was) : undefined);
    let id: string;
    if (existing) { await db.update(schema.products).set(data).where(eq(schema.products.id, existing.id)); id = existing.id; }
    else {
      id = (await db.insert(schema.products).values({ ...data, tenantId: t, targetPrepSec: d.bar ? 240 : 720 }).returning())[0]!.id;
      await db.insert(schema.productStations).values({ productId: id, stationId: (d.bar ? bar : kitchen).id });
    }
    await db.insert(schema.productAvailability).values({ productId: id, branchId: branch!.id, soldOut: !!d.soldOut })
      .onConflictDoUpdate({ target: [schema.productAvailability.productId, schema.productAvailability.branchId], set: { soldOut: !!d.soldOut } });
  }

  // Happy hour de margaritas, como el banner del diseño.
  const margarita = (await db.select().from(schema.products).where(and(eq(schema.products.tenantId, t), eq(schema.products.name, "Margarita de Tamarindo y Morita"))))[0]!;
  const [promo] = await db.select().from(schema.promotions).where(and(eq(schema.promotions.tenantId, t), eq(schema.promotions.name, "Happy hour · 2x1 en margaritas")));
  const promoData = { kind: "dos_por_uno" as const, productIds: [margarita.id], days: [], startTime: "17:00", endTime: "19:00", status: "activa" as const };
  if (promo) await db.update(schema.promotions).set(promoData).where(eq(schema.promotions.id, promo.id));
  else await db.insert(schema.promotions).values({ tenantId: t, name: "Happy hour · 2x1 en margaritas", ...promoData });

  // Identidad del restaurante (marca blanca): la demo usa la paleta de CONVIVIUM.
  if (!tenant!.branding) await db.update(schema.tenants).set({ branding: { name: "CONVIVIUM", slogan: "Donde todo sucede en la mesa", logoUrl: null, primary: "#1E2F28", accent: "#D4AF7C", background: "#EAE6DD", text: "#1A1A1A", fontHeading: "Playfair Display", fontBody: "Inter" } }).where(eq(schema.tenants.id, t));

  // Datos de contacto del menú (dirección, teléfono y WhatsApp del diseño).
  const [pub] = await db.select().from(schema.menuPublications).where(eq(schema.menuPublications.branchId, branch!.id));
  if (pub) {
    const config = { ...(pub.config as Record<string, unknown>), title: "CONVIVIUM", subtitle: "Donde todo sucede en la mesa", address: "Av. Álvaro Obregón 130, Roma Norte, CDMX", phone: "55 5208 4321", whatsapp: "5552084321", footer: "", showPromos: true, showSoldOut: true, showDescriptions: true };
    await db.update(schema.menuPublications).set({ config, published: true }).where(eq(schema.menuPublications.id, pub.id));
  }
  console.log(`Carta lista: ${DISHES.length} platillos, fotos en ${MEDIA}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
