/* Diseño: design/stitch/admin-receta.html (Stitch). Marcado y clases originales; datos reales. E7-03, E7-04, E7-05, E7-11. */
import { client } from "@convivium/app-shell";
import { useCallback, useEffect, useState } from "react";
import { InventoryApi, type Ingredient, type RecipeDetail, type RecipeSummary, type Warehouse } from "./api";

/** Objetivo de % de costo por tipo de producto (barra / cocina). */
const TARGET = { barra: 22, cocina: 32 } as const;
const money = (c: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(c / 100);
const fmt = (n: number) => new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(n);

type EditLine = { ingredientId: string | null; subRecipeId: string | null; quantity: string; wastePct: string };

export function RecipesPage() {
  const [list, setList] = useState<RecipeSummary[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [r, setR] = useState<RecipeDetail | null>(null);
  const [ings, setIngs] = useState<Ingredient[]>([]);
  const [whs, setWhs] = useState<Warehouse[]>([]);
  const [kind, setKind] = useState<"barra" | "cocina">("cocina");
  const [edit, setEdit] = useState<{ lines: EditLine[]; steps: string[] } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    InventoryApi.recipes().then((l) => { setList(l); setSel((s) => s ?? l.find((x) => !x.isSubRecipe)?.id ?? null); });
    InventoryApi.ingredients().then(setIngs);
    InventoryApi.warehouses().then(setWhs);
  }, []);
  const load = useCallback(async () => {
    if (!sel) return;
    const d = await InventoryApi.recipe(sel);
    setR(d);
    setEdit(null);
    if (d.productId) {
      const [menu, stations] = await Promise.all([client.catalog.menu(), client.catalog.stations()]);
      const p = menu.products.find((x) => x.id === d.productId);
      setKind(stations.find((s) => s.id === p?.stationIds[0])?.kind === "barra" ? "barra" : "cocina");
    }
  }, [sel]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!r || !edit) return;
    await InventoryApi.saveRecipe({
      name: r.name, productId: r.productId, isSubRecipe: r.isSubRecipe, yieldQty: r.yieldQty, steps: edit.steps.filter((s) => s.trim()),
      lines: edit.lines.filter((l) => (l.ingredientId || l.subRecipeId) && Number(l.quantity) > 0).map((l) => ({ ingredientId: l.ingredientId, subRecipeId: l.subRecipeId, quantity: Number(l.quantity), wastePct: Number(l.wastePct) || 0 })),
    }, r.id);
    setMsg("Receta guardada; costo teórico recalculado.");
    load();
    InventoryApi.recipes().then(setList);
  };
  const produce = async () => {
    if (!r) return;
    const wh = whs.find((w) => w.name === "Cocina") ?? whs[0];
    const out = await InventoryApi.produce(r.id, 1, wh!.id);
    setMsg(`Producción registrada: +${fmt(out.produced)} ${out.unit} en ${wh!.name}.`);
  };

  const target = TARGET[kind];
  const pct = r?.product?.costPct ?? 0;
  const over = r?.product ? pct > target : false;
  const idealCost = r?.product ? Math.round((r.product.netPrice * target) / 100) : 0;
  const contribution = r?.product ? r.product.netPrice - r.cost : 0;
  const suggestedPrice = r?.product ? Math.round((r.cost / (target / 100)) * (r.product.price / r.product.netPrice)) : 0;
  const totalQty = r?.lines.reduce((s, l) => s + l.quantity, 0) ?? 0;

  return (
    <main className="flex-1 pt-6 pb-16 px-8 max-w-7xl w-full mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <nav className="flex items-center gap-2 text-xs text-neutral-500 font-medium">
          <span>Inventario</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span>Fichas Técnicas &amp; Recetas</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <select value={sel ?? ""} onChange={(e) => setSel(e.target.value)} className="text-neutral-900 font-semibold bg-brand-arena/30 px-2 py-0.5 rounded border-0 text-xs focus:ring-brand-dorado">
            <optgroup label="Productos">{list.filter((x) => !x.isSubRecipe && !x.modifierId).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>
            <optgroup label="Subrecetas">{list.filter((x) => x.isSubRecipe).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>
          </select>
        </nav>
        <div className="flex items-center gap-2">
          {r?.isSubRecipe && (
            <button onClick={produce} className="px-3 py-1.5 rounded-lg border border-brand-arena bg-white hover:bg-stone-50 text-neutral-700 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm">
              <span className="material-symbols-outlined text-base text-neutral-500">science</span>Registrar producción (1 lote)
            </button>
          )}
          {edit ? (
            <>
              <button onClick={() => setEdit(null)} className="px-3 py-1.5 rounded-lg border border-brand-arena bg-white text-neutral-700 text-xs font-medium">Cancelar</button>
              <button onClick={save} className="px-3.5 py-1.5 rounded-lg bg-brand-olivo text-brand-dorado font-semibold text-xs flex items-center gap-1.5 shadow"><span className="material-symbols-outlined text-base">save</span>Guardar receta</button>
            </>
          ) : (
            <button disabled={!r} onClick={() => r && setEdit({ lines: r.lines.map((l) => ({ ingredientId: l.ingredientId, subRecipeId: l.subRecipeId, quantity: String(l.quantity), wastePct: String(l.wastePct) })), steps: [...r.steps] })}
              className="px-3.5 py-1.5 rounded-lg bg-brand-dorado hover:bg-[#c49f69] text-brand-olivo-dark font-semibold text-xs flex items-center gap-1.5 shadow transition-colors">
              <span className="material-symbols-outlined text-base">edit</span>Editar Receta
            </button>
          )}
        </div>
      </div>
      {msg && <div className="mb-4 text-xs font-medium px-3 py-2 rounded-lg bg-white border border-brand-arena text-brand-olivo">{msg}</div>}
      {!r ? null : (
        <>
          <section className="bg-white rounded-lg border border-brand-arena p-6 shadow-sm mb-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-4 border-b border-brand-arena/60">
              <div>
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <h1 className="font-serif-title text-3xl font-bold text-brand-carbon tracking-tight">{r.name}</h1>
                  <span className="bg-stone-100 text-neutral-800 border border-stone-300 text-xs font-semibold px-2.5 py-0.5 rounded-full">{r.isSubRecipe ? "Subreceta / Preparación" : kind === "barra" ? "Barra & Coctelería" : "Cocina"}</span>
                </div>
                <p className="text-xs text-neutral-500">Rendimiento: <span className="font-medium text-neutral-700">{r.isSubRecipe ? `${fmt(r.yieldQty ?? 1)} ml por lote` : "1 porción estándar"}</span></p>
              </div>
              {r.product && (
                <div className="text-right">
                  <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold block">Precio de Venta Carta</span>
                  <span className="font-mono text-2xl font-bold text-neutral-900">{money(r.product.price)} <span className="text-xs font-normal text-neutral-500">MXN</span></span>
                  <span className="text-[10px] text-emerald-700 block font-medium">Impuestos incluidos · Margen Bruto: {fmt(100 - pct)}%</span>
                </div>
              )}
            </div>
          </section>

          {r.product ? (
            <section className="mb-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className={`lg:col-span-2 rounded-lg p-5 shadow-sm relative overflow-hidden flex flex-col justify-between ${over ? "bg-brand-terracota-light border-2 border-brand-terracota" : "bg-emerald-50 border-2 border-emerald-300"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs uppercase tracking-wider font-bold flex items-center gap-1.5 ${over ? "text-brand-terracota" : "text-emerald-800"}`}>
                      <span className="material-symbols-outlined text-base">{over ? "warning" : "verified"}</span>Análisis de Desvío de Costo
                    </span>
                    <span className={`text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${over ? "bg-brand-terracota" : "bg-emerald-700"}`}>{over ? `Excedido +${fmt(pct - target)}%` : "Dentro de objetivo"}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div><span className="text-[11px] text-neutral-600 block">Costo Teórico / Porción</span><span className="font-mono text-2xl font-extrabold text-brand-carbon">{money(r.cost)}</span><span className="text-[10px] text-neutral-500 block">MXN / porción</span></div>
                    <div><span className="text-[11px] text-neutral-600 block">% Costo vs Venta</span><span className={`font-mono text-2xl font-extrabold ${over ? "text-brand-terracota" : "text-emerald-800"}`}>{fmt(pct)}%</span><span className="text-[10px] text-neutral-500 block">Sobre precio neto ({money(r.product.netPrice)})</span></div>
                    <div><span className="text-[11px] text-neutral-600 block">Objetivo {kind === "barra" ? "de Barra" : "de Cocina"}</span><span className="font-mono text-2xl font-bold text-neutral-600">{target}%</span><span className="text-[10px] text-neutral-500 block">Objetivo {money(idealCost)} MXN</span></div>
                  </div>
                  {over && (
                    <div className="bg-white/80 backdrop-blur-sm rounded border border-brand-terracota/30 p-2.5 text-xs text-brand-terracota-dark leading-relaxed">
                      <strong>⚠️ Alerta de Rentabilidad:</strong> supera el objetivo en <strong>+{fmt(pct - target)}% ({money(r.cost - idealCost)} MXN</strong> sobre el costo ideal de {money(idealCost)} MXN). Revisa porciones y mermas o ajusta el precio.
                    </div>
                  )}
                </div>
                <div className="bg-white rounded-lg border border-brand-arena p-5 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-neutral-400 mb-2">
                    <span className="text-xs uppercase font-semibold tracking-wider">Contribución Marginal</span>
                    <span className="material-symbols-outlined text-base text-brand-dorado">payments</span>
                  </div>
                  <span className="font-mono text-2xl font-bold text-emerald-800">{money(contribution)} <span className="text-xs font-normal text-neutral-500">MXN</span></span>
                  <div className="mt-2 text-xs text-neutral-600"><span className="font-semibold text-emerald-700">{fmt(100 - pct)}%</span> margen por unidad vendida.</div>
                  <div className="pt-3 border-t border-brand-arena/60 mt-3 text-[11px] text-neutral-500">Precio sugerido para objetivo {target}%: <strong className="text-neutral-900 font-mono">{money(suggestedPrice)} MXN</strong></div>
                </div>
              </div>
            </section>
          ) : (
            <section className="mb-8 bg-white rounded-lg border border-brand-arena p-5 shadow-sm text-xs text-neutral-600">
              Costo del lote: <strong className="font-mono text-neutral-900">{money(r.cost)}</strong> · Costo por ml: <strong className="font-mono text-neutral-900">{money(r.cost / (r.yieldQty || 1))}</strong>
            </section>
          )}

          <div className="space-y-8">
            <section className="bg-white rounded-lg border border-brand-arena shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-brand-arena/80 bg-brand-marfil-subtle/50">
                <h2 className="font-serif-title text-lg font-bold text-brand-carbon">Composición &amp; Desglose de Insumos</h2>
                <p className="text-xs text-neutral-500">Cálculo con merma técnica y costo de adquisición promedio ponderado (PMP)</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-brand-arena text-neutral-600 font-semibold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Insumo / Materia Prima</th>
                      <th className="py-3 px-3 text-right">Cant. Neta</th>
                      <th className="py-3 px-3 text-center">Merma %</th>
                      <th className="py-3 px-3 text-right">Cant. Bruta</th>
                      <th className="py-3 px-3 text-right">Costo Unit.</th>
                      <th className="py-3 px-3 text-right">Costo Porción</th>
                      <th className="py-3 px-3 text-right">% Costo</th>
                      {edit && <th className="py-3 px-3" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-arena/50 font-mono text-neutral-800">
                    {edit
                      ? edit.lines.map((l, idx) => (
                          <tr key={idx}>
                            <td className="py-2 px-4 font-body" colSpan={1}>
                              <select value={l.subRecipeId ? `sr:${l.subRecipeId}` : l.ingredientId ?? ""} onChange={(e) => {
                                const v = e.target.value;
                                setEdit((x) => x && { ...x, lines: x.lines.map((y, i) => (i === idx ? { ...y, ingredientId: v.startsWith("sr:") ? null : v, subRecipeId: v.startsWith("sr:") ? v.slice(3) : null } : y)) });
                              }} className="w-full text-xs rounded border-brand-arena focus:ring-brand-dorado">
                                <option value="">Selecciona…</option>
                                <optgroup label="Insumos">{ings.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.useUnit})</option>)}</optgroup>
                                <optgroup label="Subrecetas">{list.filter((x) => x.isSubRecipe && x.id !== r.id).map((x) => <option key={x.id} value={`sr:${x.id}`}>{x.name} (ml)</option>)}</optgroup>
                              </select>
                            </td>
                            <td className="py-2 px-3 text-right"><input value={l.quantity} onChange={(e) => setEdit((x) => x && { ...x, lines: x.lines.map((y, i) => (i === idx ? { ...y, quantity: e.target.value } : y)) })} className="w-20 text-right text-xs rounded border-brand-arena" inputMode="decimal" /></td>
                            <td className="py-2 px-3 text-center"><input value={l.wastePct} onChange={(e) => setEdit((x) => x && { ...x, lines: x.lines.map((y, i) => (i === idx ? { ...y, wastePct: e.target.value } : y)) })} className="w-16 text-right text-xs rounded border-brand-arena" inputMode="decimal" /></td>
                            <td className="py-2 px-3" colSpan={4} />
                            <td className="py-2 px-3 text-center"><button onClick={() => setEdit((x) => x && { ...x, lines: x.lines.filter((_, i) => i !== idx) })} className="text-neutral-400 hover:text-brand-terracota"><span className="material-symbols-outlined text-base">delete</span></button></td>
                          </tr>
                        ))
                      : r.lines.map((l, idx) => {
                          const crit = ings.find((i) => i.id === l.ingredientId)?.critical;
                          return (
                            <tr key={idx} className="hover:bg-brand-dorado-light/20 transition-colors">
                              <td className="py-3.5 px-4 font-body">
                                <div className="font-medium text-neutral-900 flex items-center gap-2">
                                  {l.name}
                                  {l.subRecipeId && <span className="inline-block bg-brand-dorado-light text-brand-olivo border border-brand-dorado/40 text-[9px] font-sans font-semibold px-1.5 rounded">Subreceta</span>}
                                  {crit && <span className="inline-block mt-0.5 bg-red-50 text-red-700 border border-red-200 text-[9px] font-sans font-semibold px-1.5 rounded">Insumo Crítico</span>}
                                </div>
                              </td>
                              <td className="py-3.5 px-3 text-right font-medium">{fmt(l.quantity)} {l.unit}</td>
                              <td className="py-3.5 px-3 text-center text-amber-700 font-medium">{fmt(l.wastePct)}%</td>
                              <td className="py-3.5 px-3 text-right text-neutral-600">{fmt(l.quantity * (1 + l.wastePct / 100))} {l.unit}</td>
                              <td className="py-3.5 px-3 text-right text-neutral-500">{money(l.unitCost)}/{l.unit}</td>
                              <td className="py-3.5 px-3 text-right font-bold text-neutral-900">{money(l.cost)}</td>
                              <td className="py-3.5 px-3 text-right">{r.cost ? fmt((l.cost / r.cost) * 100) : 0}%</td>
                            </tr>
                          );
                        })}
                  </tbody>
                  {!edit && (
                    <tfoot className="bg-brand-marfil-subtle font-mono text-neutral-900 border-t-2 border-brand-arena font-bold">
                      <tr>
                        <td className="py-3.5 px-4 font-body text-right uppercase tracking-wider text-xs">Totales:</td>
                        <td className="py-3.5 px-3 text-right">{fmt(totalQty)}</td>
                        <td colSpan={3} />
                        <td className="py-3.5 px-3 text-right">{money(r.cost)} MXN</td>
                        <td className="py-3.5 px-3 text-right">100.0%</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
                {edit && (
                  <div className="p-3 border-t border-brand-arena/60">
                    <button onClick={() => setEdit((x) => x && { ...x, lines: [...x.lines, { ingredientId: null, subRecipeId: null, quantity: "", wastePct: "0" }] })} className="text-xs font-semibold text-brand-olivo flex items-center gap-1 bg-white border border-brand-arena px-2.5 py-1 rounded">
                      <span className="material-symbols-outlined text-sm">add</span>Agregar insumo
                    </button>
                  </div>
                )}
              </div>
            </section>

            {r.modifierRecipes.length > 0 && (
              <section className="bg-white rounded-lg border border-brand-arena p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-brand-olivo text-xl">alt_route</span>
                  <h2 className="font-serif-title text-lg font-bold text-brand-carbon">Modificadores de Comanda &amp; Recalculo de Kardex</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {r.modifierRecipes.map((m) => (
                    <div key={m.id} className="border border-brand-arena rounded-lg p-3.5 bg-brand-marfil/30 hover:border-brand-dorado transition-colors">
                      <span className="font-semibold text-xs text-neutral-900 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-brand-dorado" />{m.name}</span>
                      <div className="flex justify-between text-[11px] font-mono border-t border-brand-arena/60 pt-2 mt-2 text-neutral-500">
                        <span>Diferencial de Costo: <strong className="text-brand-carbon">+{money(m.cost)} MXN</strong></span>
                        <span>Nuevo Costo: <strong className="text-brand-carbon">{money(r.cost + m.cost)}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="bg-white rounded-lg border border-brand-arena p-6 shadow-sm">
              <div className="bg-brand-olivo text-brand-dorado rounded-lg px-4 py-3 mb-6 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-2xl text-brand-dorado">touch_app</span>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-100">Visible en Terminal Táctil de {kind === "barra" ? "Barra" : "Cocina"}</h3>
                    <p className="text-[11px] text-stone-300">Guía de apego técnico estandarizado para el equipo de turno.</p>
                  </div>
                </div>
              </div>
              <h3 className="font-serif-title font-bold text-base text-neutral-900 border-b border-brand-arena pb-2 mb-4">Técnica Operativa Paso a Paso</h3>
              {edit ? (
                <div className="space-y-2">
                  {edit.steps.map((s, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-brand-olivo text-brand-dorado text-xs font-bold flex items-center justify-center flex-shrink-0 mt-1">{idx + 1}</span>
                      <textarea value={s} onChange={(e) => setEdit((x) => x && { ...x, steps: x.steps.map((y, i) => (i === idx ? e.target.value : y)) })} rows={2} className="flex-1 text-xs rounded border-brand-arena focus:ring-brand-dorado" />
                    </div>
                  ))}
                  <button onClick={() => setEdit((x) => x && { ...x, steps: [...x.steps, ""] })} className="text-xs font-semibold text-brand-olivo flex items-center gap-1 bg-white border border-brand-arena px-2.5 py-1 rounded"><span className="material-symbols-outlined text-sm">add</span>Agregar paso</button>
                </div>
              ) : (
                <ol className="space-y-3.5 text-xs text-neutral-700">
                  {r.steps.map((s, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-brand-olivo text-brand-dorado text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{idx + 1}</span>
                      <p className="text-neutral-600 mt-0.5 leading-relaxed">{s}</p>
                    </li>
                  ))}
                  {r.steps.length === 0 && <p className="text-neutral-500">Sin procedimiento capturado.</p>}
                </ol>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
