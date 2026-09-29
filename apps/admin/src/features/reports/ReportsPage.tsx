/* Diseño: design/stitch/admin-reportes-control.html (Stitch). Encabezado y pestañas originales; datos reales. E9-02, E9-03, E9-04. */
import { client } from "@convivium/app-shell";
import { useCallback, useEffect, useState } from "react";
import { ExceptionsTab } from "./ExceptionsTab";

type Tab = "ventas" | "devoluciones" | "propinas" | "tiempos" | "sucursales";
interface BranchRow { branchId: string; name: string; sales: number; checks: number; avgTicket: number; perGuest: number; tipsPct: number; onTimePct: number; p90Sec: number; exceptions: number; topCategory: string | null; lastSyncAt: string | null; sharePct: number }
const money = (c: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(c / 100);
const mins = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Descarga filas como CSV (UTF-8 con BOM para que Excel respete acentos). */
function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]!);
  const esc = (v: unknown) => { const t = String(v ?? ""); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const csv = "﻿" + [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function ReportsPage() {
  const [tab, setTab] = useState<Tab>(() => (location.hash.slice(1) as Tab) || "ventas");
  const [days, setDays] = useState(7);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const onExport = useCallback((r: Record<string, unknown>[]) => setRows(r), []);
  const isOwner = !!client.session?.permissions.includes("dashboard.ver");
  const [branches, setBranches] = useState<{ total: number; branches: BranchRow[] } | null>(null);
  const [branch, setBranch] = useState<string>(client.session?.branchId ?? "");
  useEffect(() => { if (isOwner) client.request<{ total: number; branches: BranchRow[] }>("GET", `/reports/branches?days=${days}`).then(setBranches).catch(() => setBranches(null)); }, [isOwner, days]);
  const multi = (branches?.branches.length ?? 0) > 1;
  const q = branch && branch !== client.session?.branchId ? `&branch=${branch}` : "";
  useEffect(() => { history.replaceState(null, "", `#${tab}`); setRows([]); }, [tab]);
  const TABS: [Tab, string][] = [["ventas", "Ventas"], ["devoluciones", "Devoluciones y cortesías"], ["propinas", "Propinas"], ["tiempos", "Tiempos de Servicio (SLA)"], ...(multi ? [["sucursales", "Sucursales"] as [Tab, string]] : [])];

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#F7F5F0]">
      <header className="px-8 py-4 bg-convivium-marfil border-b border-convivium-arena/70 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-convivium-carbon-muted"><span className="font-medium">Reportes y Cierre</span><span className="text-convivium-arena">/</span><span className="font-semibold text-convivium-olivo">{TABS.find((t) => t[0] === tab)![1]}</span></div>
          <h2 className="font-headline font-semibold text-xl tracking-tight text-convivium-olivo mt-0.5">Reportes de la Sucursal</h2>
        </div>
        <div className="flex items-center gap-3">
          {multi && tab !== "sucursales" && tab !== "devoluciones" && (
            <label className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-convivium-arena/70 shadow-sm text-xs font-medium text-convivium-carbon">
              <span className="material-symbols-outlined text-base text-convivium-olivo">storefront</span>
              <select value={branch} onChange={(e) => setBranch(e.target.value)} className="border-0 bg-transparent p-0 pr-6 text-xs font-medium focus:ring-0">
                {branches!.branches.map((b) => <option key={b.branchId} value={b.branchId}>{b.name}</option>)}
                <option value="todas">Todas las sucursales</option>
              </select>
            </label>
          )}
          <div className="flex items-center gap-1 bg-white px-1 py-1 rounded-lg border border-convivium-arena/70 shadow-sm text-xs font-medium text-convivium-carbon">
            <span className="material-symbols-outlined text-base text-convivium-dorado px-1">calendar_today</span>
            {[1, 7, 30].map((d) => <button key={d} onClick={() => setDays(d)} className={days === d ? "px-2.5 py-1 rounded bg-convivium-olivo text-amber-100 font-semibold" : "px-2.5 py-1 rounded text-convivium-carbon-muted hover:text-convivium-carbon"}>{d === 1 ? "Hoy" : `Últimos ${d} días`}</button>)}
          </div>
          <button disabled={!rows.length} onClick={() => downloadCsv(`convivium-${tab}-${days}d`, rows)} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-convivium-olivo hover:bg-convivium-olivo-surface text-amber-100 text-xs font-medium transition-all active:scale-[0.99] shadow-sm disabled:opacity-40">
            <span className="material-symbols-outlined text-base">table_view</span><span>Exportar Excel / CSV</span>
          </button>
        </div>
      </header>
      <div className="bg-convivium-marfil border-b border-convivium-arena/70 px-8 pt-4">
        <nav aria-label="Pestañas de reportes" className="flex gap-8">
          {TABS.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={tab === k ? "border-b-2 border-convivium-olivo text-convivium-olivo pb-3 font-body text-sm font-semibold flex items-center gap-2.5 transition-colors" : "text-convivium-carbon-muted hover:text-convivium-carbon pb-3 font-body text-sm font-medium transition-colors flex items-center gap-2"}>{l}</button>
          ))}
        </nav>
      </div>
      <main className="flex-1 p-8">
        {tab === "ventas" && <SalesTab days={days} q={q} onExport={onExport} />}
        {tab === "devoluciones" && <ExceptionsTab days={days} onExport={onExport} />}
        {tab === "propinas" && <TipsTab days={days} q={q} onExport={onExport} />}
        {tab === "tiempos" && <TimesTab days={days} q={q} onExport={onExport} />}
        {tab === "sucursales" && branches && <BranchesTab data={branches} onExport={onExport} />}
      </main>
    </div>
  );
}

