/**
 * Datos de prueba de inventario (insumos, existencias, proveedores y recetas). NO usar en producción.
 * Requiere haber corrido seed.ts. Uso: pnpm --filter @convivium/db exec tsx src/seed-inventory.ts
 */
import { eq } from "drizzle-orm";
import { createDb, schema } from "./index.js";

const db = createDb(process.env.DATABASE_URL ?? "postgres://convivium:convivium@localhost:5432/convivium");

async function main() {
  const [tenant] = await db.select().from(schema.tenants).limit(1);
  const [branch] = await db.select().from(schema.branches).where(eq(schema.branches.tenantId, tenant!.id));
  const t = tenant!.id;
  const whs = await db.select().from(schema.warehouses).where(eq(schema.warehouses.branchId, branch!.id));
  const wh = (n: string) => whs.find((w) => w.name === n)!.id;

  // [nombre, categoría, unidad compra, unidad uso, conversión, mín, máx, costo ¢/unidad uso, crítico, almacén, existencia]
  const data: [string, string, string, "g" | "ml" | "pz", number, number, number, number, boolean, string, number][] = [
    ["Tequila blanco", "Destilados", "Botella 750 ml", "ml", 750, 1500, 6000, 52, true, "Barra", 2200],
    ["Licor de naranja", "Licores", "Botella 700 ml", "ml", 700, 700, 2800, 45, false, "Barra", 1400],
    ["Mezcal Espadín", "Destilados", "Botella 750 ml", "ml", 750, 1500, 4500, 70, true, "Barra", 3000],
    ["Pulpa de tamarindo", "Frutas", "Caja 1 kg", "g", 1000, 1000, 4000, 9, false, "Cocina", 2500],
    ["Azúcar", "Abarrotes", "Bolsa 2 kg", "g", 2000, 2000, 8000, 3, false, "General", 6000],
    ["Limón", "Frutas", "Caja 10 kg", "g", 10000, 5000, 15000, 4, true, "Barra", 2100],
    ["Chile-sal", "Abarrotes", "Bote 500 g", "g", 500, 200, 1000, 12, false, "Barra", 400],
    ["Carne molida sirloin", "Proteínas", "Kg", "g", 1000, 3000, 10000, 28, true, "Cocina", 5200],
    ["Pan brioche", "Panadería", "Paquete 12 pz", "pz", 12, 24, 96, 900, false, "Cocina", 40],
    ["Queso gouda", "Lácteos", "Kg", "g", 1000, 1000, 4000, 32, false, "Cocina", 1800],
    ["Rib eye", "Proteínas", "Kg", "g", 1000, 4000, 12000, 52, true, "Cocina", 6000],
    ["Carne al pastor", "Proteínas", "Kg", "g", 1000, 3000, 9000, 18, false, "Cocina", 4500],
    ["Tortilla de maíz", "Panadería", "Paquete 30 pz", "pz", 30, 60, 300, 150, false, "Cocina", 180],
    ["Aguacate Hass", "Frutas", "Caja 10 kg", "g", 10000, 3000, 12000, 7, true, "Cocina", 2600],
  ];
  const id: Record<string, string> = {};
  for (const [name, category, pu, uu, conv, min, max, cost, critical, w, qty] of data) {
    const [ing] = await db
      .insert(schema.ingredients)
      .values({ tenantId: t, name, category, purchaseUnit: pu, useUnit: uu, conversion: String(conv), minStock: String(min), maxStock: String(max), avgCost: cost, critical })
      .returning();
    id[name] = ing!.id;
    await db.insert(schema.stock).values({ tenantId: t, warehouseId: wh(w), ingredientId: ing!.id, quantity: String(qty) });
  }

  const [verduras] = await db.insert(schema.suppliers).values({ tenantId: t, name: "Verduras del Bajío", creditDays: 15, phone: "4421234567" }).returning();
  const [cava] = await db.insert(schema.suppliers).values({ tenantId: t, name: "Vinos y Licores La Cava", creditDays: 30 }).returning();
  const [carnes] = await db.insert(schema.suppliers).values({ tenantId: t, name: "Carnes Selectas del Norte", creditDays: 8 }).returning();
  const today = new Date().toISOString().slice(0, 10);
  const prices: [typeof verduras, string, number][] = [
    [verduras, "Limón", 4200], [verduras, "Aguacate Hass", 7500], [verduras, "Pulpa de tamarindo", 9500],
    [cava, "Tequila blanco", 38000], [cava, "Mezcal Espadín", 52000], [cava, "Licor de naranja", 31000],
    [carnes, "Rib eye", 52000], [carnes, "Carne molida sirloin", 28500], [carnes, "Carne al pastor", 18000],
  ];
  for (const [s, ing, price] of prices) await db.insert(schema.supplierPrices).values({ supplierId: s!.id, ingredientId: id[ing]!, unitPrice: price, validFrom: today });

  const products = await db.select().from(schema.products).where(eq(schema.products.tenantId, t));
  const pid = (prefix: string) => products.find((p) => p.name.startsWith(prefix))!.id;

  const [jarabe] = await db
    .insert(schema.recipes)
    .values({ tenantId: t, name: "Jarabe de tamarindo", isSubRecipe: true, yieldQty: "1000", steps: ["Hervir 600 ml de agua con el azúcar.", "Agregar la pulpa y reducir 15 minutos.", "Colar y enfriar. Vida útil 5 días."] })
    .returning();
  await db.insert(schema.recipeLines).values([
    { recipeId: jarabe!.id, ingredientId: id["Pulpa de tamarindo"], quantity: "400" },
    { recipeId: jarabe!.id, ingredientId: id["Azúcar"], quantity: "300" },
  ]);

  const recipe = async (name: string, productId: string, lines: [string | null, string | null, number, number][], steps: string[]) => {
    const [r] = await db.insert(schema.recipes).values({ tenantId: t, name, productId, steps }).returning();
    await db.insert(schema.recipeLines).values(lines.map(([ing, sub, q, w]) => ({ recipeId: r!.id, ingredientId: ing ? id[ing] : null, subRecipeId: sub, quantity: String(q), wastePct: String(w) })));
  };
  await recipe("Margarita de tamarindo", pid("Margarita"), [["Tequila blanco", null, 45, 0], ["Licor de naranja", null, 15, 0], [null, jarabe!.id, 30, 0], ["Limón", null, 20, 10], ["Chile-sal", null, 5, 0]],
    ["Escarchar la copa con chile-sal.", "Agitar tequila, licor, jarabe y limón con hielo 10 segundos.", "Colar doble sobre la copa.", "Decorar con rueda de limón."]);
  await recipe("Mezcal Espadín (copa)", pid("Mezcal"), [["Mezcal Espadín", null, 45, 0]], ["Servir en copa veladora con naranja y sal de gusano."]);
  await recipe("Hamburguesa Convivium", pid("Hamburguesa"), [["Carne molida sirloin", null, 180, 8], ["Pan brioche", null, 1, 0], ["Queso gouda", null, 30, 0]],
    ["Formar la carne en disco de 180 g.", "Sellar a la plancha según término.", "Fundir el queso los últimos 60 s.", "Tostar el pan y montar."]);
  await recipe("Rib eye 400 g", pid("Rib"), [["Rib eye", null, 400, 5]], ["Atemperar 20 min.", "Sellar a fuego alto y terminar al término pedido.", "Reposar 4 minutos antes de servir."]);
  await recipe("Tacos al pastor (3)", pid("Tacos"), [["Carne al pastor", null, 120, 5], ["Tortilla de maíz", null, 3, 0]], ["Calentar tortillas.", "Servir 40 g de pastor por taco."]);
  await recipe("Guacamole", pid("Guacamole"), [["Aguacate Hass", null, 180, 25], ["Limón", null, 10, 0]], ["Machacar en molcajete, sazonar y servir al momento."]);

  console.log(`Inventario de prueba listo: ${data.length} insumos, 3 proveedores, 7 recetas`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
