/* Diseño: design/stitch/admin-menu-editor.html (Stitch). Marcado y clases originales; datos reales. E2-01, E2-02, E2-04, E2-07, E7-05. */
import type { Menu } from "@convivium/api-client";
import { client } from "@convivium/app-shell";
import { breakdownIncludedTaxes } from "@convivium/domain";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

type Product = Menu["products"][number];
interface Station { id: string; name: string; kind: string; output: string; printerAddress?: string | null }
interface ModGroup { id: string; name: string; minSelect: number; maxSelect: number; modifiers: { id: string; name: string; priceDelta: number }[]; productCount: number }
interface RecipeRow { id: string; productId: string | null; modifierId: string | null; isSubRecipe: boolean; cost: number }
interface Draft {
  id?: string; name: string; description: string; sku: string; categoryId: string; price: number; iepsPct: number;
  targetPrepSec: number; stationIds: string[]; modifierGroupIds: string[]; active: boolean; soldOut: boolean; photoUrl: string | null; badges: string[];
}

const mxn = (c: number) => `$${(c / 100).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const IEPS: [number, string, string][] = [
  [0, "No aplica (0%)", "Alimento preparado o bebida sin alcohol"],
  [26.5, "26.5%", "Cerveza y bebidas hasta 14° G.L."],
  [30, "30%", "Bebidas de 14° a 20° G.L."],
  [53, "53%", "Destilados de más de 20° G.L."],
];
const toDraft = (p: Product): Draft => ({
  id: p.id, name: p.name, description: p.description ?? "", sku: p.sku ?? "", categoryId: p.categoryId, price: p.price, iepsPct: p.iepsPct,
  targetPrepSec: p.targetPrepSec, stationIds: p.stationIds, modifierGroupIds: p.modifierGroups.map((g) => g.id), active: p.active, soldOut: p.soldOut, photoUrl: p.photoUrl, badges: p.badges ?? [],
});

export function MenuPage() {
  const nav = useNavigate();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [groups, setGroups] = useState<ModGroup[]>([]);
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingGroup, setEditingGroup] = useState<ModGroup | "new" | null>(null);
  const [linking, setLinking] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const sections = { general: useRef<HTMLDivElement>(null), mods: useRef<HTMLDivElement>(null), cost: useRef<HTMLDivElement>(null), stations: useRef<HTMLDivElement>(null) };

  const load = useCallback(async () => {
    const m = await client.catalog.menu();
    setMenu(m);
    setCategoryId((c) => c ?? m.categories[0]?.id ?? null);
    return m;
  }, []);
  const loadGroups = () => client.request<ModGroup[]>("GET", "/catalog/modifier-groups").then(setGroups);
  useEffect(() => {
    load().then((m) => { const first = m.products.find((p) => p.categoryId === m.categories[0]?.id); if (first) setDraft(toDraft(first)); });
    client.request<Station[]>("GET", "/catalog/stations").then(setStations);
    loadGroups();
    client.request<RecipeRow[]>("GET", "/inventory/recipes").then(setRecipes).catch(() => setRecipes([]));
  }, [load]);

  const original = menu?.products.find((p) => p.id === draft?.id);
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(original ? toDraft(original) : null);
  const set = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const costOf = (productId?: string) => recipes.find((r) => r.productId === productId && !r.modifierId && !r.isSubRecipe)?.cost ?? null;
  const ivaPct = menu?.ivaPct ?? 16;
  const taxes = draft ? breakdownIncludedTaxes(draft.price, { ivaPct: ivaPct as 16 | 8, iepsPct: draft.iepsPct }) : null;
  const cost = costOf(draft?.id);
  const foodCost = cost !== null && taxes?.base ? Math.round((cost / taxes.base) * 1000) / 10 : null;
  const products = useMemo(() => (menu?.products ?? []).filter((p) => (q ? p.name.toLowerCase().includes(q.toLowerCase()) || (p.sku ?? "").toLowerCase().includes(q.toLowerCase()) : p.categoryId === categoryId)), [menu, q, categoryId]);
  const category = menu?.categories.find((c) => c.id === (draft?.categoryId ?? categoryId));
  const linked = groups.filter((g) => draft?.modifierGroupIds.includes(g.id));

  const newProduct = async () => {
    // Un platillo necesita categoría: en un menú vacío primero se crea la categoría.
    let cat = categoryId ?? menu?.categories[0]?.id;
    if (!cat) cat = await newCategory();
    if (!cat) return;
    startDraft(cat);
  };
  const startDraft = (cat: string) => setDraft({ name: "", description: "", sku: "", categoryId: cat, price: 0, iepsPct: 0, targetPrepSec: 720, stationIds: stations[0] ? [stations[0].id] : [], modifierGroupIds: [], active: true, soldOut: false, photoUrl: null, badges: [] });
  const save = async () => {
    if (!draft) return;
    setMsg(null);
    const { id, soldOut, ...rest } = draft;
    const body = { ...rest, soldOut, description: rest.description.trim() || null, sku: rest.sku.trim() || null };
    try {
      const res = id ? await client.request("PUT", `/catalog/products/${id}`, body) : await client.request<{ id: string }>("POST", "/catalog/products", body);
      const newId = id ?? (res as { id: string }).id;
      const m = await load();
      const p = m.products.find((x) => x.id === newId);
      if (p) setDraft(toDraft(p));
      setMsg({ ok: true, text: "Guardado. Meseros y cocina ven el cambio al instante." });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  };
  const toggleSoldOut = async (p: { id?: string }, soldOut: boolean) => {
    if (!p.id) return set({ soldOut });
    await client.catalog.setSoldOut(p.id, soldOut);
    const m = await load();
    const fresh = m.products.find((x) => x.id === p.id);
    if (fresh && draft?.id === p.id) setDraft((d) => (d ? { ...d, soldOut: fresh.soldOut } : d));
  };
  const newCategory = async (): Promise<string | undefined> => {
    const name = prompt("Nombre de la nueva categoría (ej. Entradas, Postres, Cervezas)");
    if (!name?.trim()) return undefined;
    const c = await client.request<{ id: string }>("POST", "/catalog/categories", { name: name.trim() });
    await load(); setCategoryId(c.id); setQ("");
    return c.id;
  };
  const scrollTo = (k: keyof typeof sections) => sections[k].current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="flex-1 flex h-screen overflow-hidden bg-marfil">
      <section className="w-80 bg-marfil-card border-r border-arena-border flex flex-col shrink-0 h-full">
        <div className="p-4 border-b border-arena-border/70 space-y-3 bg-marfil/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Categorías de Carta</span>
            <button onClick={newCategory} className="text-xs text-olivo hover:text-dorado flex items-center gap-1 font-medium"><span className="material-symbols-outlined text-sm">add</span><span>Categoría</span></button>
          </div>
          <div className="flex gap-1.5 flex-wrap pb-1 text-xs">
            {menu?.categories.map((c) => {
              const n = menu.products.filter((p) => p.categoryId === c.id).length;
              return c.id === categoryId && !q ? (
                <button key={c.id} className="px-2.5 py-1 rounded-full bg-olivo text-dorado font-medium whitespace-nowrap shadow-xs text-[11px] flex items-center gap-1 border border-dorado/30"><span className="w-1.5 h-1.5 rounded-full bg-dorado" />{c.name} ({n})</button>
              ) : (
                <button key={c.id} onClick={() => { setCategoryId(c.id); setQ(""); }} className="px-2.5 py-1 rounded bg-stone-200/70 text-stone-700 whitespace-nowrap hover:bg-stone-200 text-[11px]">{c.name} ({n})</button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm">search</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} className="w-full bg-white/90 border border-arena-border text-xs rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-olivo text-stone-800 placeholder-stone-400" placeholder="Buscar por nombre o SKU..." type="text" />
            </div>
            <button onClick={newProduct} className="bg-olivo hover:bg-olivo-hover text-white text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 shrink-0 transition-colors shadow-xs" title="Crear nuevo platillo en esta categoría"><span className="material-symbols-outlined text-sm">add</span><span className="font-medium hidden sm:inline">Nuevo</span></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-arena-border/50">
          {products.map((p) => {
            const sel = p.id === draft?.id;
            const c = costOf(p.id);
            const base = breakdownIncludedTaxes(p.price, { ivaPct: ivaPct as 16 | 8, iepsPct: p.iepsPct }).base;
            const st = p.stationIds.map((id) => stations.find((s) => s.id === id)?.name).filter(Boolean).join(" + ");
            return (
              <div key={p.id} onClick={() => { if (!dirty || confirm("Hay cambios sin guardar. ¿Descartarlos?")) setDraft(toDraft(p)); }} className={sel ? "p-3.5 bg-dorado/10 border-l-4 border-dorado cursor-pointer transition-colors relative" : p.soldOut ? "p-3.5 bg-terracota-subtle/30 hover:bg-terracota-subtle/50 cursor-pointer transition-colors border-l-2 border-terracota/40" : "p-3.5 hover:bg-stone-50/80 cursor-pointer transition-colors"}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-serif-brand tracking-tight truncate ${sel ? "font-bold text-stone-900" : "font-semibold text-stone-800"} ${p.soldOut ? "line-through text-stone-700" : ""} ${!p.active ? "text-stone-400" : ""}`}>{p.name}</span>
                      {sel && <span className="text-[9px] bg-dorado/30 text-stone-900 px-1.5 py-0.5 rounded font-mono font-medium">EDITANDO</span>}
                    </div>
                    <p className="text-[11px] text-stone-500 mt-0.5 font-mono">{p.sku ? `SKU: ${p.sku} · ` : ""}{mxn(p.price)} MXN</p>
                  </div>
                  {!p.active ? <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-stone-100 text-stone-500 border border-stone-200">Inactivo</span>
                    : sel ? <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-300">Activo</span>
                    : (
                      <label onClick={(e) => e.stopPropagation()} className="relative inline-flex items-center cursor-pointer" title="Disponible en sala">
                        <input checked={!p.soldOut} onChange={(e) => toggleSoldOut(p, !e.target.checked)} className="sr-only peer" type="checkbox" />
                        <div className="w-7 h-4 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-olivo" />
                      </label>
                    )}
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  {p.soldOut ? <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-terracota/10 text-terracota border border-terracota/20"><span className="material-symbols-outlined text-[10px]">block</span>Agotado</span>
                    : <span className="flex items-center gap-1 text-[10px] text-olivo font-medium"><span className="material-symbols-outlined text-xs">local_fire_department</span>{st || "Sin estación"}</span>}
                  <span className="text-[10px] text-stone-500 font-medium">{c !== null && base ? `Margen: ${Math.round(((base - c) / base) * 1000) / 10}%` : "Sin receta"}</span>
                </div>
              </div>
            );
          })}
          {!products.length && <p className="p-4 text-xs text-stone-500 italic">Sin productos{q ? " que coincidan" : " en esta categoría"}.</p>}
        </div>
        <div className="p-3 bg-arena-light/40 border-t border-arena-border text-center text-[11px] text-stone-500 font-medium">{q ? `${products.length} resultados` : `${products.length} platillos en ${menu?.categories.find((c) => c.id === categoryId)?.name ?? ""}`}</div>
      </section>

      {draft && taxes ? (
        <main className="flex-1 flex flex-col h-full bg-marfil overflow-hidden">
          <div className="px-8 py-5 bg-white border-b border-arena-border shadow-xs shrink-0">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-stone-500 mb-1"><span>Catálogo General</span><span>/</span><span>{category?.name}</span>{draft.sku && <><span>/</span><span className="font-mono text-stone-700">SKU {draft.sku}</span></>}</div>
                <div className="flex items-center gap-3">
                  <h1 className="font-serif-brand text-2xl font-bold text-stone-900 tracking-tight">{draft.name || "Nuevo platillo"} · <span className="font-normal text-stone-600">{draft.id ? "Edición de Producto" : "Alta de Producto"}</span></h1>
                  <button onClick={() => set({ active: !draft.active })} title="Activar / desactivar en carta" className={draft.active ? "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200" : "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-600 border border-stone-300"}><span className={`w-2 h-2 rounded-full ${draft.active ? "bg-emerald-600" : "bg-stone-400"}`} />{draft.active ? "Activo en Carta" : "Fuera de carta"}</button>
                </div>
              </div>
              <div className="flex items-center gap-4 bg-marfil-canvas px-4 py-2 rounded-xl border border-arena-border">
                <div className="text-right"><span className="text-xs font-semibold text-stone-800 block">Disponibilidad en Sala</span><span className="text-[10px] text-stone-500">{draft.soldOut ? "Agotado: meseros no pueden pedirlo" : "Sincronizado con KDS y Meseros"}</span></div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input checked={!draft.soldOut} onChange={(e) => toggleSoldOut(draft, !e.target.checked)} className="sr-only peer" type="checkbox" />
                  <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-olivo" />
                </label>
              </div>
            </div>
            <div className="flex items-center gap-8 mt-5 border-b border-stone-200 -mb-5 text-xs font-medium">
              <button onClick={() => scrollTo("general")} className="pb-3 border-b-2 border-olivo text-stone-900 font-semibold flex items-center gap-2"><span className="material-symbols-outlined text-base text-olivo">tune</span>General e Impuestos</button>
              <button onClick={() => scrollTo("mods")} className="pb-3 border-b-2 border-transparent text-stone-500 hover:text-stone-800 flex items-center gap-2"><span className="material-symbols-outlined text-base">checklist</span>Modificadores<span className="bg-arena-light px-1.5 py-0.2 rounded text-[10px] font-bold text-stone-700">{linked.length} {linked.length === 1 ? "grupo" : "grupos"}</span></button>
              <button onClick={() => scrollTo("cost")} className="pb-3 border-b-2 border-transparent text-stone-500 hover:text-stone-800 flex items-center gap-2"><span className="material-symbols-outlined text-base">calculate</span>Receta y Costeo{foodCost !== null && <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${foodCost <= 32 ? "bg-emerald-100 text-emerald-800" : "bg-terracota/10 text-terracota"}`}>{foodCost}%</span>}</button>
              <button onClick={() => scrollTo("stations")} className="pb-3 border-b-2 border-transparent text-stone-500 hover:text-stone-800 flex items-center gap-2"><span className="material-symbols-outlined text-base">kitchen</span>Estaciones de Producción<span className="text-stone-400 text-[10px]">({draft.stationIds.length} KDS)</span></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-6">
            <div ref={sections.general} className="bg-white rounded-xl border border-arena-border p-6 shadow-xs scroll-mt-4">
              <h3 className="font-serif-brand text-base font-semibold text-stone-900 mb-4 pb-2 border-b border-arena-light flex items-center justify-between"><span>Información General y Presentación</span></h3>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              <PhotoCard draft={draft} onChange={(photoUrl) => { set({ photoUrl }); load(); }} />
              <div className="md:col-span-8 lg:col-span-9 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-stone-700 mb-1.5">Nombre comercial del platillo <span className="text-terracota">*</span></label><input value={draft.name} onChange={(e) => set({ name: e.target.value })} className="w-full bg-marfil-canvas/40 border border-arena-border rounded-lg text-xs font-medium px-3 py-2 text-stone-900 focus:bg-white focus:ring-1 focus:ring-olivo" type="text" /></div>
                <div><label className="block text-xs font-semibold text-stone-700 mb-1.5">Categoría en carta <span className="text-terracota">*</span></label>
                  <select value={draft.categoryId} onChange={(e) => set({ categoryId: e.target.value })} className="w-full bg-marfil-canvas/40 border border-arena-border rounded-lg text-xs font-medium px-3 py-2 text-stone-900 focus:bg-white focus:ring-1 focus:ring-olivo">{menu?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                </div>
                <div className="md:col-span-2"><label className="block text-xs font-semibold text-stone-700 mb-1.5">Descripción para mesero y comanda digital</label>
                  <textarea value={draft.description} maxLength={160} onChange={(e) => set({ description: e.target.value })} className="w-full bg-marfil-canvas/40 border border-arena-border rounded-lg text-xs text-stone-800 p-2.5 focus:bg-white focus:ring-1 focus:ring-olivo resize-none" rows={2} />
                  <p className="text-[11px] text-stone-400 mt-1 flex justify-between"><span>Aparece en la pantalla del mesero y comanda de cocina KDS.</span><span>{draft.description.length} / 160 caracteres</span></p>
                </div>
                <div><span className="block text-xs font-semibold text-stone-700 mb-1.5">Etiquetas en el menú impreso y digital</span>
                  <div className="flex flex-wrap gap-1.5">{([["nuevo", "Nuevo"], ["picante", "Picante"], ["vegetariano", "Vegetariano"], ["recomendado", "Recomendado"]] as const).map(([b, l]) => { const on = draft.badges.includes(b); return <button key={b} onClick={() => set({ badges: on ? draft.badges.filter((x) => x !== b) : [...draft.badges, b] })} className={on ? "px-3 py-1 rounded-full bg-olivo text-dorado text-[11px] font-medium" : "px-3 py-1 rounded-full bg-white border border-arena-border text-stone-600 text-[11px]"}>{l}</button>; })}</div>
                </div>
                <div><label className="block text-xs font-semibold text-stone-700 mb-1.5">Código SKU / PLU Interno</label>
                  <div className="flex"><span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-arena-border bg-stone-100 text-stone-500 font-mono text-xs">#</span><input value={draft.sku} maxLength={24} onChange={(e) => set({ sku: e.target.value.toUpperCase() })} className="w-full bg-marfil-canvas/40 border border-arena-border rounded-r-lg text-xs font-mono px-3 py-2 text-stone-800 focus:bg-white focus:ring-1 focus:ring-olivo" type="text" /></div>
                </div>
              </div>
              </div>
            </div>

            <div ref={sections.stations} className="grid grid-cols-1 lg:grid-cols-12 gap-6 scroll-mt-4">
              <div className="lg:col-span-7 bg-white rounded-xl border border-arena-border p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-arena-light"><h3 className="font-serif-brand text-base font-semibold text-stone-900 flex items-center gap-2"><span className="material-symbols-outlined text-olivo text-lg">payments</span>Precios e Impuestos</h3><span className="text-xs bg-dorado-subtle text-stone-800 px-2 py-0.5 rounded border border-dorado/40 font-medium">Impuestos incluidos</span></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div><label className="block text-xs font-semibold text-stone-700 mb-1.5">Precio de Venta al Público (PVP)</label>
                      <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 font-serif-brand font-bold text-sm">$</span><input type="number" min={0} step="0.5" value={draft.price / 100} onChange={(e) => set({ price: Math.round(Number(e.target.value) * 100) })} className="w-full bg-white border-2 border-olivo/30 rounded-lg text-base font-bold pl-7 pr-12 py-2 text-stone-900 focus:border-olivo focus:outline-none" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">MXN</span></div>
                      {original && original.price !== draft.price && <p className="text-[11px] text-amber-700 mt-1">Antes {mxn(original.price)} · el cambio queda en la bitácora.</p>}
                    </div>
                    <div><label className="block text-xs font-semibold text-stone-700 mb-1.5">Impuesto al Valor Agregado (IVA)</label><div className="w-full bg-marfil-canvas/50 border border-arena-border rounded-lg text-xs font-medium px-3 py-2.5 text-stone-900">{ivaPct}% (Tasa de la sucursal)</div></div>
                  </div>
                  <div className="bg-marfil-canvas/60 rounded-lg p-3 border border-arena-border/70 mb-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-stone-800">IEPS (Bebidas alcohólicas):</span>
                      <select value={draft.iepsPct} onChange={(e) => set({ iepsPct: Number(e.target.value) })} className="text-xs font-bold text-stone-600 bg-white px-2 py-0.5 rounded border border-stone-200">{IEPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                    </div>
                    <p className="text-[11px] text-stone-500 mt-1">{IEPS.find(([v]) => v === draft.iepsPct)?.[2] ?? "Tasa personalizada"}</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-arena-light flex items-center justify-between text-xs">
                  <div><span className="text-stone-500 block text-[11px]">Base gravable neta (sin impuestos)</span><span className="font-mono font-bold text-stone-800 text-sm">{mxn(taxes.base)} MXN</span></div>
                  <div className="text-center"><span className="text-stone-500 block text-[11px]">IVA{taxes.ieps ? " + IEPS" : ""} Trasladado</span><span className="font-mono font-bold text-stone-800 text-sm">+{mxn(taxes.iva + taxes.ieps)} MXN</span></div>
                  <div className="text-right"><span className="text-stone-500 block text-[11px]">Precio Final</span><span className="font-mono font-bold text-olivo text-sm">{mxn(draft.price)} MXN</span></div>
                </div>
              </div>
              <div className="lg:col-span-5 bg-white rounded-xl border border-arena-border p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-arena-light"><h3 className="font-serif-brand text-base font-semibold text-stone-900 flex items-center gap-2"><span className="material-symbols-outlined text-olivo text-lg">soup_kitchen</span>Estaciones KDS y Tiempo</h3><span className="text-[11px] text-stone-500">Ruteo de comandas</span></div>
                  <label className="block text-xs font-semibold text-stone-700 mb-2">Estaciones asignadas:</label>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {stations.map((s) => {
                      const idx = draft.stationIds.indexOf(s.id);
                      return idx >= 0 ? (
                        <div key={s.id} onClick={() => draft.stationIds.length > 1 && set({ stationIds: draft.stationIds.filter((x) => x !== s.id) })} className="flex items-center justify-between p-2 rounded-lg bg-olivo/10 border border-olivo text-stone-900 cursor-pointer">
                          <div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-olivo text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span><span className="text-xs font-semibold">{s.name}</span></div>
                          <span className={idx === 0 ? "text-[9px] bg-olivo text-white px-1 rounded" : "text-[9px] bg-stone-200 text-stone-700 px-1 rounded"}>{idx === 0 ? "Principal" : "Ensamble"}</span>
                        </div>
                      ) : (
                        <div key={s.id} onClick={() => set({ stationIds: [...draft.stationIds, s.id] })} className="flex items-center justify-between p-2 rounded-lg bg-stone-50 border border-stone-200 text-stone-400 cursor-pointer hover:bg-stone-100">
                          <div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-stone-400 text-sm">radio_button_unchecked</span><span className="text-xs font-medium">{s.name}</span></div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-600 font-medium">Tiempo estándar de preparación:</span>
                      <div className="flex items-center gap-1"><button onClick={() => set({ targetPrepSec: Math.max(60, draft.targetPrepSec - 60) })} className="w-6 h-6 rounded bg-stone-100 hover:bg-stone-200 font-bold">−</button><span className="font-mono font-bold text-stone-900 text-sm w-20 text-center">{Math.round(draft.targetPrepSec / 60)} minutos</span><button onClick={() => set({ targetPrepSec: draft.targetPrepSec + 60 })} className="w-6 h-6 rounded bg-stone-100 hover:bg-stone-200 font-bold">+</button></div>
                    </div>
                    <div className="w-full bg-stone-200 rounded-full h-2 overflow-hidden flex"><div className="bg-emerald-600 h-2 w-[70%]" title="En tiempo" /><div className="bg-amber-500 h-2 w-[18%]" title="Precaución" /><div className="bg-terracota h-2 w-[12%]" title="Excedido" /></div>
                    <div className="flex items-center justify-between text-[10px] text-stone-400"><span>Meta: {Math.round(draft.targetPrepSec / 60)} min</span><span className="text-amber-700 font-medium">Semáforo ámbar al llegar a la meta</span><span className="text-terracota font-medium">Rojo al excederla</span></div>
                  </div>
                </div>
                <div className="pt-3 border-t border-arena-light flex items-center justify-between text-[11px] text-stone-500 mt-2">
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs text-olivo">print</span>Salida de la estación principal</span>
                  <span className="font-medium text-stone-700">{(() => { const s = stations.find((x) => x.id === draft.stationIds[0]); return s ? (s.output === "pantalla" ? "Solo pantalla" : s.output === "impresora" ? "Solo impresora" : "Pantalla + impresora") : "—"; })()}</span>
                </div>
              </div>
            </div>

            <div ref={sections.mods} className="bg-white rounded-xl border border-arena-border p-6 shadow-xs scroll-mt-4">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-arena-light">
                <div><h3 className="font-serif-brand text-base font-semibold text-stone-900 flex items-center gap-2"><span className="material-symbols-outlined text-olivo text-lg">checklist_rtl</span>Grupos de Modificadores y Opciones de Servicio</h3><p className="text-xs text-stone-500 mt-0.5">Control de selección obligatoria y opcional para los meseros al capturar comanda.</p></div>
                <div className="flex items-center gap-2 relative">
                  <button onClick={() => setLinking(!linking)} className="text-xs font-semibold text-olivo hover:text-olivo-hover bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-lg border border-arena-border flex items-center gap-1.5 transition-colors"><span className="material-symbols-outlined text-sm">add</span>Vincular Grupo Existente</button>
                  <button onClick={() => setEditingGroup("new")} className="text-xs font-semibold text-white bg-olivo hover:bg-olivo-hover px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"><span className="material-symbols-outlined text-sm">library_add</span>Nuevo grupo</button>
                  {linking && (
                    <div className="absolute right-0 top-9 w-72 bg-white border border-arena-border rounded-lg shadow-lg z-20 p-2 max-h-72 overflow-y-auto">
                      {groups.filter((g) => !draft.modifierGroupIds.includes(g.id)).map((g) => (
                        <button key={g.id} onClick={() => { set({ modifierGroupIds: [...draft.modifierGroupIds, g.id] }); setLinking(false); }} className="w-full text-left px-2.5 py-2 rounded hover:bg-marfil-canvas text-xs">
                          <span className="font-semibold text-stone-800 block">{g.name}</span>
                          <span className="text-[10px] text-stone-500">{g.modifiers.length} opciones · usado en {g.productCount} productos</span>
                        </button>
                      ))}
                      {!groups.some((g) => !draft.modifierGroupIds.includes(g.id)) && <p className="text-xs text-stone-500 p-2">No hay más grupos. Crea uno nuevo.</p>}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {linked.map((g, i) => (
                  <div key={g.id} className="border border-arena-border rounded-lg p-4 bg-marfil-canvas/30">
                    <div className="flex items-start justify-between pb-2 mb-3 border-b border-arena-border/80">
                      <div>
                        <div className="flex items-center gap-2"><h4 className="text-xs font-bold text-stone-900 uppercase tracking-wide">{i + 1}. {g.name}</h4>{g.minSelect > 0 ? <span className="text-[10px] font-bold px-2 py-0.2 rounded bg-terracota/10 text-terracota border border-terracota/20">Obligatorio</span> : <span className="text-[10px] font-bold px-2 py-0.2 rounded bg-stone-200 text-stone-700">Opcional</span>}</div>
                        <p className="text-[11px] text-stone-500 mt-0.5">Regla de selección: Mínimo {g.minSelect} · Máximo {g.maxSelect}{g.productCount > 1 ? ` · compartido con ${g.productCount - 1} productos` : ""}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setEditingGroup(g)} className="text-stone-400 hover:text-stone-700" title="Editar grupo"><span className="material-symbols-outlined text-sm">edit</span></button>
                        <button onClick={() => set({ modifierGroupIds: draft.modifierGroupIds.filter((x) => x !== g.id) })} className="text-stone-400 hover:text-terracota" title="Desvincular de este producto"><span className="material-symbols-outlined text-sm">link_off</span></button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {g.modifiers.map((m) => (
                        <div key={m.id} className="flex items-center justify-between px-2.5 py-1.5 rounded bg-white border border-stone-200 text-xs">
                          <div className="flex items-center gap-2">{g.maxSelect === 1 ? <span className="w-2 h-2 rounded-full bg-stone-300" /> : <span className="material-symbols-outlined text-stone-400 text-sm">add_circle</span>}<span className="text-stone-800">{m.name}</span></div>
                          {m.priceDelta ? <span className="text-olivo font-mono font-bold text-xs">+{mxn(m.priceDelta)} MXN</span> : <span className="text-stone-500 font-mono text-[11px]">Sin costo ($0.00)</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {!linked.length && <p className="text-xs text-stone-500 italic">Este producto no tiene modificadores.</p>}
              </div>
            </div>

            <div ref={sections.cost} className="bg-white rounded-xl border border-arena-border p-6 shadow-xs scroll-mt-4">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-arena-light">
                <div><h3 className="font-serif-brand text-base font-semibold text-stone-900 flex items-center gap-2"><span className="material-symbols-outlined text-dorado text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>Rentabilidad y Costeo Teórico (Food Cost)</h3><p className="text-xs text-stone-500 mt-0.5">Integrado con el costo promedio de los insumos en inventario.</p></div>
                <button disabled={!draft.id} onClick={() => draft.id && nav(`/recetas?producto=${draft.id}`)} className="text-xs text-olivo hover:underline font-semibold flex items-center gap-1">{cost === null ? "Capturar receta" : "Ver receta completa"}<span className="material-symbols-outlined text-sm">arrow_forward</span></button>
              </div>
              {cost === null ? <p className="text-xs text-stone-500">{draft.id ? "Este platillo aún no tiene receta: sin ella no se descuenta inventario ni se conoce su margen." : "Guarda el producto y después captura su receta."}</p> : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-marfil-canvas/40 border border-arena-border"><span className="text-[11px] text-stone-500 block">Costo Teórico de Receta</span><span className="font-serif-brand text-2xl font-bold text-stone-900">{mxn(cost)} <span className="text-xs font-normal text-stone-500">MXN</span></span><span className="text-[10px] text-stone-400 block">Insumos + mermas de receta</span></div>
                  <div className={`p-4 rounded-lg border ${foodCost! <= 32 ? "bg-emerald-50 border-emerald-200" : "bg-terracota/5 border-terracota/30"}`}><span className="text-[11px] text-stone-500 block">% Costo Alimentos (Food Cost)</span><span className={`font-serif-brand text-2xl font-bold ${foodCost! <= 32 ? "text-emerald-800" : "text-terracota"}`}>{foodCost}%</span><span className="text-[10px] text-stone-500 block">Objetivo cocina: ≤32% · {foodCost! <= 32 ? "Dentro del parámetro saludable" : "Revisar gramajes o precio"}</span></div>
                  <div className="p-4 rounded-lg bg-marfil-canvas/40 border border-arena-border"><span className="text-[11px] text-stone-500 block">Margen de Contribución</span><span className="font-serif-brand text-2xl font-bold text-olivo">{mxn(taxes.base - cost)} <span className="text-xs font-normal text-stone-500">MXN</span></span><span className="text-[10px] text-stone-400 block">Precio neto {mxn(taxes.base)} − costo {mxn(cost)}</span></div>
                </div>
              )}
            </div>
          </div>

          <div className="px-8 py-3 bg-white border-t border-arena-border flex items-center justify-between shrink-0">
            <span className={`text-xs ${msg ? (msg.ok ? "text-emerald-700" : "text-terracota") : "text-stone-400"}`}>{msg?.text ?? (dirty ? "Cambios sin guardar" : "Sin cambios")}</span>
            <div className="flex items-center gap-2">
              <button disabled={!dirty} onClick={() => setDraft(original ? toDraft(original) : null)} className="px-4 py-2 rounded-lg border border-arena-border text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40">Descartar</button>
              <button disabled={!dirty || !draft.name.trim() || draft.price <= 0 || !draft.stationIds.length} onClick={save} className="px-5 py-2 rounded-lg bg-olivo hover:bg-olivo-hover text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm disabled:opacity-40"><span className="material-symbols-outlined text-sm text-dorado">check_circle</span>{draft.id ? "Guardar producto" : "Crear producto"}</button>
            </div>
          </div>
        </main>
      ) : (
        <main className="flex-1 flex flex-col items-center justify-center gap-3 text-sm text-stone-500">
          {menu && !menu.categories.length ? (
            <>
              <span className="material-symbols-outlined text-4xl text-arena">restaurant_menu</span>
              <p className="font-serif-brand text-lg text-stone-800">Tu menú está vacío</p>
              <p>Empieza creando una categoría (Entradas, Fuertes, Bebidas…) y después agrega sus platillos.</p>
              <button onClick={() => newProduct()} className="px-4 py-2 rounded-lg bg-olivo text-white text-xs font-semibold">Crear primera categoría y platillo</button>
            </>
          ) : "Selecciona un producto o crea uno nuevo."}
        </main>
      )}

      {editingGroup && <GroupEditor group={editingGroup === "new" ? null : editingGroup} onClose={() => setEditingGroup(null)} onSaved={async (id) => { await loadGroups(); await load(); if (editingGroup === "new" && id) set({ modifierGroupIds: [...(draft?.modifierGroupIds ?? []), id] }); setEditingGroup(null); }} />}
    </div>
  );
}

function GroupEditor({ group, onClose, onSaved }: { group: ModGroup | null; onClose: () => void; onSaved: (id?: string) => void }) {
  const [name, setName] = useState(group?.name ?? "");
  const [minSelect, setMin] = useState(group?.minSelect ?? 0);
  const [maxSelect, setMax] = useState(group?.maxSelect ?? 1);
  const [mods, setMods] = useState<{ id?: string; name: string; priceDelta: number }[]>(group?.modifiers.map((m) => ({ ...m })) ?? [{ name: "", priceDelta: 0 }]);
  const [err, setErr] = useState("");
  const save = async () => {
    setErr("");
    const body = { name, minSelect, maxSelect, modifiers: mods.filter((m) => m.name.trim()) };
    try {
      if (group) { await client.request("PUT", `/catalog/modifier-groups/${group.id}`, body); onSaved(); }
      else { const r = await client.request<{ id: string }>("POST", "/catalog/modifier-groups", body); onSaved(r.id); }
    } catch (e) { setErr((e as Error).message); }
  };
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-xl w-[520px] max-h-[85vh] overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="font-serif-brand text-lg font-bold text-stone-900">{group ? "Editar grupo de modificadores" : "Nuevo grupo de modificadores"}</h3><button onClick={onClose} className="text-stone-400 hover:text-stone-700"><span className="material-symbols-outlined">close</span></button></div>
        {group && group.productCount > 1 && <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">Este grupo lo usan {group.productCount} productos: los cambios aplican a todos.</p>}
        <div><label className="block text-xs font-semibold text-stone-700 mb-1.5">Nombre del grupo</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Término de la carne" className="w-full border border-arena-border rounded-lg text-xs px-3 py-2" /></div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <label><span className="block font-semibold text-stone-700 mb-1.5">Mínimo a elegir</span><input type="number" min={0} max={10} value={minSelect} onChange={(e) => setMin(Number(e.target.value))} className="w-full border border-arena-border rounded-lg px-3 py-2" /></label>
          <label><span className="block font-semibold text-stone-700 mb-1.5">Máximo a elegir</span><input type="number" min={1} max={20} value={maxSelect} onChange={(e) => setMax(Number(e.target.value))} className="w-full border border-arena-border rounded-lg px-3 py-2" /></label>
        </div>
        <p className="text-[11px] text-stone-500">{minSelect > 0 ? `Obligatorio: el mesero debe elegir al menos ${minSelect}.` : "Opcional."}</p>
        <div className="space-y-2">
          <span className="block text-xs font-semibold text-stone-700">Opciones</span>
          {mods.map((m, i) => (
            <div key={m.id ?? `n${i}`} className="flex items-center gap-2">
              <input value={m.name} onChange={(e) => setMods(mods.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Nombre de la opción" className="flex-1 border border-arena-border rounded-lg text-xs px-3 py-1.5" />
              <span className="text-xs text-stone-500">+$</span>
              <input type="number" min={0} step="0.5" value={m.priceDelta / 100} onChange={(e) => setMods(mods.map((x, j) => (j === i ? { ...x, priceDelta: Math.round(Number(e.target.value) * 100) } : x)))} className="w-20 border border-arena-border rounded-lg text-xs px-2 py-1.5 font-mono" />
              <button onClick={() => setMods(mods.filter((_, j) => j !== i))} className="text-stone-400 hover:text-terracota"><span className="material-symbols-outlined text-sm">delete</span></button>
            </div>
          ))}
          <button onClick={() => setMods([...mods, { name: "", priceDelta: 0 }])} className="text-xs text-olivo font-semibold flex items-center gap-1"><span className="material-symbols-outlined text-sm">add</span>Agregar opción</button>
        </div>
        {err && <p className="text-xs text-terracota">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-arena-border text-xs">Cancelar</button>
          <button disabled={name.trim().length < 2 || !mods.some((m) => m.name.trim())} onClick={save} className="px-4 py-2 rounded-lg bg-olivo text-white text-xs font-semibold disabled:opacity-40">Guardar grupo</button>
        </div>
      </div>
    </div>
  );
}

/** Fotografía del platillo (diseño Stitch admin-menu-editor: tarjeta cuadrada con "Reemplazar imagen"). */
function PhotoCard({ draft, onChange }: { draft: Draft; onChange: (photoUrl: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const upload = async (file: File) => {
    setErr(null);
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setErr("Usa una foto JPG, PNG o WebP.");
    if (file.size > 5 * 1024 * 1024) return setErr("La foto pesa más de 5 MB.");
    setBusy(true);
    try {
      const dataUrl = await new Promise<string>((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = ko; r.readAsDataURL(file); });
      const { photoUrl } = await client.request<{ photoUrl: string }>("PUT", `/catalog/products/${draft.id}/photo`, { dataUrl });
      onChange(photoUrl);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); if (input.current) input.current.value = ""; }
  };
  const remove = async () => { setBusy(true); try { await client.request("DELETE", `/catalog/products/${draft.id}/photo`); onChange(null); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  return (
    <div className="md:col-span-4 lg:col-span-3 flex flex-col gap-2">
      <label className="text-xs font-medium text-stone-700">Fotografía de Platillo</label>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      {!draft.id ? (
        <div className="rounded-lg border border-dashed border-arena-border bg-stone-100 aspect-square flex flex-col items-center justify-center gap-1 p-3 text-center">
          <span className="material-symbols-outlined text-stone-400 text-2xl">photo_camera</span>
          <span className="text-[11px] text-stone-500">Guarda el platillo para subir su foto</span>
        </div>
      ) : (
        <div className="relative group rounded-lg overflow-hidden border border-arena-border bg-stone-100 aspect-square flex items-center justify-center">
          {draft.photoUrl ? <img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" src={draft.photoUrl} alt={draft.name} /> : <span className="material-symbols-outlined text-stone-400 text-4xl">photo_camera</span>}
          <div className={`absolute inset-0 bg-stone-900/40 transition-opacity flex flex-col items-center justify-center gap-2 p-3 text-center ${draft.photoUrl && !busy ? "opacity-0 group-hover:opacity-100" : "opacity-100"}`}>
            <button disabled={busy} onClick={() => input.current?.click()} className="bg-white/95 hover:bg-white text-stone-900 text-xs font-medium px-3 py-1.5 rounded shadow-sm flex items-center gap-1.5 disabled:opacity-60">
              <span className="material-symbols-outlined text-sm">photo_camera</span>{busy ? "Subiendo…" : draft.photoUrl ? "Reemplazar imagen" : "Subir imagen"}
            </button>
            {draft.photoUrl && !busy && <button onClick={remove} className="text-[11px] text-white/95 underline">Quitar foto</button>}
            <span className="text-[10px] text-white/90">JPG / PNG hasta 5MB</span>
          </div>
          <span className="absolute bottom-2 left-2 bg-stone-900/70 backdrop-blur-xs text-white text-[10px] px-1.5 py-0.5 rounded font-mono">1200x800px</span>
        </div>
      )}
      {err && <p className="text-[11px] text-terracota">{err}</p>}
    </div>
  );
}
