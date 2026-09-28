import { DEFAULT_DISCOUNT_CAP, expandRole, type Role } from "./roles.js";

/**
 * ¿El descuento solicitado cabe en el tope del solicitante? (HU E3-08, E5-05)
 * Si no, se crea una solicitud de aprobación remota (E5-01) o por PIN (E5-02).
 */
export function discountNeedsApproval(
  roles: Role[],
  requestedPct: number,
  caps: Record<Role, number | null> = DEFAULT_DISCOUNT_CAP,
): boolean {
  let best = 0;
  for (const role of roles) {
    for (const r of expandRole(role)) {
      const cap = caps[r];
      if (cap === null) return false; // ilimitado
      best = Math.max(best, cap);
    }
  }
  return requestedPct > best;
}
