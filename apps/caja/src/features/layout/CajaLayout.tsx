/* Diseño: design/stitch/caja-tpv.html (Stitch) — barra lateral y encabezado de la caja. */
import { useSession } from "@convivium/app-shell";
import type { ReactNode } from "react";

export type CajaView = "cuentas" | "llevar" | "corte";
const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

export function CajaLayout(props: { view: CajaView; onView: (v: CajaView) => void; openCount: number; takeoutCount?: number; sessionOpen: boolean; children: ReactNode }) {
  const { session, logout } = useSession();
  const item = (v: CajaView, icon: string, label: string, badge?: number) =>
    props.view === v ? (
      <button key={v} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-stone-800 text-amber-200 font-medium active:scale-[0.98] transition-transform duration-100 group shadow-sm">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-amber-200">{icon}</span>
          <span className="text-xs tracking-wide">{label}</span>
        </div>
        {badge !== undefined && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-200/20 text-amber-200 border border-amber-200/40">{badge}</span>}
      </button>
    ) : (
      <button key={v} onClick={() => props.onView(v)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800/50 transition-colors active:scale-[0.98] duration-100">
        <span className="material-symbols-outlined text-stone-400">{icon}</span>
        <span className="text-xs tracking-wide">{label}</span>
      </button>
    );

  return (
    <div className="h-full bg-marfil font-body text-carbon antialiased overflow-hidden select-none">
      <div className="flex h-screen w-screen overflow-hidden">
        <aside className="fixed inset-y-0 left-0 w-64 bg-stone-900 flex flex-col justify-between border-r border-stone-800 shadow-xl z-30 transition-all">
          <div className="p-4 flex flex-col h-full justify-between">
            <div>
              <div className="flex items-center gap-3 px-2 pt-1 pb-4 border-b border-stone-800">
                <div className="w-10 h-10 rounded-full bg-stone-800 flex items-center justify-center border border-amber-300/40 text-amber-200 font-serif-cormorant text-xl font-bold shadow-inner">C</div>
                <div className="flex flex-col">
                  <span className="font-headline tracking-widest text-base font-bold text-stone-100 uppercase">CONVIVIUM</span>
                  <span className="text-[10px] text-stone-400 font-light italic truncate tracking-wide">Donde todo sucede en la mesa.</span>
                </div>
              </div>
              <div className="mt-4 px-2 py-1.5 rounded bg-stone-800/80 border border-stone-700/60 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${props.sessionOpen ? "bg-emerald-400 animate-pulse" : "bg-stone-500"}`} />
                  <span className="text-[11px] font-medium tracking-wider uppercase text-stone-300">Caja · 01</span>
                </div>
                <span className="text-[10px] text-amber-200/90 font-mono font-medium">{props.sessionOpen ? "ABIERTA" : "CERRADA"}</span>
              </div>
              {props.sessionOpen && (
                <nav className="mt-6 flex flex-col gap-1.5">
                  {item("cuentas", "receipt_long", "Cuentas", props.openCount)}
                  {item("llevar", "takeout_dining", "Para llevar", props.takeoutCount)}
                  {item("corte", "calculate", "Corte de Turno")}
                </nav>
              )}
            </div>
            <div className="pt-4 border-t border-stone-800 space-y-3">
              <div className="flex items-center gap-3 px-2">
                <div className="w-8 h-8 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center text-xs font-semibold text-stone-300">{initials(session.user.name)}</div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium text-stone-200 truncate">{session.user.name}</span>
                  <span className="text-[10px] text-stone-400 truncate capitalize">{session.user.roles.join(" / ")}</span>
                </div>
                <div className="ml-auto flex items-center text-emerald-400" title="En línea">
                  <span className="material-symbols-outlined text-sm">cloud_done</span>
                </div>
              </div>
              <button onClick={logout} className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-stone-800/60 hover:bg-stone-800 text-stone-400 hover:text-stone-200 text-[11px] transition-colors">
                <span className="material-symbols-outlined text-sm">lock</span>
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </aside>
        <div className="flex-1 flex flex-col pl-64 h-screen overflow-hidden">{props.children}</div>
      </div>
    </div>
  );
}
