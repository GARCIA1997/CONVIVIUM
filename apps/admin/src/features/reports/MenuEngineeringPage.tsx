/* Diseño: design/stitch/admin-ingenieria-menu.html (Stitch). Marcado y clases originales; datos reales. E9-05. */
import { client } from "@convivium/app-shell";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

type Cls = "estrella" | "vaca" | "incognita" | "perro";
interface Item {
  productId: string; name: string; category: string; units: number; netRevenue: number; unitCost: number | null; price: number;
  class: Cls; netPrice: number; margin: number; costPct: number | null; contribution: number;
  advice: { priority: number; action: string; detail: string; impact: number | null };
}
interface Report {
  from: string; to: string; popThreshold: number; marginThreshold: number; items: Item[];
  summary: { grossSales: number; units: number; growthPct: number | null; avgMargin: number; grossMarginPct: number | null; theoreticalCostPct: number | null; realCostPct: number | null; costGap: number | null; withoutRecipe: number; kardexIncomplete: boolean };
}

const mxn = (c: number, dec = false) => `$${(c / 100).toLocaleString("es-MX", { minimumFractionDigits: dec ? 2 : 0, maximumFractionDigits: dec ? 2 : 0 })}`;
const DOT: Record<Cls, string> = { estrella: "bg-dorado-400 border-olivo-950", vaca: "bg-olivo-800 border-dorado-300", incognita: "bg-arena-400 border-carbon-900", perro: "bg-terracota-500 border-white" };
const LABEL: Record<Cls, string> = { estrella: "Estrellas", vaca: "Vacas", incognita: "Incógnitas", perro: "Perros" };
const CARD: Record<Cls, { box: string; dot: string; note: string; title: string }> = {
  estrella: { box: "border-dorado-300/80 bg-dorado-200/20", dot: "bg-dorado-400", note: "border-dorado-200 text-dorado-600", title: "text-olivo-950" },
  vaca: { box: "border-emerald-900/30 bg-emerald-950/5", dot: "bg-olivo-800", note: "border-emerald-900/20 text-olivo-900", title: "text-olivo-950" },
  incognita: { box: "border-arena-300 bg-arena-200/20", dot: "bg-arena-400", note: "border-arena-300 text-stone-800", title: "text-olivo-950" },
  perro: { box: "border-terracota-300 bg-terracota-100/30", dot: "bg-terracota-500", note: "border-terracota-300 text-terracota-700", title: "text-terracota-700" },
};
const PERIODS = [[7, "7 días"], [30, "30 días"], [90, "90 días"]] as const;

