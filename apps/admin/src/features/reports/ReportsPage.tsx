/* Diseño: design/stitch/admin-reportes-control.html (Stitch). Marcado y clases originales; datos reales. E9-03, E5-06. */
import { client } from "@convivium/app-shell";
import { useEffect, useState } from "react";

interface Report {
  days: number;
  totals: Record<"devolucion" | "cancelacion" | "cortesia" | "descuento", { count: number; amount: number }>;
  byReason: { reason: string; count: number; pct: number }[];
  employees: { name: string; count: number; amount: number; authorized: number; ratioVsOthers: number | null; alert: boolean }[];
  rows: { at: string; kind: string; product: string | null; where: string; amount: number; reason: string; requestedBy: string | null; authorizedBy: string | null }[];
}
const money = (c: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(c / 100);
const initials = (n: string) => n.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
const KIND: Record<string, { label: string; cls: string }> = {
  devolucion: { label: "Devolución", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  cancelacion: { label: "Cancelación", cls: "bg-orange-50 text-orange-800 border-orange-200" },
  cortesia: { label: "Cortesía", cls: "bg-emerald-50 text-convivium-olivo border-convivium-olivo/20" },
  descuento: { label: "Descuento", cls: "bg-stone-100 text-convivium-carbon border-stone-200" },
};
const BAR = ["bg-convivium-terracota", "bg-convivium-dorado", "bg-convivium-arena", "bg-stone-400"];

export function ReportsPage() {
  const [days, setDays] = useState(7);
  const [r, setR] = useState<Report | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  useEffect(() => { client.request<Report>("GET", `/reports/exceptions?days=${days}`).then(setR); }, [days]);

  if (!r) return null;
  const all = Object.values(r.totals).reduce((s, t) => s + t.amount, 0) || 1;
  const flagged = r.employees.find((e) => e.alert && e.name !== dismissed);
  const rows = focus ? r.rows.filter((x) => x.requestedBy === focus) : r.rows;

  const Card = ({ k, title, icon, iconCls, bar, sub }: { k: keyof Report["totals"]; title: string; icon: string; iconCls: string; bar: string; sub: string }) => (
    <div className="bg-white rounded-xl p-5 border border-convivium-arena/60 shadow-sm relative overflow-hidden group hover:border-convivium-arena transition-all">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-convivium-carbon-muted">{title}</span>
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center border ${iconCls}`}><span className="material-symbols-outlined text-lg">{icon}</span></span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-headline font-bold text-3xl text-convivium-carbon tracking-tight">{r.totals[k].count}</span>
        <span className="text-sm font-semibold text-convivium-terracota-alert">· {money(r.totals[k].amount)} MXN</span>
      </div>
      <p className="mt-2 text-xs text-convivium-carbon-muted">{sub}</p>
      <div className="mt-3 w-full bg-convivium-marfil-subtle rounded-full h-1.5 overflow-hidden">
        <div className={`${bar} h-1.5 rounded-full`} style={{ width: `${(r.totals[k].amount / all) * 100}%` }} />
      </div>
    </div>
  );

  return (
    <main className="flex-1 p-8 space-y-6 bg-[#F7F5F0] min-h-screen">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-convivium-arena/40 pb-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-convivium-terracota">Reportes de Control</span>
          <h1 className="font-headline text-3xl font-bold text-convivium-olivo tracking-tight mt-1">Devoluciones, cortesías y cancelaciones</h1>
        </div>
        <div className="inline-flex rounded-lg border border-convivium-arena p-0.5 bg-white text-xs">
          {[1, 7, 30].map((d) => (
            <button key={d} onClick={() => setDays(d)} className={days === d ? "px-3 py-1.5 rounded bg-convivium-olivo text-convivium-dorado font-semibold" : "px-3 py-1.5 rounded text-convivium-carbon-muted"}>{d === 1 ? "Hoy" : `Últimos ${d} días`}</button>
          ))}
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card k="devolucion" title="Devoluciones" icon="assignment_return" iconCls="bg-amber-50 text-amber-800 border-amber-200/60" bar="bg-convivium-terracota" sub="Platillos regresados por el comensal" />
        <Card k="cortesia" title="Cortesías" icon="redeem" iconCls="bg-emerald-50 text-convivium-olivo border-convivium-olivo/20" bar="bg-convivium-dorado" sub="Autorizadas por capitán o gerente" />
        <Card k="descuento" title="Descuentos" icon="percent" iconCls="bg-stone-100 text-convivium-carbon border-stone-200" bar="bg-convivium-arena" sub="Sobre producto o cuenta" />
        <Card k="cancelacion" title="Cancelaciones" icon="soup_kitchen" iconCls="bg-orange-50 text-orange-800 border-orange-200/70" bar="bg-orange-400" sub="Productos enviados a estación y cancelados" />
      </section>

      {flagged && (
        <section className="rounded-xl p-5 border-2 border-convivium-terracota-border bg-convivium-terracota-light flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-convivium-terracota-alert text-2xl">radar</span>
            <div>
              <h3 className="font-headline font-semibold text-base text-convivium-terracota-alert">Radar de Control: desviación inusual en cortesías y anulaciones</h3>
              <p className="mt-1 text-xs text-convivium-carbon leading-relaxed">
                <strong className="font-semibold text-convivium-terracota-alert">{flagged.name}</strong> presenta{" "}
                <span className="underline decoration-convivium-terracota-alert font-medium">{flagged.ratioVsOthers ? `${flagged.ratioVsOthers.toFixed(1)}x sobre el promedio del equipo` : `${flagged.count} movimientos`}</span>, acumulando {money(flagged.amount)} MXN en el periodo.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
            <button onClick={() => setDismissed(flagged.name)} className="px-3.5 py-2 rounded-lg bg-white border border-convivium-terracota-border text-convivium-terracota-alert text-xs font-semibold hover:bg-stone-50 transition-colors shadow-xs">Ignorar</button>
            <button onClick={() => setFocus(flagged.name)} className="px-3.5 py-2 rounded-lg bg-convivium-terracota-alert text-white text-xs font-semibold hover:bg-convivium-terracota transition-colors shadow-sm flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">visibility</span>Auditar movimientos de {flagged.name}
            </button>
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white rounded-xl p-6 border border-convivium-arena/60 shadow-sm">
          <div className="pb-3 border-b border-convivium-marfil-subtle">
            <h3 className="font-headline font-semibold text-base text-convivium-olivo">Distribución por Motivo</h3>
            <p className="text-xs text-convivium-carbon-muted">{r.rows.length} movimientos en el periodo</p>
          </div>
          <div className="mt-4 space-y-3.5">
            {r.byReason.map((b, i) => (
              <div key={b.reason}>
                <div className="flex justify-between text-xs mb-1"><span className="font-medium text-convivium-carbon">{b.reason}</span><span className="text-convivium-carbon-muted">{b.count} ({b.pct}%)</span></div>
                <div className="h-2 w-full bg-convivium-marfil-subtle rounded-full overflow-hidden"><div className={`h-full ${BAR[i % BAR.length]} rounded-full transition-all duration-500`} style={{ width: `${b.pct}%` }} /></div>
              </div>
            ))}
            {r.byReason.length === 0 && <p className="text-xs text-convivium-carbon-muted">Sin movimientos.</p>}
          </div>
        </div>

        <div className="lg:col-span-7 bg-white rounded-xl border border-convivium-arena/70 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-convivium-marfil-subtle"><h3 className="font-headline font-semibold text-lg text-convivium-olivo">Por colaborador</h3></div>
          <table className="w-full text-left text-xs">
            <thead className="bg-convivium-marfil-subtle/60 text-convivium-carbon-muted uppercase tracking-wider text-[10px]">
              <tr><th className="py-3 px-6">Colaborador</th><th className="py-3 px-6">Movimientos</th><th className="py-3 px-6">Importe</th><th className="py-3 px-6">Estado</th><th className="py-3 px-6 text-right" /></tr>
            </thead>
            <tbody className="divide-y divide-convivium-marfil-subtle">
              {r.employees.map((e) => (
                <tr key={e.name} className={e.alert ? "bg-convivium-terracota-light/50" : "hover:bg-convivium-marfil/50 transition-colors"}>
                  <td className="py-3.5 px-6"><div className="flex items-center gap-2.5"><div className={`w-7 h-7 rounded-full text-white flex items-center justify-center font-bold text-xs ${e.alert ? "bg-convivium-terracota-alert" : "bg-convivium-arena"}`}>{initials(e.name)}</div><span className="font-semibold text-convivium-carbon">{e.name}</span></div></td>
                  <td className="py-3.5 px-6">{e.count} <span className="text-convivium-carbon-muted">({e.authorized} autorizados)</span></td>
                  <td className="py-3.5 px-6 font-mono font-semibold">{money(e.amount)}</td>
                  <td className="py-3.5 px-6">
                    {e.alert ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-convivium-terracota-alert text-white shadow-xs"><span className="material-symbols-outlined text-xs">warning</span>Alerta de Radar</span>
                    ) : <span className="text-[11px] text-convivium-carbon-muted">Dentro de rango</span>}
                  </td>
                  <td className="py-3.5 px-6 text-right">
                    <button onClick={() => setFocus(focus === e.name ? null : e.name)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-convivium-arena text-convivium-olivo font-medium hover:bg-stone-50 transition-colors">
                      {focus === e.name ? "Quitar filtro" : "Ver desglose"}<span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {r.employees.length === 0 && <p className="p-6 text-xs text-convivium-carbon-muted">Sin movimientos por colaborador.</p>}
        </div>
      </section>

      <section className="bg-white rounded-xl border border-convivium-arena/70 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-convivium-marfil-subtle flex items-center justify-between">
          <h3 className="font-headline font-semibold text-lg text-convivium-olivo">Detalle de movimientos{focus ? ` · ${focus}` : ""}</h3>
          <span className="text-xs text-convivium-carbon-muted">{rows.length} registros</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-convivium-marfil-subtle/60 text-convivium-carbon-muted uppercase tracking-wider text-[10px]">
              <tr><th className="py-3 px-4">Fecha</th><th className="py-3 px-4">Tipo</th><th className="py-3 px-5">Mesa / Producto</th><th className="py-3 px-5">Motivo Registrado</th><th className="py-3 px-4">Solicitó</th><th className="py-3 px-4">Autorizó</th><th className="py-3 px-4 text-right">Importe</th></tr>
            </thead>
            <tbody className="divide-y divide-convivium-marfil-subtle">
              {rows.map((x, i) => (
                <tr key={i} className="hover:bg-convivium-marfil/40">
                  <td className="py-3 px-4 font-mono text-[11px] text-convivium-carbon-muted whitespace-nowrap">{new Date(x.at).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td className="py-3 px-4"><span className={`inline-flex px-2 py-0.5 rounded-md border text-[11px] font-semibold ${KIND[x.kind]?.cls}`}>{KIND[x.kind]?.label}</span></td>
                  <td className="py-3 px-5"><span className="font-medium text-convivium-carbon">{x.where}</span>{x.product && <span className="text-convivium-carbon-muted"> · {x.product}</span>}</td>
                  <td className="py-3 px-5">{x.reason}</td>
                  <td className="py-3 px-4">{x.requestedBy ?? "—"}</td>
                  <td className="py-3 px-4">{x.authorizedBy ?? "—"}</td>
                  <td className="py-3 px-4 text-right font-mono font-semibold">{money(x.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
