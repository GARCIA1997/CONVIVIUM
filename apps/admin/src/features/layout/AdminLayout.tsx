/* Diseño: design/stitch/admin-dashboard.html (Stitch) — barra lateral y encabezado de administración. */
import type { Session } from "@convivium/api-client";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

export interface Section {
  path: string;
  label: string;
  icon: string;
  perm: string;
  element?: ReactNode;
}

const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
const ROLE_LABEL: Record<string, string> = { dueno: "Propietario", gerente: "Gerente", capitan: "Capitán", almacenista: "Almacén", cajero: "Cajero" };

export function AdminLayout({ session, sections, onLogout, children }: { session: Session; sections: Section[]; onLogout: () => void; children: ReactNode }) {
  return (
    <div className="bg-[#F7F5F0] text-neutral-800 font-body antialiased min-h-screen flex selection:bg-amber-200/50">
      <aside className="fixed top-0 left-0 h-screen w-64 flex flex-col justify-between bg-neutral-900 border-r border-amber-900/30 shadow-sm z-30 select-none">
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-center gap-3.5 mb-2">
            <div className="w-10 h-10 rounded-full border border-amber-300/40 flex items-center justify-center bg-amber-900/20 text-amber-200 shadow-inner">
              <span className="font-display text-xl font-bold tracking-wider">C</span>
            </div>
            <div>
              <div className="font-headline tracking-widest text-base font-bold uppercase text-amber-100 flex items-center gap-2">
                CONVIVIUM
                <span className="inline-flex items-center whitespace-nowrap px-1.5 py-0.5 rounded text-[10px] font-sans tracking-normal font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">En vivo</span>
              </div>
              <p className="text-[11px] text-neutral-400 font-normal tracking-wide">Donde todo sucede en la mesa</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto custom-scrollbar">
          {sections.map((s) => (
            <NavLink key={s.path} to={`/${s.path}`}
              className={({ isActive }) => isActive
                ? "flex items-center gap-3 px-3 py-2.5 rounded-lg text-amber-200 bg-amber-900/20 font-semibold cursor-pointer select-none transition-colors duration-150"
                : "flex items-center gap-3 px-3 py-2.5 rounded-lg text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800/50 cursor-pointer select-none transition-colors duration-150"}>
              {({ isActive }) => (
                <>
                  <span className={`material-symbols-outlined text-xl ${isActive ? "fill text-amber-200" : ""}`}>{s.icon}</span>
                  <span className="text-sm font-medium">{s.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-neutral-800 space-y-2">
          <div className="pt-2 flex items-center justify-between px-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-neutral-800 border border-amber-300/30 flex items-center justify-center text-xs font-semibold text-amber-200">{initials(session.user.name)}</div>
              <div className="truncate">
                <p className="text-xs font-medium text-neutral-200 truncate">{session.user.name}</p>
                <p className="text-[10px] text-neutral-400 truncate">{session.user.roles.map((r) => ROLE_LABEL[r] ?? r).join(" · ")}</p>
              </div>
            </div>
            <button onClick={onLogout} className="text-neutral-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-neutral-800/50 transition-colors" title="Cerrar sesión">
              <span className="material-symbols-outlined text-lg">logout</span>
            </button>
          </div>
        </div>
      </aside>
      <div className="ml-64 flex-1 flex flex-col min-h-screen min-w-0">{children}</div>
    </div>
  );
}

/** Encabezado superior de cada sección (sucursal + estado en vivo). */
export function AdminHeader({ updatedAgo, actions }: { updatedAgo?: number; actions?: ReactNode }) {
  const today = new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  return (
    <header className="sticky top-0 z-20 bg-[#F7F5F0]/95 backdrop-blur-md border-b border-[#C9B89F]/40 px-8 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2.5 text-left bg-white/80 border border-[#C9B89F]/60 px-3.5 py-1.5 rounded-lg shadow-sm">
          <span className="material-symbols-outlined text-[#1E2F28] text-lg">storefront</span>
          <span className="text-xs font-semibold text-neutral-900 tracking-tight">Sucursal Centro</span>
        </div>
        {updatedAgo !== undefined && (
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
            </span>
            En vivo · <span className="font-normal text-emerald-700">Actualizado hace {updatedAgo}s</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white border border-[#C9B89F]/50 rounded-lg text-xs font-medium text-neutral-700 shadow-sm capitalize">
          <span className="material-symbols-outlined text-neutral-500 text-base">calendar_today</span>
          Hoy, {today}
        </div>
        {actions}
      </div>
    </header>
  );
}
