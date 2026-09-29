/* Diseño: design/stitch/caja-apertura.html (Stitch). Marcado y clases originales; datos reales. E6-01. */
import { useSession } from "@convivium/app-shell";
import { useEffect, useState } from "react";

// Identificador fijo de la caja física; en producción viene de la configuración del dispositivo.
const REGISTER_ID = "00000000-0000-4000-8000-000000000001";
const BILLS: [number, string][] = [[500, "bg-emerald-50 text-emerald-800 border-emerald-200"], [200, "bg-emerald-50 text-emerald-800 border-emerald-200"], [100, "bg-red-50 text-red-800 border-red-200"], [50, "bg-purple-50 text-purple-800 border-purple-200"], [20, "bg-blue-50 text-blue-800 border-blue-200"]];
const COINS = [10, 5, 2, 1, 0.5];
const money = (c: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(c / 100);

export function OpenSession({ onOpened }: { onOpened: () => void }) {
  const { client, session } = useSession();
  const [usdRate, setUsdRate] = useState(0);
  useEffect(() => { client.request<{ usdRate: number | null }>("GET", "/branch").then((b) => setUsdRate(b.usdRate ?? 0)); }, [client]);
  const [counts, setCounts] = useState<Record<string, number>>({ "500": 1, "200": 2, "100": 3, "50": 4, "20": 5 });
  const [usdOn, setUsdOn] = useState(false);
  const [usd, setUsd] = useState("");
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: number, v: number) => setCounts((c) => ({ ...c, [String(k)]: Math.max(0, v) }));
  const get = (k: number) => counts[String(k)] ?? 0;
  const bills = BILLS.reduce((s, [d]) => s + d * 100 * get(d), 0);
  const coins = COINS.reduce((s, d) => s + Math.round(d * 100) * get(d), 0);
  const total = bills + coins;
  const usdMxn = Math.round(Number(usd || 0) * usdRate);
  const now = new Date();

  const open = () =>
    client.cash.open(REGISTER_ID, total).then(onOpened, (e) => setError((e as Error).message));

  return (
    <main className="pt-8 pb-12 px-8 min-h-screen overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-carbon/70">
            <span>Operación Diaria</span>
            <span className="material-symbols-outlined text-xs">chevron_right</span>
            <span>Gestión de Efectivo</span>
            <span className="material-symbols-outlined text-xs">chevron_right</span>
            <span className="text-olivo font-semibold">Apertura de Terminal</span>
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-8 space-y-6">
            <div className="bg-marfil-subtle rounded-xl border border-arena shadow-sm p-6 relative overflow-hidden">
              <div className="absolute -right-16 -top-16 w-44 h-44 rounded-full bg-arena/20 pointer-events-none blur-xl" />
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-arena/40 pb-5">
                <div>
                  <h2 className="font-display text-2xl font-bold text-olivo mt-2 tracking-tight">Abrir caja · Caja 1</h2>
                  <p className="text-xs text-carbon/70 mt-1 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-dorado">calendar_today</span>
                    {now.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })} · {now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false })} hrs
                  </p>
                </div>
                <div className="flex items-center gap-3 bg-white/70 p-3 rounded-lg border border-arena/50 backdrop-blur-sm">
                  <div className="w-11 h-11 rounded-lg border border-arena shadow-inner bg-olivo text-dorado font-display font-bold flex items-center justify-center">{session.user.name.slice(0, 1)}</div>
                  <div>
                    <h4 className="text-sm font-semibold text-carbon leading-snug">{session.user.name}</h4>
                    <p className="text-[11px] text-carbon/60 capitalize">{session.user.roles.join(" · ")}</p>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Terminal asignada
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 p-3.5 bg-amber-50/90 rounded-lg border border-amber-200/80 flex items-start gap-3">
                <span className="material-symbols-outlined text-amber-700 text-xl mt-0.5 shrink-0">security_update_warning</span>
                <div className="text-xs text-amber-950 leading-relaxed">
                  <strong className="font-semibold text-amber-900">Aviso de Control Interno: </strong>
                  Solo se permite una caja abierta por usuario y terminal simultáneamente. Toda venta, cobro y movimiento de efectivo queda registrado en la bitácora a nombre de <strong className="font-medium">{session.user.name}</strong>.
                </div>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between pb-3 border-b border-arena/30">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-olivo text-xl">payments</span>
                    <h3 className="font-display font-semibold text-base text-olivo tracking-wide">Desglose de Efectivo para Fondo Fijo</h3>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-carbon/80">Billetes Nacionales (MXN)</span>
                  </div>
                  <div className="space-y-2.5">
                    {BILLS.map(([d, chip]) => (
                      <div key={d} className="grid grid-cols-12 items-center gap-3 p-2.5 rounded-lg bg-white border border-arena/60 hover:border-dorado transition-colors">
                        <div className="col-span-3 flex items-center gap-2">
                          <span className={`w-9 h-7 rounded text-xs font-mono font-bold flex items-center justify-center border ${chip}`}>${d}</span>
                          <span className="text-xs font-medium text-carbon">Billete ${d}</span>
                        </div>
                        <div className="col-span-5 flex items-center justify-center gap-1.5">
                          <button onClick={() => set(d, get(d) - 1)} className="w-8 h-8 rounded border border-arena/60 bg-marfil-subtle hover:bg-arena/30 active:scale-95 flex items-center justify-center text-carbon transition-all">
                            <span className="material-symbols-outlined text-sm">remove</span>
                          </button>
                          <input value={get(d)} onChange={(e) => set(d, Number(e.target.value) || 0)} className="w-16 h-8 text-center text-sm font-semibold border-arena rounded py-0 focus:ring-1 focus:ring-dorado focus:border-dorado" min={0} type="number" />
                          <button onClick={() => set(d, get(d) + 1)} className="w-8 h-8 rounded border border-arena/60 bg-marfil-subtle hover:bg-arena/30 active:scale-95 flex items-center justify-center text-carbon transition-all">
                            <span className="material-symbols-outlined text-sm">add</span>
                          </button>
                        </div>
                        <div className="col-span-4 text-right">
                          <span className="text-sm font-mono font-semibold text-olivo">{money(d * 100 * get(d))} MXN</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center px-3 py-2 mt-2 bg-arena/20 rounded-md text-xs font-medium text-carbon">
                    <span>Subtotal en Billetes:</span>
                    <span className="font-mono font-bold text-olivo">{money(bills)} MXN</span>
                  </div>
                </div>

                <details className="group mt-4 rounded-lg border border-arena/60 bg-white overflow-hidden transition-all">
                  <summary className="flex items-center justify-between p-3 cursor-pointer bg-marfil-subtle/80 hover:bg-arena/20 select-none">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm text-dorado group-open:rotate-90 transition-transform">chevron_right</span>
                      <span className="text-xs font-semibold uppercase tracking-wider text-carbon/80">Monedas Metálicas ($10, $5, $2, $1, $0.50)</span>
                    </div>
                    <span className="text-xs font-mono font-semibold text-carbon/70">{money(coins)} MXN</span>
                  </summary>
                  <div className="p-3 space-y-2 border-t border-arena/40 bg-white">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                      {COINS.map((d) => (
                        <div key={d} className="p-2 border border-arena/40 rounded bg-marfil-subtle/40">
                          <span className="font-bold text-carbon block">${d}</span>
                          <div className="flex items-center justify-center gap-1 mt-1">
                            <button onClick={() => set(d, get(d) - 1)} className="w-6 h-6 rounded bg-arena/30 text-xs">−</button>
                            <input value={get(d)} onChange={(e) => set(d, Number(e.target.value) || 0)} className="w-10 h-6 text-center text-xs p-0 border-arena rounded" min={0} type="number" />
                            <button onClick={() => set(d, get(d) + 1)} className="w-6 h-6 rounded bg-arena/30 text-xs">+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>

                {usdRate > 0 && <div className="mt-4 p-4 rounded-lg border border-arena/60 bg-white/60">
                  <div className="flex items-center gap-2">
                    <input checked={usdOn} onChange={(e) => setUsdOn(e.target.checked)} className="rounded border-arena text-olivo focus:ring-dorado h-4 w-4" id="enable-usd" type="checkbox" />
                    <label className="text-xs font-semibold text-carbon select-none cursor-pointer" htmlFor="enable-usd">Habilitar fondo en divisas extranjeras (Dólares USD)</label>
                  </div>
                  {usdOn && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-carbon/70">Fondo Inicial en USD:</label>
                        <input value={usd} onChange={(e) => setUsd(e.target.value)} className="w-36 text-xs font-mono font-medium rounded border-arena focus:ring-dorado focus:border-dorado py-1.5" min={0} placeholder="0.00" type="number" />
                      </div>
                      <div className="text-xs text-carbon/60 flex items-center justify-end">
                        <span>Equivalente estimado: <strong className="font-mono text-olivo">{money(usdMxn)} MXN</strong></span>
                      </div>
                    </div>
                  )}
                </div>}

                <div className="mt-4 p-3.5 rounded-lg bg-arena/15 border border-arena/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-dorado text-lg">currency_exchange</span>
                    <div>
                      <span className="font-medium text-carbon">T.C. del día:</span>
                      <strong className="font-mono text-olivo font-bold text-sm ml-1">{money(usdRate)} MXN / USD</strong>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-white text-[10px] font-medium text-carbon/70 border border-arena/50 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-carbon/60">lock</span>
                    Editable · Requiere PIN de Gerente
                  </span>
                </div>

                <div className="mt-6 pt-5 border-t border-arena/50">
                  <label className="flex items-start gap-3 cursor-pointer group select-none">
                    <input checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 rounded border-arena text-olivo focus:ring-dorado h-5 w-5" type="checkbox" />
                    <div className="text-xs text-carbon leading-snug">
                      <span className="font-semibold text-carbon group-hover:text-olivo transition-colors">He contado físicamente el efectivo presente en la gaveta y coincide con el fondo declarado.</span>
                      <p className="text-carbon/60 text-[11px] mt-0.5">Declaro que la gaveta se encuentra limpia, sin tickets rezagados y lista para iniciar operaciones.</p>
                    </div>
                  </label>
                </div>

                {error && <p className="mt-4 text-xs text-terracota font-medium">{error}</p>}
                <div className="mt-6">
                  <button disabled={!checked || total <= 0} onClick={open} className="w-full py-4 px-6 rounded-lg bg-olivo hover:bg-olivo-dark text-marfil border border-dorado/40 shadow-md hover:shadow-lg transition-all flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed">
                    <div className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-md bg-dorado/20 text-dorado flex items-center justify-center border border-dorado/40 group-hover:scale-105 transition-transform">
                        <span className="material-symbols-outlined text-xl">key</span>
                      </span>
                      <div className="text-left">
                        <span className="block text-xs font-semibold uppercase tracking-wider text-dorado">Acción Operativa</span>
                        <span className="block font-display text-base font-bold text-white tracking-wide">Abrir caja y comenzar turno</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-olivo-dark/60 px-4 py-2 rounded border border-dorado/30">
                      <span className="text-xs text-arena font-mono">Fondo:</span>
                      <span className="font-mono font-bold text-sm text-dorado">{money(total)} MXN</span>
                      <span className="material-symbols-outlined text-sm text-dorado group-hover:translate-x-1 transition-transform">arrow_forward</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="xl:col-span-4 space-y-6">
            <div className="bg-[#1E2F28] text-marfil rounded-xl p-6 border border-arena/20 shadow-md relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                <span className="material-symbols-outlined text-9xl">account_balance_wallet</span>
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-dorado">Resumen del fondo</span>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-arena">Billetes</span><span className="font-mono">{money(bills)}</span></div>
                <div className="flex justify-between"><span className="text-arena">Monedas</span><span className="font-mono">{money(coins)}</span></div>
                {usdOn && <div className="flex justify-between"><span className="text-arena">USD (informativo)</span><span className="font-mono">{Number(usd || 0).toFixed(2)} USD</span></div>}
                <div className="pt-3 mt-3 border-t border-arena/20 flex justify-between items-baseline">
                  <span className="font-display text-lg">Fondo inicial</span>
                  <span className="font-mono text-2xl font-bold text-dorado">{money(total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
