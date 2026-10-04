/**
 * Autoridad de la sucursal (docs/05 §5): si la sucursal tiene nodo, la operación que asigna consecutivos o
 * mueve existencias se hace en el nodo. La nube solo la hace para sucursales sin nodo; si no, los folios
 * chocarían y las existencias de la nube nunca llegarían al nodo (ops viaja solo nodo → nube).
 */
import { and, eq, isNull, schema, type Db } from "@convivium/db";
import { isEdge } from "../config.js";
import { conflict } from "../plugins/errors.js";

export async function assertBranchAuthority(db: Db, branchId: string, what: string) {
  if (isEdge) return;
  const [node] = await db
    .select({ id: schema.devices.id })
    .from(schema.devices)
    .where(and(eq(schema.devices.branchId, branchId), eq(schema.devices.kind, "nodo"), isNull(schema.devices.revokedAt)))
    .limit(1);
  if (node) throw conflict("branch_has_node", `Esta sucursal tiene equipo local: ${what} se hace desde el equipo de la sucursal`);
}
