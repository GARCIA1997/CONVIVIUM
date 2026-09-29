/* Diseño: design/stitch/admin-aprobaciones-movil.html (Stitch). Marcado y clases originales; datos reales. E5-01. */
import type { ApprovalView } from "@convivium/api-client";
import { client } from "@convivium/app-shell";
import { useCallback, useEffect, useState } from "react";

const KIND: Record<string, { label: string; icon: string; approve: string }> = {
  devolucion_retiro: { label: "Retirar de cuenta · Devolución", icon: "assignment_return", approve: "Aprobar retiro" },
  cancelacion: { label: "Cancelación", icon: "block", approve: "Aprobar cancelación" },
  descuento: { label: "Descuento", icon: "sell", approve: "Aprobar descuento" },
  cortesia: { label: "Cortesía", icon: "redeem", approve: "Aprobar cortesía" },
  reapertura: { label: "Reabrir cuenta", icon: "lock_open", approve: "Aprobar reapertura" },
};
const money = (c: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(c / 100);
const ago = (iso: string) => {
  const s = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  return s < 60 ? `Hace ${s} s` : s < 3600 ? `Hace ${Math.floor(s / 60)} min` : `Hace ${Math.floor(s / 3600)} h`;
};
const amountOf = (a: ApprovalView) => (a.pct ? Math.round((a.checkTotal * a.pct) / 100) : a.amount || a.itemAmount || 0);

export function ApprovalsPage() {
  const [pending, setPending] = useState<ApprovalView[]>([]);
  const [resolved, setResolved] = useState<ApprovalView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const session = client.session!;

  const load = useCallback(async () => {
    const [p, a, r] = await Promise.all([client.approvals.list("pendiente"), client.approvals.list("aprobada"), client.approvals.list("rechazada")]);
    setPending(p);
    setResolved([...a, ...r].sort((x, y) => (y.resolvedAt ?? "").localeCompare(x.resolvedAt ?? "")).slice(0, 10));
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);

  const resolve = (id: string, d: "aprobar" | "rechazar") => client.approvals.resolve(id, d).then(load, (e) => setError((e as Error).message));
  const [hero, ...rest] = pending;

  return (
    <div className="h-full font-body text-carbon antialiased bg-[#F5F1E8] flex justify-center min-h-screen">
      <div className="w-full max-w-md bg-[#FBF9F4] min-h-screen flex flex-col relative shadow-2xl border-x border-[#C9B89F]/30 pb-10">
        <header className="sticky top-0 z-40 bg-[#FBF9F4]/95 backdrop-blur-md border-b border-[#C9B89F]/40 px-4 pt-3 pb-3">
          <div className="flex items-center justify-between text-xs mb-2">
            <div className="flex items-center gap-1.5 font-medium tracking-wide text-[#1E2F28]/80">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
              </span>
              <span className="text-[11px] uppercase tracking-wider font-semibold">En línea</span>
            </div>
            <div className="flex items-center gap-2 bg-[#EAE6DD] px-2.5 py-1 rounded-full border border-[#C9B89F]/50">
              <span className="text-[11px] font-medium text-[#1E2F28]"><strong className="font-semibold">{session.user.name}</strong></span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-baseline gap-2.5">
              <h1 className="serif-display text-2xl font-bold text-[#1E2F28] tracking-tight">Aprobaciones</h1>
              <div className="inline-flex items-center gap-1 bg-[#B45A3C]/10 border border-[#B45A3C]/30 text-[#B45A3C] px-2 py-0.5 rounded-full text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#B45A3C] pulse-beacon" />
                {pending.length} pendientes
              </div>
            </div>
            <button onClick={load} aria-label="Actualizar" className="w-9 h-9 flex items-center justify-center rounded-lg border border-[#C9B89F]/60 text-[#1E2F28] active:scale-95 transition-transform bg-[#F5F1E8]">
              <span className="material-symbols-outlined text-[20px]">sync</span>
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 pt-4 space-y-5">
          {error && <p className="text-xs text-[#B45A3C] font-medium">{error}</p>}
          {!hero && <p className="text-sm text-[#1A1A1A]/60 text-center py-10 serif-display">Nada pendiente por aprobar.</p>}

          {hero && (
            <section className="relative">
              <div className="flex items-center justify-between mb-1.5 px-0.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#B45A3C] flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm font-bold">priority_high</span>
                  Urgencia Inmediata
                </span>
                <span className="text-[11px] text-[#1A1A1A]/60 font-medium">{ago(hero.createdAt)}</span>
              </div>
              <div className="bg-[#FBF9F4] rounded-xl border-2 border-[#B45A3C]/40 shadow-md p-4 relative overflow-hidden">
                <div className="flex items-start justify-between border-b border-[#C9B89F]/30 pb-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#B45A3C]/10 text-[#9C3D25] text-[11px] font-semibold tracking-wide uppercase mb-1">
                      <span className="material-symbols-outlined text-xs">{KIND[hero.kind]?.icon}</span>
                      {KIND[hero.kind]?.label}{hero.pct ? ` ${hero.pct}%` : ""}
                    </div>
                    <h2 className="serif-display text-2xl font-bold text-[#1E2F28] mt-1">{hero.tableLabel ?? "Cuenta"}</h2>
                  </div>
                  {hero.guests && (
                    <div className="text-right">
                      <span className="inline-block mt-0.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-[#C9B89F]/20 text-[#1E2F28]">{hero.guests} comensales</span>
                    </div>
                  )}
                </div>
                <div className="py-3.5 space-y-2.5">
                  <div className="flex items-baseline justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#B45A3C] text-lg">restaurant</span>
                      <span className="font-bold text-[#1A1A1A] text-base">{hero.productName ?? `Cuenta ${money(hero.checkTotal)}`}</span>
                    </div>
                    <span className="serif-display font-bold text-lg text-[#1E2F28]">{money(amountOf(hero))} <span className="text-xs font-sans font-medium text-[#1A1A1A]/70">MXN</span></span>
                  </div>
                  <div className="bg-[#EAE6DD]/70 rounded-lg p-2.5 border border-[#C9B89F]/40 text-xs">
                    <div className="text-[#1A1A1A]/60 font-medium mb-0.5">Motivo reportado:</div>
                    <div className="font-medium text-[#1A1A1A] leading-relaxed flex items-start gap-1">
                      <span className="material-symbols-outlined text-[#B45A3C] text-sm mt-0.5">error</span>
                      {hero.reason ?? "Sin motivo"}
                    </div>
                    <div className="mt-2 pt-2 border-t border-[#C9B89F]/30 flex justify-between items-center text-[11px] text-[#1A1A1A]/70">
                      <span>Solicita: <strong className="text-[#1E2F28]">{hero.requestedByName}</strong></span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <button onClick={() => resolve(hero.id, "rechazar")} className="h-12 flex items-center justify-center gap-1.5 rounded-lg border-2 border-[#B45A3C] bg-[#B45A3C]/10 text-[#9C3D25] font-semibold text-sm active:scale-[0.98] transition-all">
                      <span className="material-symbols-outlined text-xl">close</span>
                      Rechazar
                    </button>
                    <button onClick={() => resolve(hero.id, "aprobar")} className="h-12 flex items-center justify-center gap-1.5 rounded-lg bg-[#1E2F28] text-[#FBF9F4] font-semibold text-sm active:scale-[0.98] active:bg-[#2A3F36] transition-all shadow-md">
                      <span className="material-symbols-outlined text-xl text-[#D4AF7C]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      <span className="text-[#FBF9F4]">{KIND[hero.kind]?.approve}</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <section className="space-y-2.5">
              <div className="flex items-center justify-between pt-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#1E2F28]/80 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#D4AF7C]" />
                  Otras pendientes ({rest.length})
                </h2>
              </div>
              {rest.map((a) => (
                <article key={a.id} className="bg-[#FBF9F4] rounded-lg border border-[#C9B89F]/60 p-3.5 shadow-sm space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-[#D4AF7C]/20 text-[#8C6D37] text-[10px] font-bold uppercase tracking-wider">{KIND[a.kind]?.label}{a.pct ? ` ${a.pct}%` : ""}</span>
                        <span className="text-[10px] text-[#1A1A1A]/50">{ago(a.createdAt)}</span>
                      </div>
                      <h3 className="serif-display text-lg font-bold text-[#1E2F28]">{a.tableLabel ?? "Cuenta"}</h3>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-[#1A1A1A]/60">Monto</div>
                      <div className="serif-display font-bold text-[#1E2F28] text-base">{money(amountOf(a))} <span className="text-[10px] font-sans font-medium text-[#1A1A1A]/60">MXN</span></div>
                    </div>
                  </div>
                  <p className="text-xs text-[#1A1A1A]/80 leading-relaxed bg-[#EAE6DD]/50 p-2 rounded border border-[#C9B89F]/30">
                    {a.productName ? `${a.productName} · ` : ""}{a.reason ?? "Sin motivo"}
                    <span className="block mt-1 text-[11px] text-[#1A1A1A]/60">Solicitó: <strong>{a.requestedByName}</strong></span>
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button onClick={() => resolve(a.id, "rechazar")} className="px-3 py-1.5 rounded-md border border-[#B45A3C] text-[#B45A3C] text-xs font-semibold bg-white active:scale-95 transition-transform flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">close</span>Rechazar
                    </button>
                    <button onClick={() => resolve(a.id, "aprobar")} className="px-3.5 py-1.5 rounded-md bg-[#1E2F28] text-[#FBF9F4] text-xs font-semibold active:scale-95 transition-transform flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-[#D4AF7C]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>Aprobar
                    </button>
                  </div>
                </article>
              ))}
            </section>
          )}

          {resolved.length > 0 && (
            <section className="space-y-2 pt-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#1E2F28]/80">Resueltas recientes</h2>
              {resolved.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-xs py-2 border-b border-[#C9B89F]/30">
                  <div>
                    <span className="font-semibold text-[#1E2F28]">{KIND[a.kind]?.label}</span> · {a.tableLabel} · {money(amountOf(a))}
                    <span className="block text-[11px] text-[#1A1A1A]/60">{a.status === "aprobada" ? "Aprobado" : "Rechazado"} por {a.resolvedByName}</span>
                  </div>
                  <span className={`material-symbols-outlined text-lg ${a.status === "aprobada" ? "text-emerald-700" : "text-[#B45A3C]"}`}>{a.status === "aprobada" ? "check_circle" : "cancel"}</span>
                </div>
              ))}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
