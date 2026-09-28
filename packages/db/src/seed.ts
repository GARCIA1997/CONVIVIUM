/**
 * Datos de prueba para desarrollo local. NO usar en producción.
 * Usuarios y PIN de prueba:
 *   Dueño     Alejandra  PIN 1111  (correo dueno@demo.mx / demo12345)
 *   Gerente   Luis       PIN 2222
 *   Capitán   Marco      PIN 3333
 *   Mesero    Ana        PIN 4444
 *   Cajero    Sofía      PIN 5555
 *   Cocina    Pedro      PIN 6666
 *   Barra     Roberto    PIN 7777
 *   Almacén   Carmen     PIN 8888
 * Código de vinculación de dispositivos: 482913
 */
import bcrypt from "bcryptjs";
import { createDb, schema } from "./index.js";

const db = createDb(process.env.DATABASE_URL ?? "postgres://convivium:convivium@localhost:5432/convivium");

async function main() {
  const [tenant] = await db.insert(schema.tenants).values({ name: "Convivium Demo" }).returning();
  const [branch] = await db.insert(schema.branches).values({ tenantId: tenant!.id, name: "Sucursal Centro", usdRate: 1720 }).returning();
  const t = tenant!.id;
  const b = branch!.id;

  const people: [string, string, (typeof schema.roleEnum.enumValues)[number], string?][] = [
    ["Alejandra", "1111", "dueno", "dueno@demo.mx"],
    ["Luis", "2222", "gerente"],
    ["Marco", "3333", "capitan"],
    ["Ana", "4444", "mesero"],
    ["Sofía", "5555", "cajero"],
    ["Pedro", "6666", "cocina"],
    ["Roberto", "7777", "barra"],
    ["Carmen", "8888", "almacenista"],
  ];
  for (const [name, pin, role, email] of people) {
    const [u] = await db
      .insert(schema.users)
      .values({
        tenantId: t,
        name,
        email: email ?? null,
        passwordHash: email ? await bcrypt.hash("demo12345", 10) : null,
        pinHash: await bcrypt.hash(pin, 10),
      })
      .returning();
    await db.insert(schema.userRoles).values({ userId: u!.id, branchId: b, role });
  }

  const [caliente] = await db.insert(schema.stations).values({ tenantId: t, branchId: b, name: "Caliente", kind: "cocina", defaultTargetSec: 900 }).returning();
  const [barra] = await db.insert(schema.stations).values({ tenantId: t, branchId: b, name: "Barra", kind: "barra", defaultTargetSec: 300 }).returning();

  const [entradas] = await db.insert(schema.categories).values({ tenantId: t, name: "Entradas", sortOrder: 1 }).returning();
  const [fuertes] = await db.insert(schema.categories).values({ tenantId: t, name: "Fuertes", sortOrder: 2 }).returning();
  const [cocteles] = await db.insert(schema.categories).values({ tenantId: t, name: "Cocteles", sortOrder: 3 }).returning();

  const [termino] = await db.insert(schema.modifierGroups).values({ tenantId: t, name: "Término", minSelect: 1, maxSelect: 1 }).returning();
  await db.insert(schema.modifiers).values(
    ["Rojo", "Término medio", "Tres cuartos", "Bien cocido"].map((name) => ({ groupId: termino!.id, name })),
  );

  const items = [
    { name: "Guacamole", price: 14500, categoryId: entradas!.id, station: caliente!.id, target: 420 },
    { name: "Tacos al pastor (3)", price: 16500, categoryId: fuertes!.id, station: caliente!.id, target: 600 },
    { name: "Hamburguesa Convivium", price: 24500, categoryId: fuertes!.id, station: caliente!.id, target: 720, termino: true },
    { name: "Rib eye 400 g", price: 62000, categoryId: fuertes!.id, station: caliente!.id, target: 1080, termino: true },
    { name: "Margarita de tamarindo", price: 16500, categoryId: cocteles!.id, station: barra!.id, target: 240, ieps: "26.5" },
    { name: "Mezcal Espadín (copa)", price: 13000, categoryId: cocteles!.id, station: barra!.id, target: 120, ieps: "53" },
  ];
  for (const it of items) {
    const [p] = await db
      .insert(schema.products)
      .values({ tenantId: t, name: it.name, price: it.price, categoryId: it.categoryId, targetPrepSec: it.target, iepsPct: it.ieps ?? "0" })
      .returning();
    await db.insert(schema.productStations).values({ productId: p!.id, stationId: it.station });
    if (it.termino) await db.insert(schema.productModifierGroups).values({ productId: p!.id, groupId: termino!.id });
  }

  const [salon] = await db.insert(schema.areas).values({ tenantId: t, branchId: b, name: "Salón", sortOrder: 1 }).returning();
  const [terraza] = await db.insert(schema.areas).values({ tenantId: t, branchId: b, name: "Terraza", sortOrder: 2 }).returning();
  for (let i = 1; i <= 12; i++) {
    await db.insert(schema.tables).values({
      tenantId: t,
      branchId: b,
      areaId: i <= 8 ? salon!.id : terraza!.id,
      label: `M${i}`,
      capacity: i % 3 === 0 ? 6 : 4,
      shape: i % 2 === 0 ? "redonda" : "cuadrada",
      x: ((i - 1) % 4) * 120,
      y: Math.floor((i - 1) / 4) * 120,
    });
  }

  for (const [kind, label] of [
    ["devolucion", "Frío"], ["devolucion", "Mal término"], ["devolucion", "Equivocado"], ["devolucion", "Objeto extraño"],
    ["cancelacion", "Cliente cambió de opinión"], ["cancelacion", "Error de captura"],
    ["cortesia", "Cliente frecuente"], ["cortesia", "Compensación por demora"], ["merma", "Caducado"],
  ] as const) {
    await db.insert(schema.reasons).values({ tenantId: t, kind, label });
  }

  await db.insert(schema.warehouses).values(
    ["General", "Cocina", "Barra"].map((name) => ({ tenantId: t, branchId: b, name })),
  );

  await db.insert(schema.pairingCodes).values({ code: "482913", tenantId: t, branchId: b, expiresAt: new Date(Date.now() + 365 * 864e5) });

  console.log(`Seed listo. tenant=${t} branch=${b}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
