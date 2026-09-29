/* Diseño: design/stitch/admin-bitacora.html (Stitch). Marcado y clases originales; datos reales. E1-06. */
import { client } from "@convivium/app-shell";
import { useCallback, useEffect, useState } from "react";

type Period = "hoy" | "7d" | "30d";
interface AuditItem {
  seq: number; id: string; at: string; type: string; category: string; critical: boolean; detail: string; data: unknown;
  actor: { id: string; name: string; roles: string[] } | null; authorizedBy: string | null; device: { name: string; kind: string } | null;
}
interface Summary { total: number; critical: number; authorized: number; byCategory: Record<string, number>; discounts: number; waste: number }

const CAT: Record<string, { label: string; icon: string; cls: string }> = {
  cancelacion: { label: "Cancelación", icon: "cancel", cls: "bg-[#F8ECE8] text-[#B45A3C] border-[#B45A3C]/30" },
  devolucion: { label: "Devolución", icon: "remove_shopping_cart", cls: "bg-[#F8ECE8] text-[#B45A3C] border-[#B45A3C]/30" },
  reapertura: { label: "Reapertura de cuenta", icon: "lock_open", cls: "bg-stone-100 text-stone-800 border-stone-300" },
  catalogo: { label: "Cambio de catálogo", icon: "edit_note", cls: "bg-amber-100 text-amber-900 border-amber-300" },
  autorizacion: { label: "Autorización", icon: "verified_user", cls: "bg-[#F0F4F2] text-[#1E2F28] border-[#1E2F28]/20" },
  inventario: { label: "Inventario", icon: "inventory_2", cls: "bg-stone-100 text-stone-800 border-stone-300" },
  compras: { label: "Compras", icon: "shopping_cart", cls: "bg-stone-100 text-stone-800 border-stone-300" },
  caja: { label: "Caja", icon: "point_of_sale", cls: "bg-stone-100 text-stone-800 border-stone-300" },
  configuracion: { label: "Configuración", icon: "settings", cls: "bg-stone-100 text-stone-800 border-stone-300" },
  operacion: { label: "Operación", icon: "restaurant", cls: "bg-stone-100 text-stone-700 border-stone-200" },
};
const ROLE: Record<string, string> = { dueno: "Dueño", gerente: "Gerente", capitan: "Capitán", mesero: "Mesero", cajero: "Cajero", cocina: "Cocina", barra: "Barra", almacenista: "Almacén" };
const money = (c: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(c / 100);
const initials = (n: string) => n.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

export function AuditPage() {
  const [period, setPeriod] = useState<Period>("hoy");
  const [category, setCategory] = useState<string | null>(null);
  const [actor, setActor] = useState<string>("");
  const [items, setItems] = useState<AuditItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [sel, setSel] = useState<AuditItem | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ period, ...(category ? { category } : {}), ...(actor ? { actorId: actor } : {}) });
    const [list, sum] = await Promise.all([
      client.request<{ items: AuditItem[] }>("GET", `/audit?${qs}`),
      client.request<Summary>("GET", `/audit/summary?period=${period}`),
    ]);
    setItems(list.items); setSummary(sum);
    setUsers((u) => (u.length ? u : [...new Map(list.items.filter((i) => i.actor).map((i) => [i.actor!.id, { id: i.actor!.id, name: i.actor!.name }])).values()]));
  }, [period, category, actor]);
  useEffect(() => { load(); }, [load]);

  const shown = items.filter((i) => `${i.detail} ${i.actor?.name ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <main className="flex-1 flex flex-col min-h-screen min-w-0 bg-[#F7F5F0]">
      <header className="bg-stone-100 flex justify-between items-center w-full px-6 py-3 border-b border-stone-300 z-20 shrink-0 flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-stone-800 text-xl font-semibold">shield</span>
            <h1 className="font-headline text-base font-bold text-stone-900 tracking-wide">Bitácora de Auditoría</h1>
          </div>
          <div className="h-4 w-px bg-stone-300" />
          <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#1E2F28]/10 border border-[#1E2F28]/25 text-[#1E2F28] text-xs font-medium">
            <span className="material-symbols-outlined text-sm text-[#1E2F28]">lock</span>
            <span className="text-stone-900 font-semibold">Solo Dueño · Registro Inmutable</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-base">search</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en eventos" className="pl-8 pr-3 py-1.5 w-64 text-xs bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-[#1E2F28] focus:border-[#1E2F28]" />
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />Nodo en Vivo
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-y-auto px-6 py-5 gap-5">
          {summary && (
            <section aria-label="Métricas Clave de Auditoría" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-white border border-[#C9B89F]/40 shadow-sm flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-headline tracking-wider uppercase text-stone-500 font-semibold">Eventos Críticos</span>
                    <p className="font-serif-title text-2xl font-bold text-[#B45A3C] mt-1">{summary.critical} acciones</p>
                  </div>
                  <span className="w-9 h-9 rounded-lg bg-[#F8ECE8] text-[#B45A3C] flex items-center justify-center"><span className="material-symbols-outlined text-lg">warning</span></span>
                </div>
                <div className="mt-3 text-[11px] text-stone-500 border-t border-stone-100 pt-2">
                  <span className="text-[#B45A3C] font-semibold">{summary.byCategory.cancelacion ?? 0} cancelaciones</span> · {summary.byCategory.devolucion ?? 0} devoluciones · {summary.byCategory.catalogo ?? 0} cambios de catálogo
                </div>
              </div>
              <div className="p-4 rounded-lg bg-white border border-[#C9B89F]/40 shadow-sm flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-headline tracking-wider uppercase text-stone-500 font-semibold">Impacto Bonificado / Merma</span>
                    <p className="font-serif-title text-2xl font-bold text-stone-900 mt-1">{money(summary.discounts + summary.waste)} <span className="text-xs font-body font-normal text-stone-500">MXN</span></p>
                  </div>
                  <span className="w-9 h-9 rounded-lg bg-[#F0F4F2] text-[#1E2F28] flex items-center justify-center"><span className="material-symbols-outlined text-lg">loyalty</span></span>
                </div>
                <div className="mt-3 text-[11px] text-stone-500 border-t border-stone-100 pt-2"><span className="font-medium text-stone-700">Descuentos y cortesías ({money(summary.discounts)})</span> · Mermas ({money(summary.waste)})</div>
              </div>
              <div className="p-4 rounded-lg bg-white border border-[#C9B89F]/40 shadow-sm flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-headline tracking-wider uppercase text-stone-500 font-semibold">Acciones Autorizadas</span>
                    <p className="font-serif-title text-2xl font-bold text-stone-900 mt-1">{summary.authorized} firmas</p>
                  </div>
                  <span className="w-9 h-9 rounded-lg bg-[#F3E9DA] text-[#9E8C73] flex items-center justify-center"><span className="material-symbols-outlined text-lg">fingerprint</span></span>
                </div>
                <div className="mt-3 text-[11px] text-stone-500 border-t border-stone-100 pt-2">Con aprobación remota o PIN de gerente</div>
              </div>
              <div className="p-4 rounded-lg bg-[#1E2F28] text-white border border-stone-800 shadow-sm flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-headline tracking-widest uppercase text-[#D4AF7C] font-semibold">Registro Inmutable</span>
                    <p className="font-serif-title text-2xl font-bold text-white mt-1">{summary.total} eventos</p>
                  </div>
                  <span className="w-9 h-9 rounded-lg bg-[#283E35] text-[#D4AF7C] flex items-center justify-center"><span className="material-symbols-outlined text-lg">lock</span></span>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-stone-300 border-t border-[#283E35] pt-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Sin borrado ni edición permitidos
                </div>
              </div>
            </section>
          )}

          <div className="bg-white rounded-lg border border-[#C9B89F]/50 p-4 shadow-sm flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-stone-300 p-0.5 bg-stone-100 text-xs">
                {([["hoy", "Hoy"], ["7d", "Últimos 7 días"], ["30d", "Últimos 30 días"]] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setPeriod(k)} className={period === k ? "px-2.5 py-1 rounded bg-white font-medium text-stone-900 shadow-sm" : "px-2.5 py-1 rounded text-stone-600 hover:text-stone-900"}>{l}</button>
                ))}
              </div>
              <select value={actor} onChange={(e) => setActor(e.target.value)} className="text-xs bg-stone-50 border border-stone-300 rounded-lg px-2.5 py-1.5 text-stone-700 focus:ring-1 focus:ring-[#1E2F28]">
                <option value="">Todos los colaboradores</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span className="text-[11px] uppercase tracking-wider text-stone-400 font-semibold mr-1 shrink-0">Acción:</span>
              <button onClick={() => setCategory(null)} className={category === null ? "px-2.5 py-1 rounded-full bg-[#1E2F28] text-amber-100 font-medium shrink-0" : "px-2.5 py-1 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 shrink-0"}>Todas ({summary?.total ?? 0})</button>
              {Object.entries(summary?.byCategory ?? {}).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                <button key={k} onClick={() => setCategory(k)} className={category === k ? "px-2.5 py-1 rounded-full bg-[#1E2F28] text-amber-100 font-medium shrink-0" : `px-2.5 py-1 rounded-full border shrink-0 ${CAT[k]?.cls ?? ""}`}>{CAT[k]?.label ?? k} ({n})</button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-[#C9B89F]/50 shadow-sm overflow-hidden flex flex-col flex-1">
            <div className="px-5 py-3 border-b border-stone-200 flex items-center justify-between bg-stone-50/70">
              <div className="flex items-center gap-2">
                <span className="font-headline text-xs font-bold uppercase tracking-wider text-stone-700">Eventos de Auditoría Registrados</span>
                <span className="px-2 py-0.5 rounded-full bg-[#1E2F28]/10 text-[#1E2F28] text-[11px] font-bold">{shown.length} eventos</span>
              </div>
              <button onClick={load} className="text-stone-700 hover:text-stone-900 font-medium flex items-center gap-1 text-xs"><span className="material-symbols-outlined text-sm">refresh</span>Actualizar</button>
            </div>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-100/70 text-stone-600 font-headline uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4 font-semibold">Fecha y Hora</th>
                    <th className="py-3 px-4 font-semibold">Colaborador / Rol</th>
                    <th className="py-3 px-4 font-semibold">Tipo de Acción</th>
                    <th className="py-3 px-4 font-semibold">Detalle</th>
                    <th className="py-3 px-4 font-semibold">Autorización</th>
                    <th className="py-3 px-4 font-semibold">Dispositivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-stone-800">
                  {shown.map((e) => {
                    const c = CAT[e.category] ?? CAT.operacion!;
                    const d = new Date(e.at);
                    return (
                      <tr key={e.id} onClick={() => setSel(e)} className={e.id === sel?.id ? "bg-amber-50/40 border-l-4 border-l-[#D4AF7C] hover:bg-amber-50/70 transition-colors cursor-pointer group" : "hover:bg-stone-50/80 transition-colors cursor-pointer"}>
                        <td className="py-3 px-4 font-mono text-[11px] text-stone-600 whitespace-nowrap">
                          <div className="font-bold text-stone-900">{d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}</div>
                          <div className="text-stone-400">{d.toLocaleTimeString("es-MX", { hour12: false })}</div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {e.actor ? (
                            <div className="flex items-center gap-2.5">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] ${e.actor.roles.includes("dueno") || e.actor.roles.includes("gerente") ? "bg-[#1E2F28] text-amber-200" : "bg-stone-200 text-stone-700"}`}>{initials(e.actor.name)}</div>
                              <div>
                                <div className="font-semibold text-stone-900">{e.actor.name}</div>
                                <div className="text-[10px] text-stone-500">{e.actor.roles.map((r) => ROLE[r] ?? r).join(" / ")}</div>
                              </div>
                            </div>
                          ) : <span className="text-stone-400">Sistema</span>}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border font-semibold text-[11px] ${c.cls}`}><span className="material-symbols-outlined text-xs">{c.icon}</span>{c.label}</span>
                        </td>
                        <td className="py-3 px-4 max-w-xs"><p className={`truncate ${e.critical ? "font-semibold text-stone-900" : "font-medium text-stone-900"}`}>{e.detail}</p><p className="text-[10px] text-stone-500 truncate mt-0.5 font-mono">{e.type}</p></td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {e.authorizedBy ? (
                            <><div className="text-stone-900 font-medium">{e.authorizedBy}</div><div className="text-[10px] text-stone-500 flex items-center gap-1"><span className="material-symbols-outlined text-[11px] text-emerald-600">check_circle</span>Autorizó</div></>
                          ) : <span className="text-stone-400">—</span>}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap"><div className="text-stone-800">{e.device?.name ?? "Acceso remoto"}</div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {shown.length === 0 && <p className="p-6 text-xs text-stone-500">Sin eventos en este periodo.</p>}
            </div>
          </div>
        </div>

        {sel && (
          <aside className="w-96 shrink-0 border-l border-stone-300 bg-white overflow-y-auto p-5 hidden lg:block">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-headline text-sm font-bold uppercase tracking-wider text-stone-800">Detalle del evento</h2>
              <button onClick={() => setSel(null)} className="text-stone-400 hover:text-stone-700"><span className="material-symbols-outlined">close</span></button>
            </div>
            <p className="text-sm font-semibold text-stone-900">{sel.detail}</p>
            <p className="text-[11px] text-stone-500 mt-1">{new Date(sel.at).toLocaleString("es-MX")} · #{sel.seq}</p>
            <div className="mt-4 text-xs space-y-1.5">
              <div className="flex justify-between"><span className="text-stone-500">Colaborador</span><span className="font-medium">{sel.actor?.name ?? "Sistema"}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">Autorizó</span><span className="font-medium">{sel.authorizedBy ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">Dispositivo</span><span className="font-medium">{sel.device?.name ?? "Acceso remoto"}</span></div>
            </div>
            <div className="mt-4">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-500">Datos registrados</span>
              <pre className="mt-1 p-3 rounded-lg bg-stone-50 border border-stone-200 text-[10px] font-mono text-stone-700 whitespace-pre-wrap break-all max-h-96 overflow-y-auto">{JSON.stringify(sel.data, null, 2)}</pre>
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}
