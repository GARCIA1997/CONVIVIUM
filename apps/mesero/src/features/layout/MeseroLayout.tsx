/* Diseño: design/stitch/mesero-plano-mesas.html (Stitch) — encabezado y navegación inferior. */
import { useSession } from "@convivium/app-shell";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { ReadyNotifications } from "../notifications/ReadyNotifications";

const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

export function MeseroLayout({ children, subheader }: { children: ReactNode; subheader?: ReactNode }) {
  const { session, logout, client } = useSession();
  return (
    <div className="bg-[#1A1A1A] flex justify-center items-start min-h-screen font-body antialiased selection:bg-[#D4AF7C] selection:text-[#1E2F28] p-0">
      <div className="w-full max-w-[414px] min-h-screen bg-[#F5F3EF] flex flex-col relative shadow-2xl overflow-hidden border border-[#C9B89F]/30 pb-20">
        <header className="fixed top-0 max-w-[414px] w-full z-50 flex justify-between items-center px-4 h-12 text-[#EAE6DD] bg-[#1E2F28] border-b border-[#C9B89F]/20">
          <div className="flex items-center gap-1.5 text-xs text-[#C9B89F]">
            <span className="material-symbols-outlined text-[17px] text-[#D4AF7C]">wifi</span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="font-label text-[11px] tracking-wide text-[#EAE6DD]/80">En línea</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-display tracking-[0.2em] font-semibold text-[#EAE6DD] text-base uppercase">CONVIVIUM</span>
          </div>
          <div className="flex items-center gap-2">
            <button aria-label="Cerrar sesión" onClick={logout} className="relative p-1.5 text-[#EAE6DD] hover:bg-[#1E2F28]/80 transition-colors rounded-full">
              <span className="material-symbols-outlined text-[18px] text-[#D4AF7C]/90">lock_clock</span>
            </button>
          </div>
        </header>

        <div className="bg-[#1E2F28] pt-14 pb-3 px-4 text-[#EAE6DD] shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display text-sm tracking-wide text-[#D4AF7C] italic">Servicio de Sala</p>
              <h1 className="text-base font-medium tracking-tight text-[#EAE6DD] flex items-center gap-2">
                <span>Hola, {session.user.name}</span>
                <span className="text-xs font-normal text-[#C9B89F]/80">· {session.user.roles.join(", ")}</span>
              </h1>
            </div>
          </div>
          {subheader}
        </div>

        <ReadyNotifications />
        {children}

        <nav aria-label="Navegación principal" className="fixed bottom-0 max-w-[414px] w-full z-50 bg-[#1E2F28] h-[64px] px-3 flex items-center justify-around text-[#C9B89F] shadow-[0_-4px_12px_rgba(0,0,0,0.15)]">
          <NavLink to="/" end className={({ isActive }) => `flex flex-col items-center justify-center flex-1 py-1 transition-colors ${isActive ? "text-[#D4AF7C] font-medium" : "text-[#C9B89F] opacity-75"}`}>
            <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>table_restaurant</span>
            <span className="text-[10px] font-medium tracking-tight mt-0.5">Mesas</span>
          </NavLink>
          {client.can("aprobacion.resolver") && (
            <NavLink to="/capitan" className={({ isActive }) => `flex flex-col items-center justify-center flex-1 py-1 transition-colors ${isActive ? "text-[#D4AF7C] font-medium" : "text-[#C9B89F] opacity-75"}`}>
              <span className="material-symbols-outlined text-[22px]">supervisor_account</span>
              <span className="text-[10px] tracking-tight mt-0.5">Capitán</span>
            </NavLink>
          )}
          <button onClick={logout} className="flex flex-col items-center justify-center flex-1 py-1 text-[#C9B89F] opacity-75 hover:opacity-100 transition-opacity">
            <div className="w-6 h-6 rounded-full border border-[#D4AF7C]/60 bg-[#14201B] text-[#D4AF7C] flex items-center justify-center text-[10px] font-bold">{initials(session.user.name)}</div>
            <span className="text-[10px] tracking-tight mt-0.5">{session.user.name}</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
