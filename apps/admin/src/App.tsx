import type { Session } from "@convivium/api-client";
import { client } from "@convivium/app-shell";
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ApprovalsPage } from "./features/approvals/ApprovalsPage";
import { LoginPage } from "./features/auth/LoginPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { AdminHeader, AdminLayout, type Section } from "./features/layout/AdminLayout";
import { CountPage } from "./features/inventory/CountPage";
import { InventoryPage } from "./features/inventory/InventoryPage";
import { RecipesPage } from "./features/inventory/RecipesPage";
import { AuditPage } from "./features/audit/AuditPage";
import { MenuPage } from "./features/menu/MenuPage";
import { MenuEngineeringPage } from "./features/reports/MenuEngineeringPage";
import { PromotionsPage } from "./features/promotions/PromotionsPage";
import { ReportsPage } from "./features/reports/ReportsPage";
import { FloorEditorPage } from "./features/floor/FloorEditorPage";
import { StationsPage } from "./features/stations/StationsPage";
import { RolesPage } from "./features/users/RolesPage";
import { UsersPage } from "./features/users/UsersPage";
import { PayablesPage } from "./features/purchasing/PayablesPage";
import { PurchasesPage } from "./features/purchasing/PurchasesPage";
import { ReceptionPage } from "./features/purchasing/ReceptionPage";

/** Secciones de administración; `perm` define quién las ve (roles jerárquicos, E1-07). */
const SECTIONS: (Section & { design?: string })[] = [
  { path: "inicio", label: "Inicio", icon: "dashboard", perm: "reportes.ver", element: <DashboardPage /> },
  { path: "aprobaciones", label: "Aprobaciones", icon: "verified", perm: "aprobacion.resolver", element: <ApprovalsPage /> },
  { path: "menu", label: "Menú", icon: "restaurant_menu", perm: "menu.editar", element: <MenuPage /> },
  { path: "promociones", label: "Promociones", icon: "local_offer", perm: "menu.editar", element: <PromotionsPage /> },
  { path: "mesas", label: "Mesas", icon: "table_restaurant", perm: "mesas.editar", element: <FloorEditorPage /> },
  { path: "estaciones", label: "Estaciones y dispositivos", icon: "skillet", perm: "estaciones.editar", element: <StationsPage /> },
  { path: "usuarios", label: "Usuarios", icon: "group", perm: "usuarios.gestionar", element: <UsersPage /> },
  { path: "roles", label: "Editor de roles", icon: "admin_panel_settings", perm: "roles.gestionar", element: <RolesPage /> },
  { path: "inventario", label: "Insumos y almacenes", icon: "inventory_2", perm: "inventario.contar", element: <InventoryPage /> },
  { path: "recetas", label: "Recetas", icon: "menu_book", perm: "inventario.contar", element: <RecipesPage /> },
  { path: "conteo", label: "Conteo físico", icon: "fact_check", perm: "inventario.contar", element: <CountPage /> },
  { path: "compras", label: "Compras", icon: "shopping_cart", perm: "compras.proponer_oc", element: <PurchasesPage /> },
  { path: "recepcion", label: "Recepción", icon: "local_shipping", perm: "compras.recibir", element: <ReceptionPage /> },
  { path: "cxp", label: "Cuentas por pagar", icon: "account_balance_wallet", perm: "cxp.pagar", element: <PayablesPage /> },
  { path: "reportes", label: "Reportes", icon: "bar_chart", perm: "reportes.ver", element: <ReportsPage /> },
  { path: "ingenieria-menu", label: "Ingeniería de menú", icon: "scatter_plot", perm: "dashboard.ver", element: <MenuEngineeringPage /> },
  { path: "bitacora", label: "Bitácora", icon: "history", perm: "auditoria.ver", element: <AuditPage /> },
];

export function App() {
  const [session, setSession] = useState<Session | null>(client.session);
  useEffect(() => client.onSessionChange(setSession), []);
  if (!session) return <LoginPage onLogin={setSession} />;
  const visible = SECTIONS.filter((s) => session.permissions.includes(s.perm));
  const logout = () => { client.logout(); setSession(null); };
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AdminLayout session={session} sections={visible} onLogout={logout}>
        <Routes>
          <Route path="/" element={<Navigate to={`/${visible[0]?.path ?? "inicio"}`} />} />
          {visible.map((s) => <Route key={s.path} path={`/${s.path}`} element={s.element ?? <Pending title={s.label} design={s.design!} />} />)}
        </Routes>
      </AdminLayout>
    </BrowserRouter>
  );
}

function Pending({ title, design }: { title: string; design: string }) {
  return (
    <>
      <AdminHeader />
      <main className="flex-1 p-8">
        <h1 className="font-display text-3xl font-bold text-neutral-900 tracking-tight">{title}</h1>
        <div className="mt-6 max-w-xl bg-white border border-[#C9B89F]/60 rounded-xl p-5 text-sm text-neutral-600 flex items-start gap-3">
          <span className="material-symbols-outlined text-[#D4AF7C]">design_services</span>
          <p>Diseño listo en <code className="font-mono text-xs bg-stone-100 px-1.5 py-0.5 rounded">design/stitch/{design}.html</code>. Se conecta a datos en un incremento posterior.</p>
        </div>
      </main>
    </>
  );
}
