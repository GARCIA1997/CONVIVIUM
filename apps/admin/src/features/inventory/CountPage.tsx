/* Diseño: design/stitch/admin-conteo-fisico.html (Stitch). Marcado y clases originales; datos reales. E7-09, E7-11. */
import { client } from "@convivium/app-shell";
import { useCallback, useEffect, useMemo, useState } from "react";
import { InventoryApi, type Ingredient, type InventoryCount, type Warehouse } from "./api";

const money = (c: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(c / 100);
const fmt = (n: number, d = 1) => new Intl.NumberFormat("es-MX", { maximumFractionDigits: d }).format(n);
const unitName = (i: Ingredient) => (i.purchaseUnit.toLowerCase().startsWith("botella") ? "botellas" : i.purchaseUnit.split(" ")[0]!.toLowerCase());
type Entry = { closed: number; open: number };
type Filter = "todos" | "pendientes" | "diferencia" | "conformes";

export function CountPage() {
  const [whs, setWhs] = useState<Warehouse[]>([]);
  const [wh, setWh] = useState<string | null>(null);
  const [items, setItems] = useState<Ingredient[]>([]);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [active, setActive] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("todos");
  const [q, setQ] = useState("");
  const [result, setResult] = useState<InventoryCount | null>(null);
  const [pending, setPending] = useState<InventoryCount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const session = client.session!;
  const canApprove = client.can("inventario.aprobar_ajuste");

  useEffect(() => { InventoryApi.warehouses().then((w) => { setWhs(w); setWh((x) => x ?? w.find((a) => a.name === "Barra")?.id ?? w[0]?.id ?? null); }); }, []);
  const load = useCallback(async () => {
    if (!wh) return;
    const list = (await InventoryApi.ingredients(wh)).filter((i) => wh in i.stockByWarehouse);
    setItems(list);
    setActive((a) => a ?? list[0]?.id ?? null);
    if (canApprove) setPending(await InventoryApi.counts("pendiente_aprobacion"));
  }, [wh, canApprove]);
  useEffect(() => { setEntries({}); setActive(null); setResult(null); load(); }, [load]);

  const counted = (i: Ingredient) => { const e = entries[i.id]; return e ? (e.closed + e.open) * (i.conversion || 1) : null; };
  const theo = (i: Ingredient) => i.stockByWarehouse[wh ?? ""] ?? 0;
  const diffOf = (i: Ingredient) => { const c = counted(i); return c === null ? null : c - theo(i); };
  const done = items.filter((i) => entries[i.id]).length;
  const diffs = items.filter((i) => { const d = diffOf(i); return d !== null && Math.abs(d) > 0.001; });
  const shown = useMemo(() => items
    .filter((i) => filter === "todos" || (filter === "pendientes" ? !entries[i.id] : filter === "diferencia" ? diffs.includes(i) : entries[i.id] && !diffs.includes(i)))
    .filter((i) => i.name.toLowerCase().includes(q.toLowerCase())), [items, filter, entries, diffs, q]);
  const cur = items.find((i) => i.id === active);
  const setEntry = (id: string, e: Partial<Entry>) => setEntries((x) => ({ ...x, [id]: { closed: x[id]?.closed ?? 0, open: x[id]?.open ?? 0, ...e } }));
  const totalDiffValue = diffs.reduce((s, i) => s + (diffOf(i) ?? 0) * i.avgCost, 0);
  const whName = whs.find((w) => w.id === wh)?.name ?? "";

  const submit = async () => {
    setError(null);
    try {
      const r = await InventoryApi.submitCount(wh!, items.filter((i) => entries[i.id]).map((i) => ({ ingredientId: i.id, counted: counted(i)! })));
      setResult(r); setEntries({});
    } catch (e) { setError((e as Error).message); }
  };
  const resolve = (id: string, ok: boolean) => InventoryApi.resolveCount(id, ok).then(load, (e) => setError((e as Error).message));

  return (
    <div className="bg-brand-marfil min-h-screen text-brand-carbon antialiased selection:bg-brand-dorado/30 pb-36 flex-1">
      <div className="max-w-md mx-auto min-h-screen flex flex-col relative shadow-2xl bg-brand-marfil">
        <header className="bg-[#1E2F28] text-[#EAE6DD] flex justify-between items-center w-full px-4 py-3 sticky top-0 z-40 shadow-sm border-b border-[#C9B89F]/20">
          <div>
            <div className="font-headline text-xs uppercase tracking-widest text-[#D4AF7C] font-semibold">CONVIVIUM</div>
            <h1 className="font-headline text-base font-bold text-[#EAE6DD] tracking-tight leading-tight">Conteo físico · Almacén {whName}</h1>
          </div>
          <select value={wh ?? ""} onChange={(e) => setWh(e.target.value)} className="bg-[#FAF8F5]/10 text-[#D4AF7C] border-[#D4AF7C]/30 rounded-lg text-xs py-1.5">
            {whs.map((w) => <option key={w.id} value={w.id} className="text-carbon">{w.name}</option>)}
          </select>
        </header>
        <div className="bg-[#1E2F28] px-4 pb-4 pt-1 text-[#EAE6DD] border-b border-brand-arena/20">
          <div className="flex items-center justify-between text-xs mb-2">
            <div className="flex items-center gap-1.5 font-medium">
              <span className="inline-block w-2 h-2 rounded-full bg-brand-dorado animate-pulse" />
              {done} de {items.length} insumos ({items.length ? Math.round((done / items.length) * 100) : 0}%)
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-brand-dorado/20 text-brand-dorado border border-brand-dorado/40 tracking-wide">En captura</span>
          </div>
          <div className="w-full bg-[#1A1A1A]/60 rounded-full h-1.5 overflow-hidden p-0.5">
            <div className="bg-gradient-to-r from-brand-dorado to-[#E5C396] h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
          </div>
          <div className="flex justify-between items-center mt-2.5 text-[11px] text-[#EAE6DD]/70 font-mono">
            <span>{new Date().toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</span>
            <span className="text-brand-dorado font-sans font-medium flex items-center gap-1"><span className="material-symbols-outlined text-[13px]">person</span>{session.user.name}</span>
          </div>
        </div>

        <main className="flex-1 px-3.5 py-4 space-y-4">
          {error && <p className="text-xs text-brand-terracota font-medium">{error}</p>}
          {result && (
            <div className="bg-white rounded-xl border border-brand-arena p-4 text-xs space-y-1">
              <p className="font-bold text-brand-olivo">Conteo enviado · pendiente de aprobación del gerente</p>
              <p>Diferencia valorizada: <strong className={result.totalDiffValue < 0 ? "text-brand-terracota" : "text-brand-olivo"}>{money(result.totalDiffValue)}</strong></p>
            </div>
          )}

          {canApprove && pending.length > 0 && (
            <section className="bg-white rounded-xl border-2 border-brand-dorado/60 p-3.5 space-y-2.5">
              <h3 className="font-headline text-xs font-bold uppercase tracking-wider text-brand-olivo">Conteos por aprobar ({pending.length})</h3>
              {pending.map((c) => (
                <div key={c.id} className="p-2.5 rounded-lg bg-brand-marfil border border-brand-arena/40 text-xs">
                  <div className="flex justify-between"><span>{whs.find((w) => w.id === c.warehouseId)?.name} · {c.lines.length} insumos</span><strong className={c.totalDiffValue < 0 ? "text-brand-terracota" : "text-brand-olivo"}>{money(c.totalDiffValue)}</strong></div>
                  <div className="text-[11px] text-brand-carbon/60 mt-1">{c.lines.filter((l) => l.diff !== 0).map((l) => `${l.name}: ${fmt(l.diff)} ${l.unit}`).join(" · ") || "Sin diferencias"}</div>
                  {c.countedBy === session.user.id ? (
                    <p className="text-[11px] text-brand-carbon/50 mt-2">Tu conteo: lo aprueba otro gerente.</p>
                  ) : (
                    <div className="flex justify-end gap-2 mt-2">
                      <button onClick={() => resolve(c.id, false)} className="px-3 py-1 rounded-md border border-brand-terracota text-brand-terracota font-semibold bg-white">Rechazar</button>
                      <button onClick={() => resolve(c.id, true)} className="px-3 py-1 rounded-md bg-brand-olivo text-brand-marfil font-semibold">Aprobar ajuste</button>
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}

          <section className="space-y-2.5">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-brand-carbon/40 text-lg">search</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar insumo" className="w-full pl-9 pr-3 py-2 text-sm bg-white rounded-lg border border-brand-arena/60 focus:border-brand-olivo focus:ring-1 focus:ring-brand-olivo outline-none text-brand-carbon" />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              {([["todos", "Todos", items.length], ["pendientes", "Pendientes", items.length - done], ["diferencia", "Con diferencia", diffs.length], ["conformes", "Conformes", done - diffs.length]] as const).map(([k, l, n]) => (
                <button key={k} onClick={() => setFilter(k)} type="button"
                  className={filter === k ? "px-3 py-1.5 rounded-full font-medium whitespace-nowrap bg-brand-olivo text-brand-marfil shadow-sm border border-brand-olivo flex items-center gap-1.5"
                    : k === "diferencia" ? "px-3 py-1.5 rounded-full font-medium whitespace-nowrap bg-brand-terracotaBg text-brand-terracota border border-brand-terracota/30 flex items-center gap-1.5"
                    : k === "conformes" ? "px-3 py-1.5 rounded-full font-medium whitespace-nowrap bg-white text-brand-esmeralda border border-brand-esmeralda/30 flex items-center gap-1.5"
                    : "px-3 py-1.5 rounded-full font-medium whitespace-nowrap bg-white text-brand-carbon/80 border border-brand-arena/70 hover:border-brand-olivo flex items-center gap-1.5"}>
                  {l}<span className="px-1.5 rounded-full text-[10px] font-bold bg-black/10">{n}</span>
                </button>
              ))}
            </div>
          </section>

          {cur && <ActiveCard i={cur} entry={entries[cur.id]} theo={theo(cur)} diff={diffOf(cur)} onChange={(e) => setEntry(cur.id, e)} />}

          <section className="space-y-2 pt-1">
            <h3 className="font-headline text-xs font-bold uppercase tracking-wider text-brand-carbon/60 px-1">Insumos en {whName} ({shown.length})</h3>
            <div className="space-y-2">
              {shown.filter((i) => i.id !== active).map((i) => {
                const d = diffOf(i);
                return (
                  <button key={i.id} onClick={() => setActive(i.id)} className="w-full text-left bg-white p-3 rounded-lg border border-brand-arena/40 shadow-xs flex items-center justify-between active:bg-brand-marfil transition-colors">
                    <div className="space-y-0.5 pr-2">
                      <h4 className="font-medium text-sm text-brand-carbon">{i.name}</h4>
                      <div className="text-xs text-brand-carbon/70">Teórico: {fmt(theo(i) / (i.conversion || 1), 2)} {unitName(i)}</div>
                    </div>
                    {d === null ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-marfilDark text-brand-carbon/60">Pendiente</span>
                    ) : Math.abs(d) < 0.001 ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-esmeraldaBg text-brand-esmeralda">Conforme</span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-terracotaBg text-brand-terracota">{fmt(d / (i.conversion || 1), 2)} {unitName(i)}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        </main>

        <footer className="fixed bottom-0 inset-x-0 max-w-md mx-auto bg-white border-t border-brand-arena/60 p-3.5 space-y-2 z-40">
          <div className="flex justify-between text-xs"><span className="text-brand-carbon/70">Diferencia valorizada</span><strong className={totalDiffValue < 0 ? "text-brand-terracota" : "text-brand-olivo"}>{money(totalDiffValue)}</strong></div>
          <button disabled={done === 0} onClick={submit} className="w-full py-3 rounded-lg bg-brand-olivo text-brand-marfil font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            <span className="material-symbols-outlined text-brand-dorado">fact_check</span>Enviar conteo ({done} insumos)
          </button>
        </footer>
      </div>
    </div>
  );
}

function ActiveCard({ i, entry, theo, diff, onChange }: { i: Ingredient; entry?: Entry; theo: number; diff: number | null; onChange: (e: Partial<Entry>) => void }) {
  const closed = entry?.closed ?? 0;
  const open = entry?.open ?? 0;
  const conv = i.conversion || 1;
  const total = closed + open;
  const theoUnits = theo / conv;
  const dUnits = diff === null ? null : diff / conv;
  return (
    <section className="bg-white rounded-xl border-2 border-brand-dorado/60 shadow-md p-4 relative overflow-hidden transition-all">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-olivo via-brand-dorado to-brand-olivo" />
      <div className="flex items-start justify-between gap-2 pt-1 pb-3 border-b border-brand-arena/20">
        <div className="space-y-0.5">
          {i.critical && <span className="px-2 py-0.5 bg-brand-olivo/10 text-brand-olivo text-[10px] font-bold rounded tracking-wider uppercase">Insumo crítico</span>}
          <h2 className="font-display text-xl font-bold text-brand-carbon tracking-tight leading-snug">{i.name}</h2>
          <p className="text-xs text-brand-carbon/60 font-medium pt-0.5">1 {i.purchaseUnit} = {fmt(conv)} {i.useUnit}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-12 gap-3.5 items-stretch">
        <div className="col-span-7 bg-brand-marfil rounded-lg p-3 border border-brand-arena/40 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-brand-olivo uppercase tracking-wider flex items-center gap-1"><span className="material-symbols-outlined text-sm text-brand-olivo">lock</span>Cerradas</span>
          </div>
          <div className="flex items-center justify-between gap-1 py-1">
            <button onClick={() => onChange({ closed: Math.max(0, closed - 1) })} className="w-10 h-10 rounded-lg bg-white border border-brand-arena/60 text-brand-carbon font-bold text-lg flex items-center justify-center active:scale-90 active:bg-brand-marfil transition-transform" type="button">−</button>
            <div className="text-center px-2">
              <input value={closed} onChange={(e) => onChange({ closed: Math.max(0, Number(e.target.value) || 0) })} inputMode="numeric" className="w-14 text-center font-display text-2xl font-bold text-brand-carbon tracking-tight bg-transparent border-0 p-0 focus:ring-0" />
              <span className="block text-[10px] text-brand-carbon/60 uppercase font-semibold">{unitName(i)}</span>
            </div>
            <button onClick={() => onChange({ closed: closed + 1 })} className="w-10 h-10 rounded-lg bg-brand-olivo text-brand-marfil font-bold text-lg flex items-center justify-center active:scale-90 transition-transform shadow-xs" type="button">+</button>
          </div>
        </div>
        <div className="col-span-5 bg-brand-marfil rounded-lg p-3 border border-brand-arena/40 flex flex-col justify-between items-center text-center">
          <div className="w-full flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-brand-olivo uppercase tracking-wider flex items-center gap-1"><span className="material-symbols-outlined text-sm text-brand-dorado">liquor</span>Abierta</span>
            <span className="text-[10px] font-semibold text-brand-dorado">{Math.round(open * 100)}%</span>
          </div>
          <div className="py-1 flex items-center justify-center gap-2">
            <div className="flex flex-col items-center">
              <div className="bottle-neck" />
              <div className="bottle-glass w-10 h-16"><div className="liquid-fill" style={{ height: `${open * 100}%` }} /></div>
            </div>
            <div className="text-left leading-tight">
              <div className="font-display text-lg font-bold text-brand-carbon">{fmt(open, 2)}</div>
              <span className="text-[9px] text-brand-carbon/60 uppercase font-medium">({fmt(open * conv)} {i.useUnit})</span>
            </div>
          </div>
          <div className="w-full flex justify-between gap-1 mt-1">
            {[0.25, 0.5, 0.75].map((f) => (
              <button key={f} onClick={() => onChange({ open: f })} className={open === f ? "text-[10px] font-bold px-1.5 py-0.5 bg-brand-olivo text-brand-marfil rounded shadow-xs" : "text-[10px] font-medium px-1.5 py-0.5 bg-white border border-brand-arena/40 rounded hover:bg-brand-dorado/20"} type="button">
                {f === 0.25 ? "¼" : f === 0.5 ? "½" : "¾"}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 bg-brand-marfilDark/60 p-2.5 rounded-lg border border-brand-arena/30">
        <div className="flex justify-between text-[11px] font-medium text-brand-carbon/70 mb-1">
          <span>Ajuste fino de unidad en uso:</span>
          <span className="font-mono text-brand-olivo font-bold">{fmt(open, 2)} ({Math.round(open * 100)}%)</span>
        </div>
        <input value={open} onChange={(e) => onChange({ open: Number(e.target.value) })} className="w-full h-2 bg-brand-arena/50 rounded-lg cursor-pointer" max={1} min={0} step={0.05} type="range" />
        <ExactRemaining i={i} open={open} onChange={(v) => onChange({ open: v })} />
      </div>
      <div className="mt-3.5 pt-3 border-t border-brand-arena/30 space-y-2.5">
        <div className="flex items-center justify-between bg-brand-marfil p-2.5 rounded-lg border border-brand-arena/30">
          <div>
            <span className="text-[10px] text-brand-carbon/50 uppercase tracking-wider font-semibold block">Total Físico Contado</span>
            <div className="flex items-baseline gap-1"><span className="font-display text-xl font-bold text-brand-olivo">{fmt(total, 2)}</span><span className="text-xs text-brand-carbon/60 font-medium">{unitName(i)}</span></div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-brand-carbon/50 uppercase tracking-wider font-semibold block">Teórico en Sistema</span>
            <div className="flex items-baseline justify-end gap-1"><span className="font-display text-xl font-bold text-brand-carbon">{fmt(theoUnits, 2)}</span><span className="text-xs text-brand-carbon/60 font-medium">{unitName(i)}</span></div>
          </div>
        </div>
        {dUnits !== null && Math.abs(dUnits) > 0.0001 && (
          <div className="bg-brand-terracotaBg border-l-4 border-brand-terracota p-3 rounded-r-lg space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-brand-terracota flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">warning</span>
                Diferencia: {fmt(dUnits, 2)} {unitName(i)} ({money((diff ?? 0) * i.avgCost)} MXN)
              </span>
              <span className="px-1.5 py-0.5 bg-brand-terracota text-white text-[9px] font-bold uppercase rounded">{dUnits < 0 ? "Faltante" : "Sobrante"}</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

const ML_PER_OZ = 29.5735;

/**
 * E7-11 · Lo que queda en la botella abierta, exacto en la unidad de uso (o en oz si es ml).
 * El deslizador va de 5 % en 5 % (37.5 ml en una de 750): aquí se captura lo medido o pesado.
 */
function ExactRemaining({ i, open, onChange }: { i: Ingredient; open: number; onChange: (fraction: number) => void }) {
  const conv = i.conversion || 1;
  const [oz, setOz] = useState(false);
  const factor = oz ? ML_PER_OZ : 1;
  const shown = Math.round(((open * conv) / factor) * 10) / 10;
  const [text, setText] = useState<string | null>(null); // mientras se escribe, no se reformatea
  const max = Math.round((conv / factor) * 10) / 10;
  const commit = (raw: string) => {
    const v = Number(raw.replace(",", "."));
    if (!Number.isFinite(v)) return;
    onChange(Math.min(1, Math.max(0, (v * factor) / conv)));
  };
  return (
    <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-medium text-brand-carbon/70">
      <span>Queda en la abierta:</span>
      <span className="flex items-center gap-1.5">
        <input
          value={text ?? String(shown)}
          onChange={(e) => { setText(e.target.value); commit(e.target.value); }}
          onBlur={() => setText(null)}
          inputMode="decimal"
          aria-label={`Cantidad en la botella abierta (${oz ? "oz" : i.useUnit})`}
          className="w-20 text-right font-mono bg-white border border-brand-arena/60 rounded px-2 py-1 text-brand-carbon"
        />
        {i.useUnit === "ml" ? (
          <span className="flex rounded border border-brand-arena/60 overflow-hidden">
            {([false, true] as const).map((v) => (
              <button key={String(v)} type="button" onClick={() => { setOz(v); setText(null); }} className={oz === v ? "px-1.5 py-0.5 bg-brand-olivo text-brand-marfil font-bold" : "px-1.5 py-0.5 bg-white"}>{v ? "oz" : "ml"}</button>
            ))}
          </span>
        ) : (
          <span>{i.useUnit}</span>
        )}
        <span className="text-brand-carbon/50">/ {fmt(max)}</span>
      </span>
    </div>
  );
}
