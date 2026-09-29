/* Diseño: design/stitch/admin-inventario-insumos.html (Stitch). Marcado y clases originales; datos reales. E7-01, E7-02, E7-07, E7-08. */
import { client } from "@convivium/app-shell";
import { useCallback, useEffect, useMemo, useState } from "react";
import { InventoryApi, type Ingredient, type Warehouse } from "./api";

const money = (c: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(c / 100);
const fmt = (n: number) => new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(n);
const inPurchase = (i: Ingredient, qty: number) => `${fmt(qty / (i.conversion || 1))} ${i.purchaseUnit.toLowerCase().startsWith("botella") ? "bot" : i.purchaseUnit.split(" ")[0]!.toLowerCase()}`;

type Modal = { kind: "traspaso" | "ajuste" | "merma"; ingredient?: Ingredient } | { kind: "editar"; ingredient?: Ingredient } | null;

export function InventoryPage() {
  const [whs, setWhs] = useState<Warehouse[]>([]);
  const [wh, setWh] = useState<string | null>(null);
  const [items, setItems] = useState<Ingredient[]>([]);
  const [filter, setFilter] = useState<string>("todos");
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { InventoryApi.warehouses().then((w) => { setWhs(w); setWh((x) => x ?? w.find((a) => a.name === "Barra")?.id ?? w[0]?.id ?? null); }); }, []);
  const load = useCallback(() => (wh ? InventoryApi.ingredients(wh).then(setItems) : Promise.resolve()), [wh]);
  useEffect(() => { load(); }, [load]);

  const inWh = items.filter((i) => wh !== null && wh in i.stockByWarehouse);
  const categories = useMemo(() => [...new Set(inWh.map((i) => i.category ?? "Sin categoría"))], [inWh]);
  const shown = inWh
    .filter((i) => (filter === "todos" ? true : filter === "bajo" ? i.belowMin : (i.category ?? "Sin categoría") === filter))
    .filter((i) => i.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(b.belowMin) - Number(a.belowMin) || a.name.localeCompare(b.name));
  const value = inWh.reduce((s, i) => s + i.stock * i.avgCost, 0);
  const below = items.filter((i) => i.belowMin);
  const whName = whs.find((w) => w.id === wh)?.name ?? "";

  const toggleCritical = (i: Ingredient) => InventoryApi.saveIngredient({ ...i, critical: !i.critical }, i.id).then(load);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#EAE6DD]">
      <header className="sticky top-0 z-20 w-full bg-[#EAE6DD]/95 backdrop-blur border-b border-arena-border shadow-none px-8 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-6">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-carbon-soft font-label">
              Inventario <span className="text-arena">/</span> <span className="text-carbon font-semibold">Insumos y Almacenes</span>
            </div>
            <h2 className="font-headline text-lg font-bold tracking-tight text-carbon">Almacén {whName}</h2>
          </div>
          <div className="relative w-72">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-carbon-soft text-lg">search</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar insumo" className="w-full bg-white/70 border border-arena-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-carbon placeholder:text-carbon-soft/60 focus:bg-white focus:outline-none focus:ring-1 focus:ring-olivo focus:border-olivo transition-all" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-marfil border border-arena-border rounded-lg p-1 flex items-center gap-1 shadow-inner">
            {whs.map((w) =>
              w.id === wh ? (
                <button key={w.id} className="px-3 py-1 text-xs font-label rounded bg-white text-olivo font-semibold shadow-sm border border-arena/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-olivo" />{w.name}
                </button>
              ) : (
                <button key={w.id} onClick={() => setWh(w.id)} className="px-3 py-1 text-xs font-label rounded text-carbon-soft hover:text-carbon transition-colors">{w.name}</button>
              ),
            )}
          </div>
          <div className="h-6 w-px bg-arena-border" />
          <div className="flex items-center gap-2">
            <button onClick={() => setModal({ kind: "traspaso" })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-arena-border bg-white/80 hover:bg-white text-carbon font-label text-xs font-medium hover:border-carbon-soft/40 shadow-sm transition-all active:scale-95">
              <span className="material-symbols-outlined text-sm text-olivo">swap_horiz</span>Traspaso entre almacenes
            </button>
            <button onClick={() => setModal({ kind: "ajuste" })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-arena-border bg-white/80 hover:bg-white text-carbon font-label text-xs font-medium hover:border-carbon-soft/40 shadow-sm transition-all active:scale-95">
              <span className="material-symbols-outlined text-sm text-olivo">tune</span>Ajuste / Merma
            </button>
            <button onClick={() => setModal({ kind: "editar" })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-olivo text-dorado font-label text-xs font-medium shadow-sm active:scale-95">
              <span className="material-symbols-outlined text-sm">add</span>Nuevo insumo
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
        {msg && <div className="text-xs font-medium px-3 py-2 rounded-lg bg-white border border-arena-border text-olivo">{msg}</div>}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/80 backdrop-blur border border-arena-border rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-label font-medium uppercase tracking-wider text-carbon-soft">Valor en Almacén {whName}</span>
              <div className="text-2xl font-headline font-bold text-carbon mt-1">{money(value)} <span className="text-xs font-body font-normal text-carbon-soft ml-1">MXN</span></div>
              <p className="text-[11px] text-carbon-soft mt-1">Costo promedio ponderado</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-olivo/10 text-olivo flex items-center justify-center"><span className="material-symbols-outlined text-xl">payments</span></div>
          </div>
          <div className="bg-terracota-soft border border-terracota-border rounded-xl p-4 shadow-sm flex items-center justify-between relative overflow-hidden">
            <div className="absolute -right-2 -bottom-2 opacity-10 text-terracota"><span className="material-symbols-outlined text-7xl font-bold">warning</span></div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-terracota animate-pulse" />
                <span className="text-[11px] font-label font-bold uppercase tracking-wider text-terracota-dark">Bajo Mínimo</span>
              </div>
              <div className="text-2xl font-headline font-bold text-terracota-dark mt-1">{below.length} Insumos</div>
              <p className="text-[11px] text-terracota font-medium mt-1">{below.reduce((s, i) => s + i.affectsProducts, 0)} productos con riesgo</p>
            </div>
            <button onClick={() => setFilter("bajo")} className="relative z-10 px-2.5 py-1 text-xs rounded bg-terracota text-white font-medium hover:bg-terracota-dark transition-colors shadow">Ver</button>
          </div>
          <div className="bg-white/80 backdrop-blur border border-arena-border rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-label font-medium uppercase tracking-wider text-carbon-soft">Insumos Registrados</span>
              <div className="text-2xl font-headline font-bold text-carbon mt-1">{items.length} SKUs</div>
              <p className="text-[11px] text-carbon-soft mt-1">{items.filter((i) => i.critical).length} marcados como críticos</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-arena/20 text-carbon flex items-center justify-center"><span className="material-symbols-outlined text-xl">inventory_2</span></div>
          </div>
        </section>

        <section className="bg-white border border-arena-border rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-arena-border bg-[#FAF9F5] flex flex-wrap items-center gap-2">
            <FilterChip active={filter === "todos"} onClick={() => setFilter("todos")} label="Todos los Insumos" count={inWh.length} />
            <button onClick={() => setFilter("bajo")} className={filter === "bajo" ? "px-3 py-1.5 rounded-lg bg-terracota text-white text-xs font-medium shadow-sm flex items-center gap-1.5" : "px-3 py-1.5 rounded-lg bg-white border border-terracota-border text-terracota-dark text-xs font-medium hover:bg-terracota-soft transition-colors flex items-center gap-1.5"}>
              <span className={`w-1.5 h-1.5 rounded-full ${filter === "bajo" ? "bg-white" : "bg-terracota"}`} />Bajo Mínimo
            </button>
            {categories.map((c) => <FilterChip key={c} active={filter === c} onClick={() => setFilter(c)} label={c} count={inWh.filter((i) => (i.category ?? "Sin categoría") === c).length} />)}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-arena-border bg-[#F5F2EA] text-[11px] font-label font-bold text-carbon-muted uppercase tracking-wider">
                  <th className="py-3 px-4">Insumo</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4">Factor de Conversión</th>
                  <th className="py-3 px-4 w-44">Existencia y Nivel</th>
                  <th className="py-3 px-4">Mín / Máx</th>
                  <th className="py-3 px-4">PMP (Costo Prom.)</th>
                  <th className="py-3 px-4 text-center">Crítico</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-arena-border/70 text-xs">
                {shown.map((i) => {
                  const qty = i.stockByWarehouse[wh ?? ""] ?? 0;
                  const lvl = Math.max(0, Math.min(100, (i.stock / (i.maxStock || 1)) * 100));
                  const low = i.belowMin;
                  return (
                    <tr key={i.id} className={low ? "bg-terracota-soft/60 hover:bg-terracota-soft transition-colors border-l-4 border-l-terracota" : "hover:bg-[#FAF9F5] transition-colors"}>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-carbon text-sm flex items-center gap-1.5">
                          {i.name}
                          {low && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-terracota text-white uppercase tracking-wider">¡Bajo Mínimo!</span>}
                        </div>
                        {i.affectsProducts > 0 && <div className={`text-[11px] mt-0.5 ${low ? "text-terracota font-medium" : "text-carbon-soft"}`}>Afecta {i.affectsProducts} producto{i.affectsProducts > 1 ? "s" : ""}</div>}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={low ? "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#E7D6CE] text-terracota-dark border border-terracota-border" : "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-arena/20 text-carbon border border-arena"}>{i.category ?? "Sin categoría"}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-carbon font-medium">1 {i.purchaseUnit} → {fmt(i.conversion)} {i.useUnit}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-baseline justify-between mb-1">
                          <span className={`font-bold text-sm ${low ? "text-terracota-dark" : "text-olivo"}`}>{inPurchase(i, qty)} <span className="text-xs font-normal text-carbon-soft">({fmt(qty)} {i.useUnit})</span></span>
                          <span className={`text-[10px] font-mono ${low ? "text-terracota font-semibold" : "text-carbon-soft"}`}>{Math.round(lvl)}%</span>
                        </div>
                        <div className={low ? "w-full bg-white rounded-full h-2 overflow-hidden border border-terracota-border" : "w-full bg-arena/30 rounded-full h-2 overflow-hidden"}>
                          <div className={`${low ? "bg-terracota" : "bg-olivo"} h-full rounded-full transition-all duration-300`} style={{ width: `${lvl}%` }} />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        <div className={low ? "text-terracota-dark font-semibold" : "text-carbon font-semibold"}>Min: {inPurchase(i, i.minStock)}</div>
                        <div className="text-carbon-soft text-[10px]">Máx: {inPurchase(i, i.maxStock)}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        <div className="font-semibold text-carbon">{money(i.avgCost * i.conversion)} MXN</div>
                        <div className="text-[10px] text-carbon-soft">por {i.purchaseUnit.toLowerCase()} ({money(i.avgCost)}/{i.useUnit})</div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input checked={i.critical} onChange={() => toggleCritical(i)} className="sr-only peer" type="checkbox" />
                          <div className={`w-8 h-4 ${i.critical ? (low ? "bg-terracota" : "bg-olivo") : "bg-arena/60"} rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all`} />
                        </label>
                        <div className={`text-[9px] uppercase mt-0.5 ${i.critical && low ? "text-terracota font-bold" : "text-carbon-soft"}`}>{i.critical ? (low ? "Bloquea receta" : "Activo") : "No"}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button onClick={() => setModal({ kind: "editar", ingredient: i })} className="p-1 rounded text-olivo hover:bg-olivo/10 transition-colors" title="Editar ficha">
                          <span className="material-symbols-outlined text-lg">edit_note</span>
                        </button>
                        <button onClick={() => setModal({ kind: "merma", ingredient: i })} className="p-1 rounded text-carbon-soft hover:text-carbon hover:bg-black/5" title="Merma / ajuste">
                          <span className="material-symbols-outlined text-lg">tune</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {shown.length === 0 && <p className="p-6 text-xs text-carbon-soft">Sin insumos en esta vista.</p>}
          </div>
        </section>
      </main>

      {modal && modal.kind !== "editar" && wh && (
        <MovementModal kind={modal.kind} ingredients={items} warehouses={whs} fromWarehouse={wh} preset={modal.ingredient}
          onClose={() => setModal(null)} onDone={(t) => { setModal(null); setMsg(t); load(); }} />
      )}
      {modal?.kind === "editar" && (
        <IngredientModal ingredient={modal.ingredient} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />
      )}
    </div>
  );
}

function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return active ? (
    <button className="px-3 py-1.5 rounded-lg bg-olivo text-dorado text-xs font-medium shadow-sm flex items-center gap-1.5">
      {label}<span className="bg-olivo-hover text-[10px] px-1.5 py-0.5 rounded-full text-white">{count}</span>
    </button>
  ) : (
    <button onClick={onClick} className="px-3 py-1.5 rounded-lg bg-white border border-arena-border text-carbon-muted text-xs font-medium hover:border-carbon-soft/50 transition-colors">{label} ({count})</button>
  );
}

/* Ventanas de acción: sin pantalla propia en Stitch; mismos tokens y componentes de la vista de insumos. */
function Shell({ title, icon, onClose, children }: { title: string; icon: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-carbon/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md border border-arena-border shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-olivo px-5 py-4 text-marfil flex items-center gap-2.5">
          <span className="material-symbols-outlined text-dorado">{icon}</span>
          <h3 className="font-headline font-bold text-lg">{title}</h3>
        </div>
        <div className="p-5 space-y-3 text-xs">{children}</div>
      </div>
    </div>
  );
}
const field = "w-full rounded-lg border-arena-border text-xs text-carbon focus:ring-olivo focus:border-olivo";
const label = "block text-[11px] font-label font-bold uppercase tracking-wider text-carbon-muted mb-1";

function MovementModal(props: { kind: "traspaso" | "ajuste" | "merma"; ingredients: Ingredient[]; warehouses: Warehouse[]; fromWarehouse: string; preset?: Ingredient; onClose: () => void; onDone: (msg: string) => void }) {
  const [kind, setKind] = useState(props.kind === "merma" ? "merma" : props.kind);
  const [ingredientId, setIngredientId] = useState(props.preset?.id ?? props.ingredients[0]?.id ?? "");
  const [from, setFrom] = useState(props.fromWarehouse);
  const [to, setTo] = useState(props.warehouses.find((w) => w.id !== props.fromWarehouse)?.id ?? "");
  const [qty, setQty] = useState("");
  const [dir, setDir] = useState<"entrada" | "salida">("salida");
  const [error, setError] = useState<string | null>(null);
  const ing = props.ingredients.find((i) => i.id === ingredientId);
  const submit = () =>
    client
      .request("POST", "/inventory/movements", { type: kind, ingredientId, quantity: Number(qty), warehouseId: from, ...(kind === "traspaso" ? { toWarehouseId: to } : {}), direction: dir })
      .then(() => props.onDone(`${kind === "traspaso" ? "Traspaso" : kind === "merma" ? "Merma" : "Ajuste"} registrado: ${qty} ${ing?.useUnit} de ${ing?.name}`), (e) => setError((e as Error).message));
  return (
    <Shell title={kind === "traspaso" ? "Traspaso entre almacenes" : "Ajuste / Merma"} icon={kind === "traspaso" ? "swap_horiz" : "tune"} onClose={props.onClose}>
      {props.kind !== "traspaso" && (
        <div className="inline-flex p-0.5 rounded-lg bg-marfil border border-arena-border">
          {(["merma", "ajuste"] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)} className={kind === k ? "px-3 py-1 rounded-md bg-olivo text-dorado font-semibold" : "px-3 py-1 rounded-md text-carbon-soft"}>{k === "merma" ? "Merma" : "Ajuste"}</button>
          ))}
        </div>
      )}
      <div><label className={label}>Insumo</label>
        <select className={field} value={ingredientId} onChange={(e) => setIngredientId(e.target.value)}>{props.ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={label}>{kind === "traspaso" ? "Desde" : "Almacén"}</label>
          <select className={field} value={from} onChange={(e) => setFrom(e.target.value)}>{props.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
        </div>
        {kind === "traspaso" ? (
          <div><label className={label}>Hacia</label>
            <select className={field} value={to} onChange={(e) => setTo(e.target.value)}>{props.warehouses.filter((w) => w.id !== from).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
          </div>
        ) : kind === "ajuste" ? (
          <div><label className={label}>Sentido</label>
            <select className={field} value={dir} onChange={(e) => setDir(e.target.value as "entrada" | "salida")}><option value="salida">Salida</option><option value="entrada">Entrada</option></select>
          </div>
        ) : null}
      </div>
      <div><label className={label}>Cantidad ({ing?.useUnit})</label><input className={field} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" /></div>
      {error && <p className="text-terracota font-medium">{error}</p>}
      <button disabled={!Number(qty)} onClick={submit} className="w-full py-3 rounded-lg bg-olivo text-dorado font-semibold text-sm disabled:opacity-50">Registrar</button>
    </Shell>
  );
}

function IngredientModal({ ingredient, onClose, onDone }: { ingredient?: Ingredient; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({
    name: ingredient?.name ?? "", category: ingredient?.category ?? "", purchaseUnit: ingredient?.purchaseUnit ?? "", useUnit: ingredient?.useUnit ?? "g",
    conversion: String(ingredient?.conversion ?? ""), minStock: String(ingredient?.minStock ?? ""), maxStock: String(ingredient?.maxStock ?? ""), critical: ingredient?.critical ?? false,
  });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = () =>
    InventoryApi.saveIngredient({ ...f, category: f.category || null, useUnit: f.useUnit as "g" | "ml" | "pz", conversion: Number(f.conversion), minStock: Number(f.minStock), maxStock: Number(f.maxStock), lotTracking: false }, ingredient?.id)
      .then(onDone, (e) => setError((e as Error).message));
  return (
    <Shell title={ingredient ? `Ficha · ${ingredient.name}` : "Nuevo insumo"} icon="inventory_2" onClose={onClose}>
      <div><label className={label}>Nombre</label><input className={field} value={f.name} onChange={set("name")} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={label}>Categoría</label><input className={field} value={f.category} onChange={set("category")} /></div>
        <div><label className={label}>Unidad de uso</label><select className={field} value={f.useUnit} onChange={set("useUnit")}><option value="g">g</option><option value="ml">ml</option><option value="pz">pz</option></select></div>
        <div><label className={label}>Unidad de compra</label><input className={field} value={f.purchaseUnit} onChange={set("purchaseUnit")} placeholder="Botella 750 ml" /></div>
        <div><label className={label}>Conversión ({f.useUnit} por unidad)</label><input className={field} inputMode="decimal" value={f.conversion} onChange={set("conversion")} /></div>
        <div><label className={label}>Mínimo ({f.useUnit})</label><input className={field} inputMode="decimal" value={f.minStock} onChange={set("minStock")} /></div>
        <div><label className={label}>Máximo ({f.useUnit})</label><input className={field} inputMode="decimal" value={f.maxStock} onChange={set("maxStock")} /></div>
      </div>
      <label className="flex items-center gap-2 text-carbon"><input type="checkbox" checked={f.critical} onChange={(e) => setF((x) => ({ ...x, critical: e.target.checked }))} className="rounded border-arena text-olivo focus:ring-olivo" /> Insumo crítico (agota los productos que lo usan)</label>
      {error && <p className="text-terracota font-medium">{error}</p>}
      <button disabled={!f.name || !Number(f.conversion)} onClick={save} className="w-full py-3 rounded-lg bg-olivo text-dorado font-semibold text-sm disabled:opacity-50">Guardar</button>
    </Shell>
  );
}
