/**
 * Valida que los ids que llegan en el cuerpo de una petición pertenezcan al restaurante (y, cuando aplica,
 * a la sucursal) de quien la hace. Sin esto, un id de otro restaurante se guardaría tal cual:
 * existencias ajenas modificadas, comandas enviadas a la estación de otro cliente, etc.
 * Una consulta por tipo; ids repetidos o vacíos se ignoran.
 */
import { and, eq, inArray, schema, type Db } from "@convivium/db";
import type { Principal } from "../plugins/auth.js";
import { AppError } from "../plugins/errors.js";

type Ids = (string | null | undefined)[] | undefined;
export interface Refs {
  ingredients?: Ids;
  warehouses?: Ids;
  suppliers?: Ids;
  products?: Ids;
  categories?: Ids;
  stations?: Ids;
  modifierGroups?: Ids;
  modifiers?: Ids;
  recipes?: Ids;
  users?: Ids;
}

export async function assertOwned(db: Db, who: Principal, refs: Refs) {
  const uniq = (xs: Ids) => [...new Set((xs ?? []).filter((x): x is string => !!x))];
  const checks: [string, string[], (ids: string[]) => Promise<{ id: string }[]>][] = [
    ["insumo", uniq(refs.ingredients), (ids) => db.select({ id: schema.ingredients.id }).from(schema.ingredients).where(and(inArray(schema.ingredients.id, ids), eq(schema.ingredients.tenantId, who.tenantId)))],
    ["almacén", uniq(refs.warehouses), (ids) => db.select({ id: schema.warehouses.id }).from(schema.warehouses).where(and(inArray(schema.warehouses.id, ids), eq(schema.warehouses.branchId, who.branchId)))],
    ["proveedor", uniq(refs.suppliers), (ids) => db.select({ id: schema.suppliers.id }).from(schema.suppliers).where(and(inArray(schema.suppliers.id, ids), eq(schema.suppliers.tenantId, who.tenantId)))],
    ["producto", uniq(refs.products), (ids) => db.select({ id: schema.products.id }).from(schema.products).where(and(inArray(schema.products.id, ids), eq(schema.products.tenantId, who.tenantId)))],
    ["categoría", uniq(refs.categories), (ids) => db.select({ id: schema.categories.id }).from(schema.categories).where(and(inArray(schema.categories.id, ids), eq(schema.categories.tenantId, who.tenantId)))],
    ["estación", uniq(refs.stations), (ids) => db.select({ id: schema.stations.id }).from(schema.stations).where(and(inArray(schema.stations.id, ids), eq(schema.stations.tenantId, who.tenantId)))],
    ["grupo de modificadores", uniq(refs.modifierGroups), (ids) => db.select({ id: schema.modifierGroups.id }).from(schema.modifierGroups).where(and(inArray(schema.modifierGroups.id, ids), eq(schema.modifierGroups.tenantId, who.tenantId)))],
    ["modificador", uniq(refs.modifiers), (ids) => db.select({ id: schema.modifiers.id }).from(schema.modifiers).innerJoin(schema.modifierGroups, eq(schema.modifierGroups.id, schema.modifiers.groupId)).where(and(inArray(schema.modifiers.id, ids), eq(schema.modifierGroups.tenantId, who.tenantId)))],
    ["receta", uniq(refs.recipes), (ids) => db.select({ id: schema.recipes.id }).from(schema.recipes).where(and(inArray(schema.recipes.id, ids), eq(schema.recipes.tenantId, who.tenantId)))],
    ["usuario", uniq(refs.users), (ids) => db.select({ id: schema.users.id }).from(schema.users).where(and(inArray(schema.users.id, ids), eq(schema.users.tenantId, who.tenantId)))],
  ];
  await Promise.all(
    checks.map(async ([label, ids, query]) => {
      if (!ids.length) return;
      const found = await query(ids);
      if (found.length !== ids.length) throw new AppError(400, "bad_reference", `Referencia inválida: ${label}`);
    }),
  );
}