export function MenuEngineeringPage() {
  const nav = useNavigate();
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<Report | null>(null);
  const [cat, setCat] = useState("todos");
  const [tab, setTab] = useState<"prioritarias" | Cls>("prioritarias");
  const [focus, setFocus] = useState<string | null>(null);
  useEffect(() => { setData(null); client.request<Report>("GET", `/reports/menu-engineering?days=${days}`).then(setData); }, [days]);

  const cats = useMemo(() => [...new Set(data?.items.map((i) => i.category) ?? [])].sort(), [data]);
  const items = (data?.items ?? []).filter((i) => cat === "todos" || i.category === cat);
  const count = (c: Cls) => items.filter((i) => i.class === c).length;
  const maxUnits = Math.max(1, ...items.map((i) => i.units));
  const margins = items.map((i) => i.margin);
  const [minM, maxM] = [Math.min(0, ...margins), Math.max(1, ...margins)];
  const pos = (i: Item) => {
    const thrU = data!.popThreshold || 1, thrM = data!.marginThreshold;
    const x = i.units < thrU ? (50 * i.units) / thrU : 50 + (50 * (i.units - thrU)) / Math.max(1, maxUnits - thrU);
    const y = i.margin >= thrM ? 50 - (50 * (i.margin - thrM)) / Math.max(1, maxM - thrM) : 50 + (50 * (thrM - i.margin)) / Math.max(1, thrM - minM);
    return { left: `${Math.min(94, Math.max(6, x))}%`, top: `${Math.min(92, Math.max(8, y))}%` };
  };
  const byContribution = [...items].sort((a, b) => b.contribution - a.contribution);
  const labeled = new Set(byContribution.slice(0, 10).map((i) => i.productId));
  const advice = items
    .filter((i) => (tab === "prioritarias" ? i.advice.priority === 1 || i.advice.impact : i.class === tab))
    .sort((a, b) => a.advice.priority - b.advice.priority || (b.advice.impact ?? 0) - (a.advice.impact ?? 0) || b.contribution - a.contribution);
  const s = data?.summary;
  const monthName = data ? new Date(data.to).toLocaleDateString("es-MX", { month: "long", year: "numeric" }) : "";

  return (
    <main className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 bg-marfil-50 min-h-screen">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-xl font-bold text-olivo-950">Ingeniería de Menú</h1>
        <div className="inline-flex rounded-lg border border-arena-300 p-0.5 bg-marfil-100 text-xs">
          {PERIODS.map(([d, l]) => <button key={d} onClick={() => setDays(d)} className={days === d ? "px-2.5 py-1 rounded bg-olivo-900 text-dorado-300 font-medium shadow-xs" : "px-2.5 py-1 rounded text-stone-600 hover:text-olivo-950 font-medium"}>{l}</button>)}
        </div>
      </div>

      {!data || !s ? <p className="text-sm text-stone-500">Calculando…</p> : (
        <>
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-arena-300/80 shadow-sm flex flex-col justify-between hover:border-dorado-400 transition-colors">
              <div className="flex items-center justify-between text-stone-500 text-xs"><span className="font-medium tracking-wide">Ventas Totales de Carta</span><span className="p-1.5 rounded-lg bg-emerald-50 text-olivo-900 border border-emerald-100"><span className="material-symbols-outlined text-base">payments</span></span></div>
              <div className="mt-2">
                <div className="text-2xl font-bold font-headline text-olivo-950 tracking-tight">{mxn(s.grossSales)} <span className="text-xs font-body font-normal text-stone-500">MXN</span></div>
                <div className={`flex items-center gap-1.5 mt-1 text-xs font-medium ${s.growthPct !== null && s.growthPct < 0 ? "text-terracota-700" : "text-emerald-700"}`}>
                  <span className="material-symbols-outlined text-sm">{s.growthPct !== null && s.growthPct < 0 ? "arrow_downward" : "arrow_upward"}</span>
                  <span>{s.units.toLocaleString("es-MX")} unidades vendidas</span>
                  {s.growthPct !== null && <span className="text-stone-400 font-normal">· {s.growthPct > 0 ? "+" : ""}{s.growthPct}% vs periodo ant.</span>}
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-arena-300/80 shadow-sm flex flex-col justify-between hover:border-dorado-400 transition-colors">
              <div className="flex items-center justify-between text-stone-500 text-xs"><span className="font-medium tracking-wide">Margen Contribución Promedio</span><span className="p-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-100"><span className="material-symbols-outlined text-base">price_change</span></span></div>
              <div className="mt-2">
                <div className="text-2xl font-bold font-headline text-olivo-950 tracking-tight">{mxn(s.avgMargin, true)} <span className="text-xs font-body font-normal text-stone-500">MXN/ítem</span></div>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-emerald-700 font-medium"><span className="material-symbols-outlined text-sm">trending_up</span><span>{s.grossMarginPct ?? "—"}% margen bruto</span><span className="text-stone-400 font-normal">· sin impuestos</span></div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-arena-300/80 shadow-sm flex flex-col justify-between hover:border-dorado-400 transition-colors">
              <div className="flex items-center justify-between text-stone-500 text-xs"><span className="font-medium tracking-wide">Costo Teórico (Recetario)</span><span className="p-1.5 rounded-lg bg-stone-100 text-stone-700 border border-stone-200"><span className="material-symbols-outlined text-base">menu_book</span></span></div>
              <div className="mt-2">
                <div className="text-2xl font-bold font-headline text-olivo-950 tracking-tight">{s.theoreticalCostPct ?? "—"}% <span className="text-xs font-body font-normal text-stone-500">de venta neta</span></div>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-stone-600 font-medium"><span className="material-symbols-outlined text-sm">{s.withoutRecipe ? "info" : "verified"}</span><span>{s.withoutRecipe ? `${s.withoutRecipe} platillos sin receta` : "Meta estándar: 28% - 32%"}</span></div>
              </div>
            </div>
            {(() => {
              const dev = s.realCostPct !== null && s.theoreticalCostPct !== null ? Math.round((s.realCostPct - s.theoreticalCostPct) * 10) / 10 : null;
              const bad = dev !== null && dev > 1;
              return (
                <div className={bad ? "bg-white p-4 rounded-xl border-2 border-terracota-500/40 shadow-sm flex flex-col justify-between bg-gradient-to-br from-white via-white to-terracota-100/30" : "bg-white p-4 rounded-xl border border-arena-300/80 shadow-sm flex flex-col justify-between"}>
                  <div className={`flex items-center justify-between text-xs ${bad ? "text-terracota-700" : "text-stone-500"}`}><span className="font-semibold uppercase tracking-wider">Costo Real (Kardex)</span><span className={`p-1.5 rounded-lg ${bad ? "bg-terracota-100 text-terracota-600" : "bg-stone-100 text-stone-700"}`}><span className="material-symbols-outlined text-base">{bad ? "warning" : "inventory"}</span></span></div>
                  <div className="mt-2">
                    <div className={`text-2xl font-bold font-headline tracking-tight ${bad ? "text-terracota-700" : "text-olivo-950"}`}>{s.realCostPct ?? "—"}% {dev !== null && <span className={`text-xs font-body font-medium ${bad ? "text-terracota-600" : "text-stone-500"}`}>({dev > 0 ? "+" : ""}{dev}% desviación)</span>}</div>
                    <div className={`flex items-center gap-1.5 mt-1 text-xs font-medium ${bad ? "text-terracota-700" : "text-stone-600"}`}><span className="material-symbols-outlined text-sm">{bad ? "trending_down" : "check"}</span><span>{s.kardexIncomplete ? "Kardex incompleto: faltan salidas de inventario" : s.costGap === null ? "Sin salidas de inventario en el periodo" : s.costGap > 0 ? `Brecha: -${mxn(s.costGap, true)} MXN` : "Consumo dentro de lo teórico"}</span></div>
                  </div>
                </div>
              );
            })()}
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8 bg-white p-5 rounded-xl border border-arena-300/80 shadow-sm flex flex-col">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-arena-200">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-headline text-lg font-bold text-olivo-950">Matriz de Rendimiento (Ingeniería de Menú)</h2>
                    <span className="text-xs px-2 py-0.5 rounded bg-dorado-200/80 text-dorado-600 font-semibold border border-dorado-300 capitalize">{monthName}</span>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">{items.length} platillos vendidos en {days} días, clasificados por volumen de venta vs. margen unitario.</p>
                </div>
                <div className="inline-flex rounded-lg border border-arena-300 p-0.5 bg-marfil-100 text-xs flex-wrap">
                  {["todos", ...cats].map((c) => <button key={c} onClick={() => setCat(c)} className={cat === c ? "px-2.5 py-1 rounded bg-olivo-900 text-dorado-300 font-medium shadow-xs" : "px-2.5 py-1 rounded text-stone-600 hover:text-olivo-950 font-medium"}>{c === "todos" ? `Todos (${data.items.length})` : c}</button>)}
                </div>
              </div>
              <div className="relative w-full h-[470px] mt-4 bg-marfil-50 rounded-lg border border-arena-200 overflow-hidden select-none">
                <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
                  <div className="border-r border-b border-dashed border-arena-400/80 bg-arena-200/15 p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-arena-300/40 text-stone-800 text-[11px] font-semibold tracking-wide uppercase font-label"><span className="material-symbols-outlined text-sm text-dorado-600">help</span>INCÓGNITAS</span><span className="text-[10px] text-stone-500 italic">Alto margen / Baja venta</span></div>
                    <div className="text-[11px] text-stone-600/80 bg-white/70 backdrop-blur-xs p-2 rounded border border-arena-200 w-fit"><strong className="text-stone-800">Estrategia: </strong>Impulsar venta sugestiva en meseros y optimizar diseño en carta.</div>
                  </div>
                  <div className="border-b border-dashed border-arena-400/80 bg-dorado-200/20 p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-dorado-300 text-olivo-950 text-[11px] font-bold tracking-wide uppercase font-label shadow-xs"><span className="material-symbols-outlined text-sm text-olivo-900" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>ESTRELLAS</span><span className="text-[10px] text-amber-900 font-medium italic">Alto margen / Alta venta</span></div>
                    <div className="text-[11px] text-stone-700 bg-white/80 backdrop-blur-xs p-2 rounded border border-dorado-300 w-fit self-end text-right"><strong className="text-olivo-950">Estrategia: </strong>Blindar receta, monitorear porciones y no subir precio.</div>
                  </div>
                  <div className="border-r border-dashed border-arena-400/80 bg-terracota-100/30 p-3 flex flex-col justify-between">
                    <div className="text-[11px] text-stone-600 bg-white/70 backdrop-blur-xs p-2 rounded border border-terracota-300/60 w-fit"><strong className="text-terracota-700">Estrategia: </strong>Retirar de carta o sustituir insumos de baja rotación.</div>
                    <div className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-terracota-100 text-terracota-700 text-[11px] font-bold tracking-wide uppercase font-label"><span className="material-symbols-outlined text-sm text-terracota-600">pest_control</span>PERROS</span><span className="text-[10px] text-terracota-700 italic">Bajo margen / Baja venta</span></div>
                  </div>
                  <div className="bg-emerald-950/5 p-3 flex flex-col justify-between">
                    <div className="text-[11px] text-stone-700 bg-white/70 backdrop-blur-xs p-2 rounded border border-emerald-900/20 w-fit self-end text-right"><strong className="text-olivo-900">Estrategia: </strong>Aumento selectivo de precio o renegociar costo de insumos.</div>
                    <div className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-olivo-900 text-dorado-300 text-[11px] font-semibold tracking-wide uppercase font-label"><span className="material-symbols-outlined text-sm text-dorado-400">inventory_2</span>VACAS</span><span className="text-[10px] text-stone-600 italic">Bajo margen / Alta venta</span></div>
                  </div>
                </div>
                <div className="absolute top-0 bottom-0 left-1/2 w-px bg-arena-400/90 pointer-events-none" />
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-white/95 px-2 py-0.5 rounded text-[10px] font-semibold text-stone-600 border border-arena-300 shadow-xs">Corte popularidad: {data.popThreshold} uds</div>
                <div className="absolute left-0 right-0 top-1/2 h-px bg-arena-400/90 pointer-events-none" />
                <div className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/95 px-2 py-0.5 rounded text-[10px] font-semibold text-stone-600 border border-arena-300 shadow-xs">Corte margen: {mxn(data.marginThreshold, true)} MXN</div>
                {items.map((i) => {
                  const big = labeled.has(i.productId);
                  return (
                    <div key={i.productId} onMouseEnter={() => setFocus(i.productId)} onMouseLeave={() => setFocus(null)} style={pos(i)} className={`absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer ${focus === i.productId ? "z-30" : big ? "z-20" : "z-10"}`}>
                      <div className={`${big ? "w-6 h-6" : "w-4 h-4"} rounded-full border-2 flex items-center justify-center shadow-md group-hover:scale-125 transition-transform ${DOT[i.class]}`}>{big && <span className="w-2 h-2 rounded-full bg-white/80" />}</div>
                      {big && <span className="absolute top-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold text-olivo-950 bg-white/95 px-2 py-0.5 rounded border border-arena-300 shadow-xs">{i.name}</span>}
                      <div className="absolute bottom-9 left-1/2 -translate-x-1/2 w-64 p-3 bg-olivo-950 text-marfil-100 rounded-lg shadow-2xl border border-dorado-400/70 hidden group-hover:flex flex-col gap-2 pointer-events-none z-30">
                        <div className="border-b border-white/10 pb-2"><h4 className="font-headline font-bold text-xs text-dorado-300 leading-tight">{i.name}</h4><span className="text-[10px] text-emerald-300 font-label">{LABEL[i.class].slice(0, -1)} · {i.category}</span></div>
                        <div className="grid grid-cols-2 gap-1 text-[11px]">
                          <span className="text-stone-400">P.V.P.: <strong className="text-white">{mxn(i.price, true)}</strong></span>
                          <span className="text-stone-400">Costo: <strong className="text-white">{i.unitCost === null ? "Sin receta" : `${mxn(i.unitCost, true)} (${i.costPct}%)`}</strong></span>
                          <span className="text-stone-400">Margen Unit.: <strong className="text-dorado-300">{mxn(i.margin, true)}</strong></span>
                          <span className="text-stone-400">Ventas: <strong className="text-emerald-300">{i.units} uds</strong></span>
                        </div>
                        <div className="text-[10px] bg-dorado-900/40 p-1.5 rounded border border-dorado-500/30 text-dorado-200">Contribuye con {mxn(i.contribution)} MXN al beneficio bruto del periodo.</div>
                      </div>
                    </div>
                  );
                })}
                {!items.length && <div className="absolute inset-0 flex items-center justify-center text-xs text-stone-500">Sin ventas cobradas en el periodo.</div>}
              </div>
              <div className="flex items-center justify-between text-xs text-stone-500 mt-3 pt-3 border-t border-arena-200">
                <div className="flex items-center gap-4">{(["estrella", "vaca", "incognita", "perro"] as Cls[]).map((c) => <span key={c} className="flex items-center gap-1.5"><span className={`w-3 h-3 rounded-full ${DOT[c].split(" ")[0]}`} />{LABEL[c]} ({count(c)})</span>)}</div>
                <span className="text-[11px] text-stone-400 font-label">Eje X: Popularidad | Eje Y: Margen MXN</span>
              </div>
            </div>

            <div className="lg:col-span-4 bg-white p-5 rounded-xl border border-arena-300/80 shadow-sm flex flex-col h-[578px]">
              <div className="flex items-center justify-between pb-3 border-b border-arena-200">
                <div><h3 className="font-headline font-bold text-base text-olivo-950">Acciones Ejecutivas</h3><p className="text-xs text-stone-500">Dictamen prioritario para dirección</p></div>
                <span className="px-2 py-0.5 rounded-full bg-dorado-200 text-dorado-600 font-semibold text-xs border border-dorado-300">{advice.length} sugerencias</span>
              </div>
              <div className="flex items-center gap-1 mt-3 pb-2 border-b border-arena-100 overflow-x-auto text-[11px]">
                {(["prioritarias", "estrella", "vaca", "incognita", "perro"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={tab === t ? "px-2.5 py-1 rounded bg-olivo-900 text-dorado-300 font-medium" : "px-2 py-1 rounded text-stone-600 hover:bg-marfil-200"}>{t === "prioritarias" ? "Prioritarias" : LABEL[t]}</button>)}
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar mt-3 space-y-3 pr-1">
                {advice.map((i) => {
                  const c = CARD[i.class];
                  const top = byContribution[0]?.productId === i.productId;
                  return (
                    <div key={i.productId} onMouseEnter={() => setFocus(i.productId)} onMouseLeave={() => setFocus(null)} className={`p-3 rounded-lg border hover:shadow-xs transition-shadow ${c.box}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${c.dot}`} /><h4 className={`font-headline font-semibold text-sm ${c.title}`}>{i.name}</h4></div>
                          <span className="text-[11px] text-stone-500">{i.category} · {i.units} ventas{top ? " (Top 1)" : ""}</span>
                        </div>
                        <span className="text-xs font-bold text-olivo-950 font-mono">{i.margin >= 0 ? "+" : ""}{mxn(i.margin, true)} mgn</span>
                      </div>
                      <div className={`mt-2 text-xs bg-white p-2 rounded border text-stone-700 ${c.note.split(" ")[0]}`}><span className={`font-semibold ${c.note.split(" ")[1]}`}>{i.advice.action}: </span>{i.advice.detail}</div>
                      <div className="mt-2.5 flex items-center justify-between">
                        <span className="text-[10px] text-stone-500">{i.advice.impact ? `Impacto: +${mxn(i.advice.impact)} MXN en ${days} días` : `PVP: ${mxn(i.price)} | Costo: ${i.costPct ?? "—"}%`}</span>
                        {(i.advice.action === "Auditar receta" || i.advice.action === "Capturar receta") && <button onClick={() => nav("/recetas")} className="text-xs font-medium text-olivo-900 hover:text-dorado-500 flex items-center gap-1">{i.advice.action}<span className="material-symbols-outlined text-sm">arrow_forward</span></button>}
                        {i.advice.action === "Subir precio" && <button onClick={() => nav("/menu")} className="text-xs font-semibold px-2 py-0.5 rounded bg-olivo-900 text-dorado-300 hover:bg-olivo-800">Ajustar en Menú</button>}
                        {i.advice.action === "Impulsar venta" && <button onClick={() => nav("/promociones")} className="text-xs font-medium text-olivo-900 hover:text-dorado-500 flex items-center gap-1">Crear promoción<span className="material-symbols-outlined text-sm">local_offer</span></button>}
                      </div>
                    </div>
                  );
                })}
                {!advice.length && <p className="text-xs text-stone-500 italic">Sin sugerencias en esta vista.</p>}
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
