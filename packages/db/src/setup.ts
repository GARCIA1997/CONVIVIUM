/**
 * Alta de una empresa real en producción (sin datos de demostración).
 * Crea empresa, sucursal, usuario Dueño (correo + contraseña + PIN), estaciones Cocina y Barra,
 * almacenes, motivos base y un área de salón vacía. Imprime un código de vinculación de 24 h.
 *
 * Uso (en la nube o en un nodo nuevo):
 *   pnpm --filter @convivium/db setup -- --empresa "Mi Restaurante" --sucursal "Centro" \
 *     --nombre "Ana Pérez" --email ana@mirestaurante.mx --password 'Segura123!' --pin 4821
 * Para agregar otra sucursal a una empresa existente:
 *   pnpm --filter @convivium/db setup -- --agregar-sucursal "Polanco" --email ana@mirestaurante.mx
 */
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { runMigrations } from "./migrate.js";
import { createDb, schema } from "./index.js";

const url = process.env.DATABASE_URL ?? "postgres://convivium:convivium@localhost:5432/convivium";
const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const fail = (msg: string): never => { console.error(`✗ ${msg}`); process.exit(1); };
const code6 = () => String(Math.floor(100000 + Math.random() * 900000));

async function baseBranch(db: ReturnType<typeof createDb>, tenantId: string, name: string) {
  const [b] = await db.insert(schema.branches).values({ tenantId, name }).returning();
  const branchId = b!.id;
  await db.insert(schema.stations).values([
    { tenantId, branchId, name: "Cocina", kind: "cocina", defaultTargetSec: 900 },
    { tenantId, branchId, name: "Barra", kind: "barra", defaultTargetSec: 300 },
  ]);
  await db.insert(schema.warehouses).values(["General", "Cocina", "Barra"].map((n) => ({ tenantId, branchId, name: n })));
  await db.insert(schema.areas).values({ tenantId, branchId, name: "Salón", sortOrder: 1 });
  const code = code6();
  await db.insert(schema.pairingCodes).values({ code, tenantId, branchId, expiresAt: new Date(Date.now() + 864e5) });
  return { branchId, code };
}

async function main() {
  await runMigrations(url);
  const db = createDb(url);
  const email = arg("email")?.toLowerCase() ?? fail("Falta --email");

  const extra = arg("agregar-sucursal");
  if (extra) {
    const [owner] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    if (!owner) fail(`No existe un usuario con correo ${email}`);
    const { branchId, code } = await baseBranch(db, owner!.tenantId, extra);
    await db.insert(schema.userRoles).values({ userId: owner!.id, branchId, role: "dueno" });
    console.log(`✓ Sucursal "${extra}" creada (${branchId}).\n  Código para vincular su nodo o dispositivos (24 h): ${code}`);
    process.exit(0);
  }

  const empresa = arg("empresa") ?? fail("Falta --empresa");
  const sucursal = arg("sucursal") ?? "Principal";
  const nombre = arg("nombre") ?? fail("Falta --nombre");
  const password = arg("password") ?? fail("Falta --password");
  const pin = arg("pin") ?? fail("Falta --pin (4 a 6 dígitos)");
  if (password.length < 10) fail("La contraseña debe tener al menos 10 caracteres");
  if (!/^\d{4,6}$/.test(pin)) fail("El PIN debe tener 4 a 6 dígitos");
  const [exists] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (exists) fail(`Ya existe un usuario con correo ${email}`);

  const [tenant] = await db.insert(schema.tenants).values({ name: empresa }).returning();
  const t = tenant!.id;
  const { branchId, code } = await baseBranch(db, t, sucursal);
  const [u] = await db.insert(schema.users).values({ tenantId: t, name: nombre, email, passwordHash: await bcrypt.hash(password, 10), pinHash: await bcrypt.hash(pin, 10) }).returning();
  await db.insert(schema.userRoles).values({ userId: u!.id, branchId, role: "dueno" });
  for (const [kind, label] of [
    ["devolucion", "Frío"], ["devolucion", "Mal término"], ["devolucion", "Equivocado"], ["devolucion", "Objeto extraño"],
    ["cancelacion", "Cliente cambió de opinión"], ["cancelacion", "Error de captura"],
    ["cortesia", "Cliente frecuente"], ["cortesia", "Compensación por demora"],
    ["merma", "Caducado"], ["merma", "Derrame o accidente"],
  ] as const) await db.insert(schema.reasons).values({ tenantId: t, kind, label });

  console.log(`✓ Empresa "${empresa}" lista.
  Sucursal: ${sucursal} (${branchId})
  Dueño:    ${nombre} <${email}> — entra a /admin/ con su correo y contraseña; PIN para caja y comandero.
  Código para vincular el nodo y los dispositivos (24 h): ${code}
  Siguiente: en /admin/ captura menú, mesas, personal y recetas.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
