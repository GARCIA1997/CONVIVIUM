/* Diseño: design/stitch/caja-corte-z.html (Stitch). Marcado y clases originales; datos reales. E6-06, E6-07. */
import type { CashSummary } from "@convivium/api-client";
import { useSession } from "@convivium/app-shell";
import { useEffect, useState } from "react";

type Result = Awaited<ReturnType<ReturnType<typeof useSession>["client"]["cash"]["count"]>>;
const METHODS: { key: string; label: string; icon: string; sub: string; chip: string }[] = [
  { key: "efectivo_mxn", label: "Efectivo MXN", icon: "payments", sub: "Gaveta + Fondo", chip: "bg-verde-50 text-verde-800 border border-verde-100" },
  { key: "efectivo_usd", label: "Efectivo USD", icon: "currency_exchange", sub: "Dólares (monto en USD)", chip: "bg-dorado-light text-dorado-dark border border-dorado-agave/30" },
  { key: "tarjeta", label: "Tarjeta", icon: "credit_card", sub: "Terminal externa", chip: "bg-marfil-light text-verde-800 border border-arena-soft" },
  { key: "transferencia", label: "Transferencia", icon: "account_balance", sub: "SPEI", chip: "bg-marfil-light text-verde-800 border border-arena-soft" },
];
const money = (c: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(c / 100);
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });

export function CortePage({ onClosed }: { onClosed: () => void }) {
  const { client, session } = useSession();
  const [summary, setSummary] = useState<CashSummary | null>(null);
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isManager = client.can("caja.corte_z");

  useEffect(() => { client.cash.summary().then(setSummary).catch((e) => setError(e.message)); }, [client]);

  const countedCents = () => Object.fromEntries(Object.entries(counted).map(([k, v]) => [k, Math.round(Number(v || 0) * 100)]));
  const run = async (kind: "X" | "Z") => {
    setError(null);
    try {
      const r = await client.cash.count(kind, countedCents(), kind === "Z" && !isManager ? pin : undefined);
      setResult(r);
      if (r.closed) setTimeout(onClosed, 5000);
    } catch (e) { setError((e as Error).message); }
  };

  const tipsTotal = summary?.tipsByWaiter.reduce((s, t) => s + t.amount, 0) ?? 0;
  const diffCash = result?.differences.efectivo_mxn ?? 0;
  const totalDiff = result ? Object.values(result.differences).reduce((s, d) => s + d, 0) : 0;

  return (
    <main className="flex-1 overflow-y-auto bg-[#FBF9F5] p-8">
      <div className="max-w-[1360px] mx-auto space-y-6">
        <div className="bg-white rounded-xl p-6 border border-arena-soft shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h1 className="font-display text-2xl lg:text-3xl text-verde-900 font-bold tracking-tight">Corte de Turno de Caja</h1>
            <p className="text-xs text-carbon/60 mt-1 max-w-xl">Conciliación de ventas y arqueo ciego de valores. El sistema revela lo esperado después de registrar el conteo físico.</p>
          </div>
          {summary && (
            <div className="flex flex-wrap items-center gap-2.5">
              <InfoCard label="Ubicación" icon="storefront" value="Caja 1" />
              <div className="bg-marfil-light border border-arena-soft px-3 py-2 rounded-lg text-left">
                <span className="block text-[10px] text-carbon/50 uppercase tracking-wider font-semibold">Cajero en Turno</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-verde-600" />
                  <span className="text-xs font-semibold text-carbon">{summary.cashierName} (Activa)</span>
                </div>
              </div>
              <InfoCard label="Apertura" icon="schedule" value={`Hoy ${hhmm(summary.openedAt)} hrs`} />
              <div className="bg-verde-50 border border-verde-700/20 px-3 py-2 rounded-lg text-left">
                <span className="block text-[10px] text-verde-800 uppercase tracking-wider font-semibold">Fondo Inicial Caja</span>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="material-symbols-outlined text-[15px] text-verde-800">savings</span>
                  <span className="text-xs font-bold text-verde-800 font-tabular">{money(summary.openingFloat)} MXN</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-xl border border-arena-soft shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-verde-900 to-verde-800 px-5 py-3.5 flex items-center justify-between text-marfil border-b border-verde-700">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-verde-700/80 flex items-center justify-center text-dorado shrink-0">
                    <span className="material-symbols-outlined text-[18px]">verified_user</span>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-dorado">Paso de Auditoría: Arqueo a Ciegas</h3>
                    <p className="text-[11px] text-marfil/80 font-normal">Los montos teóricos del sistema se concilian contra el conteo físico ingresado.</p>
                  </div>
                </div>
                <span className="text-[11px] bg-verde-700 px-2.5 py-1 rounded text-arena font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">{result ? "lock" : "lock_open"}</span>
                  {result ? "Conteo Confirmado" : "Conteo pendiente"}
                </span>
              </div>
              <div className="px-6 py-4 border-b border-arena-light">
                <h2 className="font-display font-bold text-lg text-verde-900">Arqueo y Conciliación por Forma de Pago</h2>
                <p className="text-xs text-carbon/60">Valores físicos capturados frente al libro de ventas del turno.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-marfil-light/70 text-carbon/70 font-semibold border-b border-arena-soft uppercase text-[11px] tracking-wider">
                      <th className="py-3 px-4">Forma de Pago</th>
                      <th className="py-3 px-4 text-right">Contado (Ciego)</th>
                      <th className="py-3 px-4 text-right">Esperado Sistema</th>
                      <th className="py-3 px-4 text-right">Diferencia</th>
                      <th className="py-3 px-4 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-arena-light text-carbon font-normal">
                    {METHODS.map((m) => {
                      const d = result?.differences[m.key] ?? 0;
                      return (
                        <tr key={m.key} className="bg-white hover:bg-marfil-light/30 transition-colors">
                          <td className="py-3 px-4 align-top">
                            <div className="flex items-center gap-2.5">
                              <span className={`p-1.5 rounded ${m.chip}`}>
                                <span className="material-symbols-outlined text-[18px]">{m.icon}</span>
                              </span>
                              <div>
                                <span className="font-semibold text-carbon text-sm block">{m.label}</span>
                                <span className="text-[10px] text-carbon/50">{m.sub}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right align-top">
                            {result ? (
                              <span className="font-bold text-sm font-tabular text-carbon">{money(result.counted[m.key] ?? 0)}</span>
                            ) : (
                              <input value={counted[m.key] ?? ""} onChange={(e) => setCounted((c) => ({ ...c, [m.key]: e.target.value }))} inputMode="decimal" placeholder="0.00"
                                className="w-32 text-right font-bold text-sm font-tabular bg-white border border-arena rounded-lg py-1.5 px-2 focus:ring-2 focus:ring-verde-800 focus:border-verde-800" />
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-xs font-tabular text-carbon/70 align-top">{result ? money(result.expected[m.key] ?? 0) : "••••"}</td>
                          <td className="py-3 px-4 text-right align-top">
                            {result && <span className={`inline-flex items-center gap-1 font-bold text-xs font-tabular ${d < 0 ? "text-terracota" : d > 0 ? "text-dorado-dark" : "text-verde-800"}`}>{money(d)} MXN</span>}
                          </td>
                          <td className="py-3 px-4 text-center align-top">
                            {result &&
                              (d === 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-verde-50 text-verde-800 border border-verde-700/20">Cuadra</span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-terracota/10 text-terracota border border-terracota/30">{d < 0 ? "Faltante" : "Sobrante"}</span>
                              ))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-arena-soft shadow-sm p-6 space-y-3">
              <h2 className="font-display font-bold text-lg text-verde-900">Movimientos de Efectivo del Turno</h2>
              {summary?.movements.length === 0 && <p className="text-xs text-carbon/50">Sin retiros, entradas ni pagos a proveedor.</p>}
              {summary?.movements.map((m, i) => {
                const out = m.type !== "entrada";
                return (
                  <div key={i} className="p-3.5 rounded-lg border border-arena-light bg-marfil-light/40 flex items-start justify-between gap-4 hover:border-arena transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${out ? "bg-terracota-light text-terracota" : "bg-verde-50 text-verde-700"}`}>
                        <span className="material-symbols-outlined text-[17px]">{m.type === "proveedor" ? "shopping_cart_checkout" : out ? "arrow_outward" : "arrow_downward"}</span>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-carbon">{hhmm(m.at)} hrs · {m.type === "proveedor" ? "Pago a proveedor en efectivo" : out ? "Retiro de efectivo" : "Entrada de efectivo"}</span>
                        <p className="text-xs text-carbon/70 mt-1">{m.reason}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-sm font-bold font-tabular ${out ? "text-terracota" : "text-verde-800"}`}>{out ? "-" : "+"}{money(m.amount)} MXN</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-xl border border-arena-soft shadow-md overflow-hidden relative">
              <div className="h-2 bg-gradient-to-r from-dorado-agave via-verde-800 to-dorado" />
              <div className="p-6">
                <div className="text-center pb-4 border-b border-dashed border-arena-soft">
                  <h3 className="font-display uppercase tracking-widest text-verde-900 font-bold text-sm">Resumen Financiero</h3>
                  <p className="text-[11px] text-carbon/60 tracking-wider">Turno de {summary?.cashierName}</p>
                </div>
                {summary && (
                  <>
                    <div className="py-4 space-y-2.5 text-xs">
                      <div className="flex justify-between items-center"><span className="text-carbon/70">Ventas cobradas</span><span className="font-tabular font-semibold text-carbon text-sm">{money(summary.sales)} MXN</span></div>
                      <div className="flex justify-between items-center text-terracota"><span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">sell</span>Descuentos</span><span className="font-tabular font-medium">-{money(summary.discounts)} MXN</span></div>
                      <div className="flex justify-between items-center text-terracota"><span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">local_bar</span>Cortesías</span><span className="font-tabular font-medium">-{money(summary.courtesies)} MXN</span></div>
                    </div>
                    <div className="bg-marfil-light p-3.5 rounded-lg border border-arena-soft my-3">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-arena-light text-[11px]">
                        <span className="font-semibold text-verde-900 uppercase tracking-wider flex items-center gap-1"><span className="material-symbols-outlined text-[14px] text-dorado-agave">volunteer_activism</span>Propinas por Mesero</span>
                        <span className="text-carbon/50 text-[10px]">A dispersar</span>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        {summary.tipsByWaiter.map((t) => (
                          <div key={t.name} className="flex justify-between items-center text-carbon/80"><span>{t.name}</span><span className="font-tabular font-medium">{money(t.amount)} MXN</span></div>
                        ))}
                        {summary.tipsByWaiter.length === 0 && <p className="text-carbon/50">Sin propinas registradas.</p>}
                        <div className="pt-2 mt-2 border-t border-arena-light flex justify-between items-center text-xs font-semibold text-carbon"><span>Total Propinas:</span><span className="font-tabular text-dorado-dark font-bold">{money(tipsTotal)} MXN</span></div>
                      </div>
                    </div>
                    <div className="pt-3 border-t-2 border-dashed border-arena-soft space-y-3">
                      <div className="flex justify-between items-baseline">
                        <span className="font-display font-bold text-sm uppercase text-carbon">Total Cobrado en Turno:</span>
                        <span className="font-display font-bold text-xl text-verde-900 font-tabular">{money(summary.sales + tipsTotal)}</span>
                      </div>
                      {result && (
                        <div className={`p-3 rounded-lg flex items-center justify-between ${totalDiff === 0 ? "bg-verde-50 border border-verde-700/20" : "bg-terracota-light border border-terracota-border"}`}>
                          <div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider block ${totalDiff === 0 ? "text-verde-800" : "text-terracota-dark"}`}>Diferencia de Cuadre</span>
                            <span className={`text-xs ${totalDiff === 0 ? "text-verde-800" : "text-terracota-dark"}`}>{totalDiff === 0 ? "Caja cuadrada" : `Efectivo: ${money(diffCash)}`}</span>
                          </div>
                          <span className={`font-bold text-base font-tabular ${totalDiff === 0 ? "text-verde-800" : "text-terracota"}`}>{money(totalDiff)} MXN</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-arena-soft shadow-sm p-6 space-y-5">
              {!isManager && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-[18px] text-dorado-agave">key</span>
                    <h4 className="font-display font-bold text-sm text-verde-900 uppercase tracking-wider">Autorización Gerencial</h4>
                  </div>
                  <p className="text-xs text-carbon/60">El corte Z requiere el PIN de un gerente para cerrar la caja.</p>
                  <div className="bg-marfil-light p-3.5 rounded-lg border border-arena-soft space-y-2 mt-3">
                    <label className="text-xs font-medium text-carbon" htmlFor="pinGerente">PIN Supervisor / Gerente:</label>
                    <div className="relative">
                      <input id="pinGerente" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} type="password" inputMode="numeric" className="w-full text-center tracking-[1em] text-lg font-bold bg-white border border-arena rounded-lg py-2 text-carbon focus:ring-2 focus:ring-verde-800 focus:border-verde-800" />
                      <span className="material-symbols-outlined absolute right-3 top-2.5 text-[18px] text-carbon/40">lock</span>
                    </div>
                  </div>
                </div>
              )}
              {error && <p className="text-xs text-terracota font-medium">{error}</p>}
              {result?.closed && <p className="text-xs text-verde-800 font-semibold">Caja cerrada. Corte Z registrado en bitácora.</p>}
              <div className="space-y-2.5 pt-2">
                <button disabled={result?.closed || (!isManager && pin.length < 4)} onClick={() => run("Z")} className="w-full py-3.5 px-4 bg-verde-800 hover:bg-verde-700 active:scale-[0.99] text-white font-medium text-sm rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  <span className="material-symbols-outlined text-[20px] text-dorado">lock_reset</span>
                  <span className="font-semibold tracking-wide">Cerrar Caja Definitivo (Corte Z)</span>
                </button>
                <button disabled={result?.closed} onClick={() => run("X")} className="w-full py-2.5 px-4 bg-marfil hover:bg-arena-light text-carbon font-medium text-xs rounded-lg border border-arena hover:border-arena-dark transition-colors flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-verde-800">fact_check</span>
                  <span>Corte X (Parcial Informativo)</span>
                </button>
                <p className="text-[11px] text-center text-carbon/50 pt-1">
                  <span className="material-symbols-outlined text-[13px] align-middle text-amber-600">info</span> El corte Z es irreversible y cierra la sesión de caja de {session.user.name}.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function InfoCard({ label, icon, value }: { label: string; icon: string; value: string }) {
  return (
    <div className="bg-marfil-light border border-arena-soft px-3 py-2 rounded-lg text-left">
      <span className="block text-[10px] text-carbon/50 uppercase tracking-wider font-semibold">{label}</span>
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className="material-symbols-outlined text-[15px] text-verde-800">{icon}</span>
        <span className="text-xs font-semibold text-carbon">{value}</span>
      </div>
    </div>
  );
}
