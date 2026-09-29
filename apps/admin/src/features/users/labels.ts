import type { Permission, Role } from "@convivium/domain";

/** Etiquetas compartidas entre Usuarios y Editor de roles. */
export const ROLE_LABEL: Record<Role, string> = { dueno: "Dueño", gerente: "Gerente", capitan: "Capitán", mesero: "Mesero", cajero: "Cajero", cocina: "Cocina", barra: "Barra", almacenista: "Almacén" };

export const GROUPS: { key: string; label: string; perms: [Permission, string, string][] }[] = [
  { key: "op", label: "Comandas y Cocina", perms: [
    ["mesa.abrir", "Abrir mesa y asignar comensal", "table_restaurant"], ["comanda.capturar", "Capturar y enviar comanda", "edit_note"],
    ["comanda.cancelar_no_enviado", "Cancelar producto no enviado", "remove_shopping_cart"], ["comanda.cancelar_enviado", "Cancelar producto ya enviado", "block"],
    ["comanda.cancelar_preparado", "Cancelar producto preparado", "delete_forever"], ["comanda.devolver", "Registrar devolución", "undo"],
    ["cortesia.aplicar", "Aplicar cortesía", "redeem"], ["descuento.aplicar", "Aplicar descuento", "percent"], ["aprobacion.resolver", "Resolver solicitudes de autorización", "verified_user"],
    ["estacion.despachar", "Despachar en estación (KDS)", "skillet"],
  ] },
  { key: "caja", label: "Caja y Cobro", perms: [
    ["caja.abrir", "Abrir caja", "point_of_sale"], ["caja.cobrar", "Cobrar cuentas", "payments"], ["caja.movimiento", "Entradas y retiros de efectivo", "swap_vert"],
    ["caja.corte_x", "Corte X (parcial)", "receipt_long"], ["caja.corte_z", "Corte Z (cierre)", "lock_clock"], ["cuenta.reabrir", "Reabrir cuenta cobrada", "lock_open"],
  ] },
  { key: "inv", label: "Inventario y Compras", perms: [
    ["inventario.gestionar", "Mermas, traspasos y producción", "inventory_2"], ["inventario.contar", "Conteo físico", "fact_check"], ["inventario.aprobar_ajuste", "Aprobar ajustes de conteo", "rule"],
    ["compras.proponer_oc", "Proponer orden de compra", "shopping_cart"], ["compras.aprobar_oc", "Aprobar orden de compra", "approval"], ["compras.recibir", "Recibir mercancía", "local_shipping"], ["cxp.pagar", "Pagar a proveedores", "account_balance_wallet"],
  ] },
  { key: "admin", label: "Administración", perms: [
    ["menu.editar", "Editar menú y precios", "restaurant_menu"], ["mesas.editar", "Editar plano de mesas", "grid_view"], ["estaciones.editar", "Estaciones y dispositivos", "devices"],
    ["usuarios.gestionar", "Gestionar personal", "group"], ["roles.gestionar", "Asignar roles Dueño/Gerente", "admin_panel_settings"],
    ["reportes.ver", "Ver reportes", "bar_chart"], ["dashboard.ver", "Ver tablero del dueño", "dashboard"], ["auditoria.ver", "Ver bitácora de auditoría", "history_edu"],
  ] },
];

export const PERM_LABEL = Object.fromEntries(GROUPS.flatMap((g) => g.perms.map(([p, l, i]) => [p, { label: l, icon: i, group: g.label }]))) as Record<Permission, { label: string; icon: string; group: string }>;
