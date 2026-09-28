/**
 * Jerarquía de roles (HU E1-07).
 * Un rol hereda todos los permisos de los roles que contiene:
 *   Dueño ⊇ Gerente ⊇ { Capitán ⊇ Mesero, Almacenista, Cajero, Cocina, Barra }
 */
export const ROLES = ["dueno", "gerente", "capitan", "mesero", "cajero", "cocina", "barra", "almacenista"] as const;
export type Role = (typeof ROLES)[number];

const INHERITS: Record<Role, Role[]> = {
  dueno: ["gerente"],
  gerente: ["capitan", "cajero", "cocina", "barra", "almacenista"],
  capitan: ["mesero"],
  mesero: [],
  cajero: [],
  cocina: [],
  barra: [],
  almacenista: [],
};

export const PERMISSIONS = [
  // Operación
  "mesa.abrir",
  "comanda.capturar",
  "comanda.cancelar_no_enviado",
  "comanda.cancelar_enviado",
  "comanda.cancelar_preparado",
  "comanda.devolver",
  "cortesia.aplicar",
  "descuento.aplicar",
  "cuenta.reabrir",
  "cuenta_barra.abrir",
  "estacion.despachar",
  // Caja
  "caja.abrir",
  "caja.cobrar",
  "caja.movimiento",
  "caja.corte_x",
  "caja.corte_z",
  // Aprobaciones
  "aprobacion.resolver",
  // Inventario y compras
  "inventario.gestionar",
  "inventario.contar",
  "inventario.aprobar_ajuste",
  "compras.proponer_oc",
  "compras.aprobar_oc",
  "compras.recibir",
  "cxp.pagar",
  // Administración
  "menu.editar",
  "mesas.editar",
  "estaciones.editar",
  "usuarios.gestionar",
  "roles.gestionar",
  "reportes.ver",
  "dashboard.ver",
  "auditoria.ver",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Permisos propios de cada rol (sin contar los heredados). */
const OWN: Record<Role, Permission[]> = {
  mesero: ["mesa.abrir", "comanda.capturar", "comanda.cancelar_no_enviado", "comanda.devolver", "cuenta_barra.abrir"],
  capitan: ["comanda.cancelar_enviado", "cortesia.aplicar", "descuento.aplicar", "aprobacion.resolver"],
  cajero: ["caja.abrir", "caja.cobrar", "caja.movimiento", "caja.corte_x"],
  cocina: ["estacion.despachar"],
  barra: ["estacion.despachar", "cuenta_barra.abrir"],
  // Almacenista: sin pagos a proveedores ni aprobación de sus propios ajustes (separación de funciones).
  almacenista: ["inventario.gestionar", "inventario.contar", "compras.proponer_oc", "compras.recibir"],
  gerente: [
    "comanda.cancelar_preparado",
    "cuenta.reabrir",
    "caja.corte_z",
    "inventario.aprobar_ajuste",
    "compras.aprobar_oc",
    "cxp.pagar",
    "menu.editar",
    "mesas.editar",
    "estaciones.editar",
    "usuarios.gestionar",
    "reportes.ver",
  ],
  dueno: ["roles.gestionar", "dashboard.ver", "auditoria.ver"],
};

/** Todos los roles contenidos por `role`, incluido él mismo. */
export function expandRole(role: Role): Role[] {
  const out = new Set<Role>([role]);
  for (const child of INHERITS[role]) for (const r of expandRole(child)) out.add(r);
  return [...out];
}

export function permissionsOf(roles: Role[]): Set<Permission> {
  const perms = new Set<Permission>();
  for (const role of roles) for (const r of expandRole(role)) for (const p of OWN[r]) perms.add(p);
  return perms;
}

export function can(roles: Role[], permission: Permission): boolean {
  return permissionsOf(roles).has(permission);
}

/** Tope de descuento/cortesía por rol, en porcentaje (null = ilimitado). Configurable por empresa. */
export const DEFAULT_DISCOUNT_CAP: Record<Role, number | null> = {
  dueno: null,
  gerente: null,
  capitan: 10,
  mesero: 0,
  cajero: 0,
  cocina: 0,
  barra: 0,
  almacenista: 0,
};
