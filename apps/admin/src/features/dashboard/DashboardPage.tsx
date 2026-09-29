/* Diseño: design/stitch/admin-dashboard.html (Stitch). Marcado y clases originales; datos reales. E9-01. */
import type { LiveDashboard } from "@convivium/api-client";
import { client } from "@convivium/app-shell";
import { useEffect, useState } from "react";
import { AdminHeader } from "../layout/AdminLayout";

const money = (c: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(c / 100);
const mins = (sec: number) => `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, "0")}s`;
const METHOD_LABEL: Record<string, string> = { tarjeta: "Tarjeta Bancaria", efectivo_mxn: "Efectivo MXN", efectivo_usd: "Efectivo USD", transferencia: "Transferencia", vales: "Vales" };
const METHOD_DOT: Record<string, string> = { tarjeta: "bg-[#1E2F28]", efectivo_mxn: "bg-[#D4AF7C]", efectivo_usd: "bg-[#C9B89F]", transferencia: "bg-[#B45A3C]", vales: "bg-stone-400" };

export function DashboardPage() {
  const [data, setData] = useState<LiveDashboard | null>(null);
  const [at, setAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const load = () => client.reports.live().then((d) => { setData(d); setAt(Date.now()); });
    load();
    const t = setInterval(load, 15_000);
    const c = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(t); clearInterval(c); };
  }, []);

  if (!data) return <AdminHeader />;
  const growth = data.salesLastWeek ? ((data.salesToday - data.salesLastWeek) / data.salesLastWeek) * 100 : null;
  const occ = data.occupancy;
  const pct = (n: number) => (occ.total ? (n / occ.total) * 100 : 0);
  const hours = data.hourly.filter((h) => h.hour >= 12 && h.hour <= 23);
  const maxH = Math.max(1, ...hours.map((h) => h.total));
  const pts = hours.map((h, i) => [(i / (hours.length - 1)) * 680, 155 - (h.total / maxH) * 130] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"} ${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const peak = hours.reduce((a, b) => (b.total > a.total ? b : a), hours[0]!);
  const maxProduct = Math.max(1, ...data.topProducts.map((p) => p.amount));
  const payTotal = data.paymentMethods.reduce((s, m) => s + m.amount, 0);
  const late = data.prepTimes.some((p) => p.avgSec !== null && p.avgSec > p.targetSec);

  return (
    <>
      <AdminHeader updatedAgo={Math.round((now - at) / 1000)} />
      <main className="flex-1 p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#C9B89F]/30 pb-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#B45A3C]">Monitoreo Operativo en Tiempo Real</span>
            <h1 className="font-display text-3xl font-bold text-neutral-900 tracking-tight mt-1">Resumen del día</h1>
            <p className="text-xs text-neutral-600 mt-1 font-normal">Comparativa contra el mismo día de la semana anterior a la misma hora.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white/90 border border-[#C9B89F]/60 rounded-xl p-5 shadow-xs hover:border-[#1E2F28]/40 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-500 tracking-wide uppercase">Ventas hoy</span>
              {growth !== null && (
                <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${growth >= 0 ? "text-emerald-800 bg-emerald-50 border-emerald-200" : "text-terracota bg-terracota-light border-terracota/30"}`}>
                  <span className="material-symbols-outlined text-[13px] mr-0.5">{growth >= 0 ? "trending_up" : "trending_down"}</span>
                  {growth >= 0 ? "+" : ""}{growth.toFixed(1)}%
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-display text-3xl font-bold text-neutral-900 tracking-tight">{money(data.salesToday)}</span>
              <span className="text-xs font-medium text-neutral-500">MXN</span>
            </div>
            <div className="mt-3 pt-3 border-t border-neutral-100 flex justify-between text-[11px] text-neutral-600">
              <span>Misma hora sem. anterior:</span>
              <span className="font-semibold text-neutral-800">{money(data.salesLastWeek)}</span>
            </div>
          </div>
          <div className="bg-white/90 border border-[#C9B89F]/60 rounded-xl p-5 shadow-xs hover:border-[#1E2F28]/40 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-500 tracking-wide uppercase">Ticket promedio</span>
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-display text-3xl font-bold text-neutral-900 tracking-tight">{money(data.avgTicket)}</span>
              <span className="text-xs font-medium text-neutral-500">MXN / cuenta</span>
            </div>
            <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-600">
              <span>Cuentas cobradas: <strong className="text-neutral-800 font-semibold">{data.tickets}</strong></span>
            </div>
          </div>
          <div className="bg-white/90 border border-[#C9B89F]/60 rounded-xl p-5 shadow-xs hover:border-[#1E2F28]/40 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-500 tracking-wide uppercase">Comensales</span>
              <span className="inline-flex items-center text-[11px] font-medium text-neutral-600 bg-stone-100 px-2 py-0.5 rounded-full border border-stone-200">{occ.total} mesas totales</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-display text-3xl font-bold text-neutral-900 tracking-tight">{data.guests}</span>
              <span className="text-xs font-medium text-neutral-500">personas hoy</span>
            </div>
            <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px]">
              <span className="text-neutral-600">Cuentas abiertas:</span>
              <span className="font-semibold bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-200/60">{data.openChecks}</span>
            </div>
          </div>
          <div className="bg-white/90 border border-[#C9B89F]/60 rounded-xl p-5 shadow-xs hover:border-[#1E2F28]/40 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-500 tracking-wide uppercase">Ocupación de Mesas</span>
              <span className="text-xs font-bold text-[#1E2F28]">{Math.round(pct(occ.occupied))}% ({occ.occupied}/{occ.total})</span>
            </div>
            <div className="h-2 w-full flex rounded-full overflow-hidden bg-stone-200 my-2.5">
              <div className="bg-[#1E2F28]" style={{ width: `${pct(occ.occupied - occ.pidioCuenta)}%` }} />
              <div className="bg-[#B45A3C]" style={{ width: `${pct(occ.pidioCuenta)}%` }} />
              <div className="bg-stone-300" style={{ width: `${pct(occ.free)}%` }} />
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[10.5px]">
              <span className="flex items-center gap-1 text-neutral-700"><span className="w-2 h-2 rounded-full bg-[#1E2F28]" />{occ.occupied} ocupadas</span>
              <span className="flex items-center gap-1 text-neutral-500"><span className="w-2 h-2 rounded-full bg-stone-300" />{occ.free} libres</span>
              <span className="flex items-center gap-1 font-semibold text-terracota"><span className="w-2 h-2 rounded-full bg-[#B45A3C] animate-pulse" />{occ.pidioCuenta} cuenta</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-xl border border-[#C9B89F]/60 p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="font-display text-lg font-bold text-neutral-900">Curva de Ventas por Hora</h2>
                  <p className="text-xs text-neutral-500">Evolución horaria del servicio (12:00 - 23:00 hrs)</p>
                </div>
                <div className="flex items-center gap-2 text-xs"><span className="w-3 h-3 rounded-sm bg-[#1E2F28]" /><span className="font-medium text-neutral-700">Hoy</span></div>
              </div>
              <div className="w-full h-56 relative pt-2">
                <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 680 180">
                  <defs>
                    <linearGradient id="olivoGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                      <stop offset="0%" stopColor="#1E2F28" stopOpacity="0.30" />
                      <stop offset="100%" stopColor="#1E2F28" stopOpacity="0.01" />
                    </linearGradient>
                  </defs>
                  {[20, 65, 110].map((y) => <line key={y} stroke="#ECE8DF" strokeDasharray="3,3" strokeWidth="1" x1="0" x2="680" y1={y} y2={y} />)}
                  <line stroke="#ECE8DF" strokeWidth="1" x1="0" x2="680" y1="155" y2="155" />
                  <path d={`${line} L 680,155 L 0,155 Z`} fill="url(#olivoGradient)" />
                  <path d={line} fill="none" stroke="#1E2F28" strokeLinecap="round" strokeWidth="2.5" />
                </svg>
                {peak && peak.total > 0 && (
                  <div className="absolute top-1 right-[8%] bg-[#1E2F28] text-white px-2 py-0.5 rounded shadow text-[10px] font-medium flex items-center gap-1 pointer-events-none">
                    <span className="text-amber-300 font-bold">{money(peak.total)}/h</span> (Pico {peak.hour}:00)
                  </div>
                )}
              </div>
              <div className="flex justify-between text-[11px] text-neutral-400 font-mono mt-2 pt-2 border-t border-neutral-100 px-1">
                {hours.map((h) => (
                  <span key={h.hour} className={h.hour === new Date().getHours() ? "text-[#1E2F28] font-bold" : ""}>{h.hour}:00</span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-[#C9B89F]/60 p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-display text-base font-bold text-neutral-900">Top Productos del Día</h3>
                    <span className="text-[11px] text-neutral-500 font-medium">Volumen &amp; Ventas</span>
                  </div>
                  <div className="space-y-3.5 mt-2">
                    {data.topProducts.map((p, i) => (
                      <div key={p.name} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-neutral-800"><span className={`${i < 2 ? "text-amber-800" : "text-neutral-500"} font-bold mr-1`}>{i + 1}.</span>{p.name}</span>
                          <span className="font-semibold text-neutral-900">{p.qty} uds · <span className="font-mono text-neutral-700">{money(p.amount)}</span></span>
                        </div>
                        <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-[#1E2F28] h-1.5 rounded-full" style={{ width: `${(p.amount / maxProduct) * 100}%`, opacity: 1 - i * 0.15 }} />
                        </div>
                      </div>
                    ))}
                    {data.topProducts.length === 0 && <p className="text-xs text-neutral-500">Sin ventas registradas hoy.</p>}
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-[#C9B89F]/60 p-5 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-display text-base font-bold text-neutral-900">SLA &amp; Tiempos Cocina</h3>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border ${late ? "text-amber-900 bg-amber-50 border-amber-300" : "text-emerald-800 bg-emerald-50 border-emerald-200"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${late ? "bg-amber-600" : "bg-emerald-600"}`} />
                    {late ? "Con demoras" : "Turno fluido"}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 mb-3">Promedio de preparación por estación en últimos 60 min.</p>
                <div className="space-y-2.5">
                  {data.prepTimes.map((p) => {
                    const over = p.avgSec !== null && p.avgSec > p.targetSec;
                    return (
                      <div key={p.station} className={`p-2.5 rounded-lg flex items-center justify-between ${over ? "bg-amber-50/70 border border-amber-300/80" : "bg-stone-50 border border-stone-200/70"}`}>
                        <div className="flex items-center gap-2.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${p.avgSec === null ? "bg-stone-300" : over ? "bg-amber-600 animate-pulse" : "bg-emerald-600"}`} />
                          <div>
                            <p className={`text-xs font-semibold ${over ? "text-neutral-900" : "text-neutral-800"}`}>{p.station}</p>
                            <p className={`text-[10px] ${over ? "text-amber-800" : "text-neutral-500"}`}>Objetivo &lt; {Math.round(p.targetSec / 60)} min</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`font-mono text-xs font-bold ${over ? "text-amber-900" : "text-emerald-800"}`}>{p.avgSec === null ? "—" : mins(p.avgSec)}</span>
                          <span className={`text-[10px] block ${over ? "text-amber-700 font-semibold" : "text-emerald-700"}`}>
                            {p.avgSec === null ? "Sin datos" : over ? `+${mins(p.avgSec - p.targetSec)} demorado` : "En tiempo"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-xl border border-[#C9B89F]/60 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-terracota text-xl">warning</span>
                  <h3 className="font-display text-base font-bold text-neutral-900">Alertas Operativas</h3>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">{data.alerts.length} activas</span>
              </div>
              <div className="space-y-3">
                {data.alerts.length === 0 && <p className="text-xs text-neutral-500">Sin alertas en este momento.</p>}
                {data.alerts.map((a, i) => {
                  const style = a.kind === "cxp" ? { box: "bg-terracota-light/60 border border-terracota/30", icon: "account_balance_wallet", ic: "text-terracota" }
                    : a.kind === "insumo" ? { box: "bg-amber-50/80 border border-amber-300", icon: "inventory", ic: "text-amber-700" }
                    : { box: "bg-stone-50 border border-stone-200", icon: "security", ic: "text-neutral-700" };
                  return (
                    <div key={i} className={`p-3.5 rounded-lg space-y-1.5 ${style.box}`}>
                      <div className="flex items-start gap-2">
                        <span className={`material-symbols-outlined text-base mt-0.5 ${style.ic}`}>{style.icon}</span>
                        <div className="text-xs">
                          <p className="font-semibold text-neutral-900">{a.title}</p>
                          <p className="text-neutral-700 text-[11px] mt-0.5 leading-snug">{a.detail}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#C9B89F]/60 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-display text-base font-bold text-neutral-900">Formas de Pago</h3>
                  <p className="text-[11px] text-neutral-500">Conciliación de ingresos de caja</p>
                </div>
                <span className="material-symbols-outlined text-neutral-400 text-xl">payments</span>
              </div>
              <div className="divide-y divide-neutral-100 text-xs">
                {data.paymentMethods.map((m) => (
                  <div key={m.method} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${METHOD_DOT[m.method] ?? "bg-stone-400"}`} />
                      <span className="text-neutral-700 font-medium">{METHOD_LABEL[m.method] ?? m.method}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-neutral-900 font-mono">{money(m.amount)} MXN</span>
                      <span className="block text-[10px] text-neutral-500">{payTotal ? Math.round((m.amount / payTotal) * 100) : 0}%</span>
                    </div>
                  </div>
                ))}
                {data.paymentMethods.length === 0 && <p className="py-2 text-neutral-500">Sin cobros registrados hoy.</p>}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
