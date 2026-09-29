/* Diseño: design/stitch/mesero-capitan.html (Stitch). Marcado y clases originales; datos reales. E4-10, E3-10, E5-05. */
import type { ApprovalView } from "@convivium/api-client";
import { useRealtime, useSession } from "@convivium/app-shell";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface Overview {
  delayMin: number;
  delays: { itemId: string; product: string; quantity: number; where: string; waiterId: string; waiterName: string; minutes: number; readyAt: string }[];
  waiters: { id: string; name: string; tables: string[]; checks: number; pendingDelivery: number; inKitchen: number; billRequested: number }[];
  bar: { checkId: string; name: string; total: number; summary: string; minutes: number }[];
  occupancy: { occupied: number; total: number; billRequested: number };
}
const money = (c: number) => `$${(c / 100).toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN`;
const initials = (n: string) => n.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
const KIND: Record<string, string> = { devolucion_retiro: "Retirar de cuenta", cancelacion: "Cancelación", descuento: "Descuento", cortesia: "Cortesía", reapertura: "Reabrir cuenta" };

export function CaptainPage() {
  const { client, session } = useSession();
  const nav = useNavigate();
  const [o, setO] = useState<Overview | null>(null);
  const [approvals, setApprovals] = useState<ApprovalView[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [ov, ap] = await Promise.all([client.request<Overview>("GET", "/orders/floor-overview"), client.approvals.list("pendiente")]);
    setO(ov); setApprovals(ap);
  }, [client]);
  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);
  useRealtime(["floor", "approvals"], () => load());

  const act = (p: Promise<unknown>, text: string) => p.then(() => { setMsg(text); load(); }, (e) => setMsg((e as Error).message));
  if (!o) return <div className="bg-[#EAE6DD] min-h-screen" />;
  const pct = o.occupancy.total ? Math.round((o.occupancy.occupied / o.occupancy.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#EAE6DD] text-carbon font-body antialiased flex justify-center selection:bg-[#D4AF7C] selection:text-[#1E2F28]">
      <div className="w-full max-w-[420px] min-h-screen bg-[#F5F2EB] flex flex-col relative shadow-2xl border-x border-arena/30">
        <header className="bg-[#1E2F28] text-[#EAE6DD] shadow-sm sticky top-0 z-40">
          <div className="flex justify-between items-center w-full px-4 py-3 max-w-md mx-auto">
            <button onClick={() => nav("/")} aria-label="Mesas" className="p-1 text-[#D4AF7C] active:scale-95 transition-transform duration-150 rounded">
              <span className="material-symbols-outlined text-[24px]">table_restaurant</span>
            </button>
            <div className="flex flex-col items-center text-center">
              <span className="font-headline font-semibold text-sm tracking-wide text-[#EAE6DD]">Capitán · {session.user.name}</span>
              <span className="font-label text-[10px] tracking-wider text-[#C9B89F] uppercase font-medium flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-ping" />Supervisión de piso
              </span>
            </div>
            <button onClick={load} aria-label="Actualizar" className="p-1 text-[#D4AF7C] active:scale-95 transition-transform duration-150 rounded">
              <span className="material-symbols-outlined text-[24px]">refresh</span>
            </button>
          </div>
          <div className="px-4 py-2.5 bg-[#16221D] border-t border-[#C9B89F]/15 flex items-center justify-between text-xs">
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <span className="text-[#C9B89F]/80 text-[10px] uppercase tracking-wider font-medium">Mesas Activas</span>
                <span className="font-semibold text-white font-body text-xs"><span className="text-[#D4AF7C] font-bold">{o.occupancy.occupied}</span> / {o.occupancy.total}</span>
              </div>
              <div className="w-px h-6 bg-[#C9B89F]/20" />
              <div className="flex flex-col">
                <span className="text-[#C9B89F]/80 text-[10px] uppercase tracking-wider font-medium">Por Cobrar</span>
                <span className="font-semibold text-[#E07A5A] flex items-center gap-1 font-body text-xs"><span className="material-symbols-outlined text-xs">receipt_long</span>{o.occupancy.billRequested} mesas</span>
              </div>
              <div className="w-px h-6 bg-[#C9B89F]/20" />
              <div className="flex flex-col">
                <span className="text-[#C9B89F]/80 text-[10px] uppercase tracking-wider font-medium">Ocupación</span>
                <span className="font-semibold text-[#D4AF7C] font-body text-xs">{pct}%</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 pt-3.5 pb-12 space-y-4 overflow-y-auto no-scrollbar">
          {msg && <p onClick={() => setMsg(null)} className="text-[11px] text-[#1E2F28] bg-[#D4AF7C]/30 rounded-full px-3 py-1 font-medium text-center">{msg}</p>}

          {o.delays.map((d) => (
            <section key={d.itemId} className="bg-white border-2 border-terracota/80 rounded-xl p-3.5 shadow-sm alert-pulse relative overflow-hidden">
              <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-terracota/5 rounded-full pointer-events-none" />
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-terracota/10 flex items-center justify-center text-terracota shrink-0 mt-0.5"><span className="material-symbols-outlined fill-icon text-[20px]">warning</span></div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold tracking-wider text-terracota uppercase bg-terracota-soft px-2 py-0.5 rounded-full">Demora en Pase · {d.minutes} min</span>
                    <span className="text-[11px] text-terracota-dark font-medium flex items-center gap-0.5"><span className="material-symbols-outlined text-[13px]">timer</span>{new Date(d.readyAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false })} hrs</span>
                  </div>
                  <h3 className="font-display font-bold text-carbon text-sm mt-1 leading-snug">{d.where} · {d.quantity > 1 ? `${d.quantity} ` : ""}{d.product} listo sin entregar</h3>
                  <p className="text-[11.5px] text-stone-600 mt-0.5 leading-normal">Mesero asignado: <strong className="text-carbon font-semibold">{d.waiterName}</strong> — está en el pase hace {d.minutes} min.</p>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <button onClick={() => act(client.request("POST", `/orders/items/${d.itemId}/nudge`), `Aviso reenviado a ${d.waiterName}.`)} className="flex items-center justify-center gap-1.5 py-2 px-3 border border-arena rounded-lg text-xs font-medium text-carbon bg-[#FBF9F5] active:scale-95 transition-transform">
                      <span className="material-symbols-outlined text-[16px] text-stone-600">vibration</span>Avisar a {d.waiterName.split(" ")[0]}
                    </button>
                    <button onClick={() => act(client.orders.transition(d.itemId, "entregado"), `${d.product} entregado.`)} className="flex items-center justify-center gap-1.5 py-2 px-3 bg-terracota hover:bg-terracota-dark text-white rounded-lg text-xs font-semibold shadow-sm active:scale-95 transition-transform">
                      <span className="material-symbols-outlined text-[16px]">room_service</span>Lo llevo yo
                    </button>
                  </div>
                </div>
              </div>
            </section>
          ))}

          <section className="space-y-2.5">
            <div className="flex items-center justify-between pt-1">
              <div>
                <h2 className="font-display font-bold text-carbon text-base tracking-tight">Resumen del piso</h2>
                <p className="text-[11px] text-stone-500 font-label">{o.waiters.length} meseros con cuentas · {o.occupancy.occupied} mesas ocupadas</p>
              </div>
              <button onClick={() => nav("/")} className="text-xs text-[#1E2F28] font-semibold flex items-center gap-0.5 hover:underline py-1">Ver mapa de salón<span className="material-symbols-outlined text-[16px]">arrow_forward</span></button>
            </div>
            <div className="space-y-2">
              {o.waiters.map((w) => {
                const load = w.checks >= 5 ? "alta" : w.checks >= 3 ? "media" : "baja";
                return (
                  <div key={w.id} className={`bg-white border rounded-xl p-3 shadow-xs transition-all ${load === "alta" ? "border-amber-300/80" : "border-arena/40 hover:border-arena"}`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${load === "alta" ? "bg-amber-700 text-white" : "bg-[#1E2F28] text-[#D4AF7C]"}`}>{initials(w.name)}</div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-xs text-carbon">{w.name}</span>
                          <span className={load === "alta" ? "px-1.5 bg-amber-100 text-amber-900 border border-amber-200 text-[10px] rounded font-bold" : "px-1.5 bg-stone-100 border border-stone-200 text-stone-600 text-[10px] rounded font-medium"}>{w.checks} cuentas</span>
                        </div>
                        <p className="text-[11px] text-stone-500">{w.tables.join(", ") || "Solo barra"} · Carga {load}</p>
                      </div>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-stone-100 flex items-center justify-between text-[11px]">
                      {w.pendingDelivery > 0 ? (
                        <div className="flex items-center gap-1.5 text-terracota font-medium"><span className="w-1.5 h-1.5 rounded-full bg-terracota" />{w.pendingDelivery} plato(s) por entregar</div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-emerald-700 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Al día</div>
                      )}
                      <div className="flex items-center gap-3 text-stone-600">
                        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">skillet</span>{w.inKitchen} en cocina</span>
                        {w.billRequested > 0 && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">point_of_sale</span>{w.billRequested} cuenta(s)</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="bg-white border border-arena/50 rounded-xl p-3.5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-[#1E2F28]/10 text-[#1E2F28] flex items-center justify-center"><span className="material-symbols-outlined text-[16px]">local_bar</span></span>
                <h3 className="font-display font-bold text-sm text-carbon">Cuentas de barra abiertas</h3>
              </div>
              <span className="text-xs font-bold text-[#1E2F28] bg-[#D4AF7C]/20 border border-[#D4AF7C]/40 px-2 py-0.5 rounded-full font-label">{money(o.bar.reduce((s, b) => s + b.total, 0))} activo</span>
            </div>
            <div className="divide-y divide-stone-100 text-xs">
              {o.bar.map((b) => (
                <div key={b.checkId} className="py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-carbon text-xs">{b.name}</span>
                      <p className="text-[11px] text-stone-500">{b.summary || "Sin productos"}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-carbon text-xs">{money(b.total)}</span>
                      <span className="block text-[10px] text-stone-400">Hace {b.minutes} min</span>
                    </div>
                  </div>
                  <button onClick={() => nav(`/cuenta/${b.checkId}`)} className="w-full py-1 px-2 border border-arena/60 rounded bg-[#FBF9F5] text-[11px] text-stone-700 hover:bg-stone-100 active:scale-95 transition-transform flex items-center justify-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">receipt</span>Ver comanda
                  </button>
                </div>
              ))}
              {o.bar.length === 0 && <p className="py-2 text-stone-500">Sin cuentas de barra.</p>}
            </div>
          </section>

          <section className="bg-white border border-arena/60 rounded-xl p-3.5 space-y-3 shadow-xs">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#D4AF7C] text-[18px]">verified_user</span>
              <h3 className="font-display font-bold text-sm text-carbon">Autorizaciones pendientes</h3>
            </div>
            {approvals.map((a) => (
              <div key={a.id} className="p-2.5 rounded-lg bg-[#FBF9F5] border border-arena/50 text-xs space-y-2">
                <div className="flex justify-between">
                  <span><strong>{KIND[a.kind]}</strong>{a.pct ? ` ${a.pct}%` : ""} · {a.tableLabel}</span>
                  <span className="font-bold">{money(a.pct ? Math.round((a.checkTotal * a.pct) / 100) : a.amount || a.itemAmount || 0)}</span>
                </div>
                <p className="text-[11px] text-stone-500">{a.productName ? `${a.productName} · ` : ""}{a.reason} · Solicitó {a.requestedByName}</p>
                <div className="flex justify-end gap-2">
                  <button onClick={() => act(client.approvals.resolve(a.id, "rechazar"), "Solicitud rechazada.")} className="px-3 py-1 rounded-md border border-terracota text-terracota font-semibold bg-white">Rechazar</button>
                  <button onClick={() => act(client.approvals.resolve(a.id, "aprobar"), "Solicitud aprobada.")} className="px-3 py-1 rounded-md bg-[#1E2F28] text-[#D4AF7C] font-semibold">Aprobar</button>
                </div>
              </div>
            ))}
            {approvals.length === 0 && <p className="text-xs text-stone-500">Sin solicitudes pendientes.</p>}
            <p className="text-[10px] text-stone-400">Si una solicitud excede tu tope, el sistema no te deja aprobarla y debe resolverla un gerente.</p>
          </section>
        </main>
      </div>
    </div>
  );
}
