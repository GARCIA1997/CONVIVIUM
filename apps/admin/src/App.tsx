import { client } from "@convivium/app-shell";
import type { Session } from "@convivium/api-client";
import { Monogram } from "@convivium/ui";
import { useState } from "react";
import { BrowserRouter, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { ApprovalsPage } from "./features/approvals/ApprovalsPage";
import { LoginPage } from "./features/auth/LoginPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { MenuPage } from "./features/menu/MenuPage";

/** Secciones de administración; `perm` define quién las ve (roles jerárquicos, E1-07). */
const SECTIONS = [
  { path: "inicio", label: "Inicio", perm: "reportes.ver", element: <DashboardPage /> },
  { path: "aprobaciones", label: "Aprobaciones", perm: "aprobacion.resolver", element: <ApprovalsPage /> },
  { path: "menu", label: "Menú", perm: "menu.editar", element: <MenuPage /> },
  { path: "mesas", label: "Mesas", perm: "mesas.editar" },
  { path: "estaciones", label: "Estaciones", perm: "estaciones.editar" },
  { path: "usuarios", label: "Usuarios y roles", perm: "usuarios.gestionar" },
  { path: "inventario", label: "Inventario", perm: "inventario.contar" },
  { path: "compras", label: "Compras", perm: "compras.proponer_oc" },
  { path: "cxp", label: "Cuentas por pagar", perm: "cxp.pagar" },
  { path: "reportes", label: "Reportes", perm: "reportes.ver" },
  { path: "bitacora", label: "Bitácora", perm: "auditoria.ver" },
];

export function App() {
  const [session, setSession] = useState<Session | null>(client.session);
  if (!session) return <LoginPage onLogin={setSession} />;
  const visible = SECTIONS.filter((s) => session.permissions.includes(s.perm));
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "100%" }}>
        <aside style={{ background: "var(--c-olivo)", color: "var(--c-marfil)", padding: 20, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
            <Monogram size={32} color="var(--c-dorado)" />
            <span style={{ fontFamily: "var(--font-display)", letterSpacing: ".2em" }}>CONVIVIUM</span>
          </div>
          {visible.map((s) => (
            <NavLink key={s.path} to={`/${s.path}`} style={({ isActive }) => ({ color: isActive ? "var(--c-dorado)" : "var(--c-marfil)", textDecoration: "none", padding: "10px 8px", borderRadius: 6, background: isActive ? "rgba(212,175,124,.1)" : undefined })}>
              {s.label}
            </NavLink>
          ))}
          <span style={{ flex: 1 }} />
          <div style={{ fontSize: 13, opacity: 0.8 }}>{session.user.name} · {session.user.roles.join(", ")}</div>
          <button className="cv-btn cv-btn--ghost" style={{ color: "var(--c-marfil)", marginTop: 8 }} onClick={() => { client.logout(); setSession(null); }}>Salir</button>
        </aside>
        <main style={{ padding: 32 }}>
          <Routes>
            <Route path="/" element={<Navigate to={`/${visible[0]?.path ?? "inicio"}`} />} />
            {visible.map((s) => <Route key={s.path} path={`/${s.path}`} element={s.element ?? <Pending title={s.label} />} />)}
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function Pending({ title }: { title: string }) {
  return (<><h1>{title}</h1><p style={{ color: "var(--text-muted)" }}>Pantalla diseñada en Stitch; implementación en un incremento posterior.</p></>);
}