function Kpi({ title, value, sub, icon }: { title: string; value: string; sub?: string; icon: string }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-convivium-arena/60 shadow-sm">
      <div className="flex items-center justify-between mb-3"><span className="text-xs font-semibold uppercase tracking-wider text-convivium-carbon-muted">{title}</span><span className="w-8 h-8 rounded-lg flex items-center justify-center border bg-stone-100 text-convivium-carbon border-stone-200"><span className="material-symbols-outlined text-lg">{icon}</span></span></div>
      <span className="font-headline font-bold text-3xl text-convivium-carbon tracking-tight">{value}</span>
      {sub && <p className="mt-2 text-xs text-convivium-carbon-muted">{sub}</p>}
    </div>
  );
}
const Table = ({ head, children }: { head: string[]; children: React.ReactNode }) => (
  <div className="bg-white rounded-xl border border-convivium-arena/60 shadow-sm overflow-hidden">
    <table className="w-full text-left text-xs">
      <thead><tr className="bg-convivium-marfil-subtle border-b border-convivium-arena/60 text-[11px] font-semibold uppercase tracking-wider text-convivium-carbon-muted">{head.map((h, i) => <th key={h} className={`py-3 px-4 ${i ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-stone-100">{children}</tbody>
    </table>
  </div>
);
const Bar = ({ pct }: { pct: number }) => <div className="w-full bg-convivium-marfil-subtle rounded-full h-1.5 overflow-hidden mt-1"><div className="bg-convivium-dorado h-1.5 rounded-full" style={{ width: `${Math.min(100, pct)}%` }} /></div>;

type Exp = { days: number; q?: string; onExport: (r: Record<string, unknown>[]) => void };

function SalesTab({ days, q = "", onExport }: Exp) {
  const [by, setBy] = useState("producto");
  const [r, setR] = useState<any>(null);
  useEffect(() => { client.request("GET", `/reports/sales?days=${days}&groupBy=${by}${q}`).then(setR); }, [days, by, q]);
  useEffect(() => { if (r) onExport(r.rows.map((x: any) => ({ [by]: x.label, importe: x.amount / 100, unidades: x.units, cuentas: x.checks, porcentaje: x.pct }))); }, [r, by, onExport]);
  if (!r) return null;
  const GROUPS: [string, string][] = [["producto", "Producto"], ["categoria", "Categoría"], ["mesero", "Mesero"], ["estacion", "Estación"], ["forma_pago", "Forma de pago"], ["hora", "Hora"]];
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi title="Venta total" value={money(r.summary.total)} sub="Cuentas cobradas, impuestos incluidos" icon="payments" />
        <Kpi title="Cuentas" value={String(r.summary.checks)} icon="receipt_long" />
        <Kpi title="Ticket promedio" value={money(r.summary.avgTicket)} icon="avg_pace" />
        <Kpi title="Por comensal" value={money(r.summary.perGuest)} sub={`${r.summary.guests} comensales`} icon="group" />
      </section>
      <div className="inline-flex rounded-lg border border-convivium-arena p-0.5 bg-white text-xs">
        {GROUPS.map(([k, l]) => <button key={k} onClick={() => setBy(k)} className={by === k ? "px-3 py-1.5 rounded bg-convivium-olivo text-convivium-dorado font-semibold" : "px-3 py-1.5 rounded text-convivium-carbon-muted"}>{l}</button>)}
      </div>
      <Table head={[GROUPS.find((g) => g[0] === by)![1], "Unidades", "Cuentas", "Importe", "% de la venta"]}>
        {r.rows.map((x: any) => (
          <tr key={x.key} className="hover:bg-convivium-marfil-subtle/50">
            <td className="py-2.5 px-4 font-medium text-convivium-carbon">{x.label}</td>
            <td className="py-2.5 px-4 text-right font-mono">{by === "forma_pago" ? "—" : x.units}</td>
            <td className="py-2.5 px-4 text-right font-mono">{x.checks}</td>
            <td className="py-2.5 px-4 text-right font-mono font-semibold">{money(x.amount)}</td>
            <td className="py-2.5 px-4 text-right w-40"><span className="font-mono">{x.pct}%</span><Bar pct={x.pct} /></td>
          </tr>
        ))}
        {!r.rows.length && <tr><td colSpan={5} className="py-6 text-center text-convivium-carbon-muted">Sin ventas cobradas en el periodo.</td></tr>}
      </Table>
    </div>
  );
}

function TipsTab({ days, q = "", onExport }: Exp) {
  const [r, setR] = useState<any>(null);
  useEffect(() => { client.request("GET", `/reports/tips?days=${days}${q}`).then(setR); }, [days, q]);
  useEffect(() => { if (r) onExport(r.byWaiter.map((w: any) => ({ mesero: w.name, propinas: w.amount / 100, cuentas_con_propina: w.count, venta: w.sales / 100, porcentaje: w.pctOfSales }))); }, [r, onExport]);
  if (!r) return null;
  const METHOD: Record<string, string> = { efectivo_mxn: "Efectivo MXN", efectivo_usd: "Efectivo USD", tarjeta: "Tarjeta", transferencia: "Transferencia", vales: "Vales" };
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi title="Propinas" value={money(r.summary.total)} sub={`${r.summary.pctOfSales}% sobre la venta`} icon="volunteer_activism" />
        <Kpi title="Cuentas con propina" value={`${r.summary.checksWithTip} / ${r.summary.checks}`} icon="receipt_long" />
        <Kpi title="Por forma de pago" value={r.byMethod.map((m: any) => METHOD[m.method] ?? m.method).join(" · ") || "—"} sub={r.byMethod.map((m: any) => money(m.amount)).join(" · ")} icon="credit_card" />
      </section>
      <Table head={["Mesero", "Propinas", "Cuentas", "Venta atendida", "% sobre su venta"]}>
        {r.byWaiter.map((w: any) => (
          <tr key={w.waiterId} className="hover:bg-convivium-marfil-subtle/50">
            <td className="py-2.5 px-4 font-medium text-convivium-carbon">{w.name}</td>
            <td className="py-2.5 px-4 text-right font-mono font-semibold">{money(w.amount)}</td>
            <td className="py-2.5 px-4 text-right font-mono">{w.count}</td>
            <td className="py-2.5 px-4 text-right font-mono">{money(w.sales)}</td>
            <td className="py-2.5 px-4 text-right w-40"><span className="font-mono">{w.pctOfSales}%</span><Bar pct={w.pctOfSales * 5} /></td>
          </tr>
        ))}
        {!r.byWaiter.length && <tr><td colSpan={5} className="py-6 text-center text-convivium-carbon-muted">Sin propinas en el periodo.</td></tr>}
      </Table>
    </div>
  );
}

function TimesTab({ days, q = "", onExport }: Exp) {
  const [r, setR] = useState<any>(null);
  useEffect(() => { client.request("GET", `/reports/prep-times?days=${days}${q}`).then(setR); }, [days, q]);
  useEffect(() => { if (r) onExport(r.byProduct.map((p: any) => ({ producto: p.name, muestras: p.samples, promedio_min: +(p.avgSec / 60).toFixed(1), p50_min: +(p.p50Sec / 60).toFixed(1), p90_min: +(p.p90Sec / 60).toFixed(1), meta_min: +(p.targetSec / 60).toFixed(1), a_tiempo_pct: p.onTimePct }))); }, [r, onExport]);
  if (!r) return null;
  const tone = (pct: number) => (pct >= 85 ? "text-emerald-700" : pct >= 70 ? "text-amber-700" : "text-convivium-terracota-alert");
  const Rows = ({ list, label }: { list: any[]; label: (x: any) => string }) => (
    <>
      {list.map((x) => (
        <tr key={label(x)} className="hover:bg-convivium-marfil-subtle/50">
          <td className="py-2.5 px-4 font-medium text-convivium-carbon">{label(x)}</td>
          <td className="py-2.5 px-4 text-right font-mono">{x.samples}</td>
          <td className="py-2.5 px-4 text-right font-mono">{mins(x.avgSec)}</td>
          <td className="py-2.5 px-4 text-right font-mono">{mins(x.p50Sec)}</td>
          <td className={`py-2.5 px-4 text-right font-mono font-semibold ${x.p90Sec > x.targetSec ? "text-convivium-terracota-alert" : ""}`}>{mins(x.p90Sec)}</td>
          <td className="py-2.5 px-4 text-right font-mono">{mins(x.targetSec)}</td>
          <td className={`py-2.5 px-4 text-right font-mono font-semibold ${tone(x.onTimePct)}`}>{x.onTimePct}%</td>
        </tr>
      ))}
    </>
  );
  const head = ["", "Muestras", "Promedio", "p50", "p90", "Meta", "A tiempo"];
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi title="A tiempo" value={`${r.summary.onTimePct}%`} sub="Enviado → listo dentro de la meta" icon="timer" />
        <Kpi title="Promedio" value={mins(r.summary.avgSec)} sub="minutos" icon="avg_pace" />
        <Kpi title="p90" value={mins(r.summary.p90Sec)} sub="9 de cada 10 salen antes de esto" icon="speed" />
        <Kpi title="Platillos medidos" value={String(r.summary.samples)} icon="skillet" />
      </section>
      <Table head={["Estación", ...head.slice(1)]}><Rows list={r.byStation} label={(x) => x.name} /></Table>
      <Table head={["Producto (más lentos primero)", ...head.slice(1)]}><Rows list={r.byProduct} label={(x) => x.name} /></Table>
    </div>
  );
}

/** E9-06 · Comparativo lado a lado; la mejor cifra de cada columna se resalta. */
function BranchesTab({ data, onExport }: { data: { total: number; branches: BranchRow[] }; onExport: Exp["onExport"] }) {
  useEffect(() => onExport(data.branches.map((b) => ({ sucursal: b.name, venta: b.sales / 100, participacion_pct: b.sharePct, cuentas: b.checks, ticket_promedio: b.avgTicket / 100, por_comensal: b.perGuest / 100, propinas_pct: b.tipsPct, cocina_a_tiempo_pct: b.onTimePct, cancelaciones_devoluciones: b.exceptions, ultima_sincronizacion: b.lastSyncAt ?? "" }))), [data, onExport]);
  const best = (k: keyof BranchRow, low = false) => { const v = data.branches.map((b) => b[k] as number); return low ? Math.min(...v) : Math.max(...v); };
  const hl = (b: BranchRow, k: keyof BranchRow, low = false) => (data.branches.length > 1 && b[k] === best(k, low) ? "text-emerald-700 font-bold" : "");
  const since = (iso: string | null) => { if (!iso) return "Sin nodo vinculado"; const m = Math.floor((Date.now() - Date.parse(iso)) / 60000); return m < 2 ? "En línea" : m < 60 ? `Hace ${m} min` : `Hace ${Math.floor(m / 60)} h`; };
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi title="Venta consolidada" value={money(data.total)} sub={`${data.branches.length} sucursales`} icon="storefront" />
        <Kpi title="Líder en venta" value={data.branches[0]?.name ?? "—"} sub={`${data.branches[0]?.sharePct ?? 0}% del total`} icon="emoji_events" />
        <Kpi title="Mejor puntualidad de cocina" value={[...data.branches].sort((a, b) => b.onTimePct - a.onTimePct)[0]?.name ?? "—"} sub={`${best("onTimePct")}% a tiempo`} icon="timer" />
      </section>
      <Table head={["Sucursal", "Venta", "Participación", "Cuentas", "Ticket prom.", "Por comensal", "Propinas", "Cocina a tiempo", "Cancel./devol.", "Sincronización"]}>
        {data.branches.map((b) => (
          <tr key={b.branchId} className="hover:bg-convivium-marfil-subtle/50">
            <td className="py-2.5 px-4 font-medium text-convivium-carbon">{b.name}{b.topCategory && <span className="block text-[10px] text-convivium-carbon-muted font-normal">Top: {b.topCategory}</span>}</td>
            <td className={`py-2.5 px-4 text-right font-mono ${hl(b, "sales")}`}>{money(b.sales)}</td>
            <td className="py-2.5 px-4 text-right w-32"><span className="font-mono">{b.sharePct}%</span><Bar pct={b.sharePct} /></td>
            <td className="py-2.5 px-4 text-right font-mono">{b.checks}</td>
            <td className={`py-2.5 px-4 text-right font-mono ${hl(b, "avgTicket")}`}>{money(b.avgTicket)}</td>
            <td className={`py-2.5 px-4 text-right font-mono ${hl(b, "perGuest")}`}>{money(b.perGuest)}</td>
            <td className="py-2.5 px-4 text-right font-mono">{b.tipsPct}%</td>
            <td className={`py-2.5 px-4 text-right font-mono ${hl(b, "onTimePct")}`}>{b.onTimePct}%</td>
            <td className={`py-2.5 px-4 text-right font-mono ${hl(b, "exceptions", true)}`}>{b.exceptions}</td>
            <td className="py-2.5 px-4 text-right text-[11px] text-convivium-carbon-muted">{since(b.lastSyncAt)}</td>
          </tr>
        ))}
      </Table>
      <p className="text-[11px] text-convivium-carbon-muted">Cada nodo sube sus ventas, caja e inventario a la nube en su siguiente ciclo de sincronización; una sucursal sin internet aparece con sus últimos datos subidos.</p>
    </div>
  );
}
