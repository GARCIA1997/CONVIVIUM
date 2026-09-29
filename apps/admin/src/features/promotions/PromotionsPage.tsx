/* Diseño: design/stitch/admin-promociones.html (Stitch). Marcado y clases originales; datos reales. E4-07. */
import { client } from "@convivium/app-shell";
import { useCallback, useEffect, useMemo, useState } from "react";

type Kind = "dos_por_uno" | "porcentaje" | "precio_especial" | "combo";
type Status = "activa" | "pausada" | "borrador";
interface Promo {
  id?: string; name: string; kind: Kind; value: number; productIds: string[]; categoryIds: string[]; days: number[];
  startTime: string | null; endTime: string | null; zones: string[]; toleranceMin: number; status: Status; liveNow?: boolean; updatedAt?: string;
}
interface Menu { categories: { id: string; name: string }[]; products: { id: string; name: string; categoryId: string; price: number; active: boolean }[] }
interface Impact { totalDiscount: number; checks: number; byPromotion: { id: string; discount: number; checks: number }[]; topProduct: { name: string; quantity: number } | null }

const KINDS: { kind: Kind; icon: string; label: string; hint: string }[] = [
  { kind: "dos_por_uno", icon: "counter_2", label: "2x1 (Dos por Uno)", hint: "La segunda unidad de menor precio sin costo" },
  { kind: "porcentaje", icon: "percent", label: "% Descuento", hint: "Porcentaje fijo sobre el precio de carta" },
  { kind: "precio_especial", icon: "sell", label: "Precio Especial", hint: "Tarifa fija por horario convenido" },
  { kind: "combo", icon: "fastfood", label: "Combo / Paquete", hint: "Precio fijo por un juego de productos" },
];
// Lunes primero en pantalla; el motor usa 0 = domingo.
const WEEK: [number, string, string][] = [[1, "L", "Lunes"], [2, "M", "Martes"], [3, "M", "Miércoles"], [4, "J", "Jueves"], [5, "V", "Viernes"], [6, "S", "Sábado"], [0, "D", "Domingo"]];
const mxn = (c: number) => `$${(c / 100).toLocaleString("es-MX", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
const blank = (): Promo => ({ name: "Nueva promoción", kind: "dos_por_uno", value: 0, productIds: [], categoryIds: [], days: [1, 2, 3, 4, 5], startTime: "17:00", endTime: "20:00", zones: [], toleranceMin: 15, status: "borrador" });
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h! * 60 + m!; };

function daysLabel(days: number[]) {
  if (!days.length || days.length === 7) return "Todos los días";
  const s = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const names = s.map((d) => WEEK.find((w) => w[0] === d)![2]);
  const idx = s.map((d) => (d + 6) % 7);
  const consecutive = idx.every((v, i) => i === 0 || v === idx[i - 1]! + 1);
  return consecutive && s.length > 2 ? `${names[0]} a ${names.at(-1)}` : names.join(", ");
}
function benefit(p: Promo) {
  return p.kind === "dos_por_uno" ? "2x1" : p.kind === "porcentaje" ? `${p.value}% Descuento directo` : p.kind === "precio_especial" ? `Precio especial: ${mxn(p.value)}` : `Paquete fijo: ${mxn(p.value)} MXN`;
}

export function PromotionsPage() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [menu, setMenu] = useState<Menu>({ categories: [], products: [] });
  const [areas, setAreas] = useState<{ id: string; name: string }[]>([]);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [filter, setFilter] = useState<"todas" | "hoy" | "borradores">("todas");
  const [draft, setDraft] = useState<Promo | null>(null);
  const [picker, setPicker] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const [p, i] = await Promise.all([client.request<Promo[]>("GET", "/promotions"), client.request<Impact>("GET", "/promotions/impact")]);
    setPromos(p); setImpact(i);
    return p;
  }, []);
  useEffect(() => {
    load().then((p) => setDraft((d) => d ?? (p[0] ? { ...p[0] } : blank())));
    client.request<Menu>("GET", "/catalog/menu").then(setMenu);
    client.request<{ areas: { id: string; name: string }[] }>("GET", "/floor").then((f) => setAreas(f.areas));
  }, [load]);

  const today = new Date().getDay();
  const shown = promos.filter((p) => filter === "todas" ? true : filter === "hoy" ? p.status === "activa" && (!p.days.length || p.days.includes(today)) : p.status === "borrador");
  const original = promos.find((p) => p.id === draft?.id);
  const dirty = !!draft && JSON.stringify(strip(draft)) !== JSON.stringify(original ? strip(original) : strip(blank()));
  const set = (patch: Partial<Promo>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const zones = [{ id: "barra", name: "Barra Directa" }, ...areas];

  const affected = useMemo(() => {
    if (!draft) return [];
    return menu.products.filter((p) => p.active && (draft.productIds.includes(p.id) || draft.categoryIds.includes(p.categoryId)));
  }, [draft, menu]);

  const save = async (status?: Status) => {
    if (!draft) return;
    setErr("");
    const body = { ...strip(draft), status: status ?? (draft.status === "borrador" ? "activa" : draft.status) };
    try {
      const saved = await client.request<Promo>(draft.id ? "PUT" : "POST", draft.id ? `/promotions/${draft.id}` : "/promotions", body);
      await load();
      setDraft({ ...saved });
    } catch (e) { setErr((e as Error).message); }
  };
  const archive = async () => { if (draft?.id && confirm(`¿Archivar "${draft.name}"? Deja de aplicarse en comandas nuevas.`)) { await client.request("DELETE", `/promotions/${draft.id}`); const p = await load(); setDraft(p.find((x) => x.id === draft.id) ?? null); } };

  return (
    <main className="flex-1 grid grid-cols-12 overflow-hidden bg-[#F7F5F0] min-h-screen">
      <section className="col-span-3 border-r border-[#C9B89F]/40 flex flex-col h-screen bg-[#F7F5F0]/70 overflow-hidden">
        <div className="p-4 border-b border-[#C9B89F]/40 bg-[#F7F5F0]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-headline font-semibold text-base text-[#1E2F28] tracking-tight">Reglas de Promoción</h2>
              <p className="text-xs text-[#1A1A1A]/60 font-body">{promos.length} campañas configuradas</p>
            </div>
            <button onClick={() => setDraft(blank())} className="p-1.5 rounded-md bg-[#1E2F28] text-[#D4AF7C] hover:bg-[#2A3E35] transition-colors" title="Crear nueva regla"><span className="material-symbols-outlined text-sm">add</span></button>
          </div>
          <div className="flex items-center gap-1.5 p-1 bg-[#EAE6DD] rounded-lg border border-[#C9B89F]/40 text-xs">
            {([["todas", `Todas (${promos.length})`], ["hoy", `Activas hoy (${promos.filter((p) => p.status === "activa" && (!p.days.length || p.days.includes(today))).length})`], ["borradores", "Borradores"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className={filter === k ? "flex-1 py-1 px-2 rounded-md bg-white text-[#1E2F28] font-medium shadow-xs text-center transition-all" : "flex-1 py-1 px-2 rounded-md text-[#1A1A1A]/70 hover:text-[#1E2F28] text-center transition-all"}>{l}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {shown.map((p) => {
            const selected = p.id === draft?.id;
            const hours = p.startTime ? `${p.startTime} - ${p.endTime}` : "Todo el día";
            const zoneNames = p.zones.length ? p.zones.map((z) => zones.find((x) => x.id === z)?.name ?? "").filter(Boolean).join(" y ") : "Todo el local";
            return (
              <div key={p.id} onClick={() => setDraft({ ...p })} className={selected ? "relative bg-white rounded-lg p-3.5 border-2 border-[#D4AF7C] shadow-sm cursor-pointer transition-all hover:shadow-md" : "bg-white/80 hover:bg-white rounded-lg p-3.5 border border-[#C9B89F]/50 shadow-xs cursor-pointer transition-all hover:border-[#C9B89F]"}>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  {p.liveNow ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-[#D4AF7C]/20 text-[#1E2F28] border border-[#D4AF7C]/50"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /><span className="w-1.5 h-1.5 -ml-2.5 rounded-full bg-emerald-600" />ACTIVA AHORA</span>
                  ) : p.status === "activa" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide bg-[#EAE6DD] text-[#1E2F28] border border-[#C9B89F]/60"><span className="material-symbols-outlined text-[11px] text-[#1E2F28]/70">schedule</span>Programada</span>
                  ) : p.status === "pausada" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide bg-amber-50 text-amber-800 border border-amber-200"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Pausada</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide bg-[#EAE6DD] text-[#1A1A1A]/70">Borrador</span>
                  )}
                  <span className="text-[11px] font-mono text-[#1E2F28]/60">{hours}</span>
                </div>
                <h3 className="font-headline font-semibold text-sm text-[#1E2F28] leading-tight mb-1">{p.name}</h3>
                <p className="text-[11px] text-[#1A1A1A]/70 leading-relaxed mb-2.5">{daysLabel(p.days)} · {zoneNames}</p>
                <div className="flex items-center justify-between pt-2 border-t border-[#C9B89F]/20 text-[11px]">
                  <span className="inline-flex items-center gap-1 text-[#1E2F28] font-medium"><span className="material-symbols-outlined text-xs text-[#D4AF7C]">{KINDS.find((k) => k.kind === p.kind)!.icon}</span>{benefit(p)}</span>
                </div>
              </div>
            );
          })}
          {!shown.length && <p className="text-xs text-[#1A1A1A]/50 italic p-2">Sin promociones en este filtro.</p>}
          <div className="mt-4 p-3 rounded-lg bg-[#EAE6DD]/60 border border-[#C9B89F]/30 text-xs text-[#1E2F28]">
            <div className="flex items-center gap-2 mb-1 font-headline font-semibold"><span className="material-symbols-outlined text-xs text-[#B45A3C]">info</span><span>Prioridad de Motor Comercial</span></div>
            <p className="text-[11px] text-[#1A1A1A]/70 leading-normal">Si dos reglas se cruzan en un mismo ítem, CONVIVIUM aplica la de mayor beneficio al comensal para evitar fricciones.</p>
          </div>
        </div>
      </section>

      {draft && (
        <section className="col-span-6 flex flex-col h-screen bg-[#F7F5F0] overflow-hidden border-r border-[#C9B89F]/40">
          <div className="p-4 bg-white border-b border-[#C9B89F]/40 flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <input value={draft.name} onChange={(e) => set({ name: e.target.value })} className="font-headline font-bold text-lg text-[#1E2F28] border-0 border-b border-transparent hover:border-[#C9B89F] focus:border-[#D4AF7C] focus:ring-0 p-0 bg-transparent w-72 transition-colors" type="text" />
                {original?.liveNow && <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">Activa ahora en caja y comanderos</span>}
              </div>
              <div className="flex items-center gap-3 text-xs text-[#1A1A1A]/60">
                {original?.updatedAt ? <span>Última modificación: {new Date(original.updatedAt).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</span> : <span>Sin guardar</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setDraft({ ...draft, id: undefined, name: `${draft.name} (copia)`, status: "borrador" })} className="p-2 rounded-lg border border-[#C9B89F] hover:bg-[#EAE6DD] text-[#1E2F28] transition-colors" title="Duplicar Promoción"><span className="material-symbols-outlined text-sm">content_copy</span></button>
              {draft.id && <button onClick={archive} className="p-2 rounded-lg border border-[#C9B89F] hover:bg-red-50 hover:text-red-700 text-[#1E2F28] transition-colors" title="Archivar"><span className="material-symbols-outlined text-sm">archive</span></button>}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            <div>
              <label className="block text-xs font-semibold text-[#1E2F28] uppercase tracking-wider mb-2 font-headline">1. Tipo de Regla Promocional</label>
              <div className="grid grid-cols-4 gap-2.5">
                {KINDS.map((k) => draft.kind === k.kind ? (
                  <div key={k.kind} className="p-3 rounded-lg border-2 border-[#D4AF7C] bg-[#F7F5F0] shadow-xs cursor-pointer relative">
                    <div className="flex items-center justify-between mb-1.5"><span className="material-symbols-outlined text-[#1E2F28] font-medium">{k.icon}</span><span className="w-2 h-2 rounded-full bg-[#D4AF7C]" /></div>
                    <div className="font-headline font-semibold text-xs text-[#1E2F28]">{k.label}</div>
                    <div className="text-[10px] text-[#1A1A1A]/70 mt-0.5">{k.hint}</div>
                  </div>
                ) : (
                  <div key={k.kind} onClick={() => set({ kind: k.kind, value: k.kind === "porcentaje" ? 10 : 0 })} className="p-3 rounded-lg border border-[#C9B89F]/50 bg-white hover:border-[#C9B89F] cursor-pointer transition-colors">
                    <span className="material-symbols-outlined text-[#1A1A1A]/70 mb-1.5">{k.icon}</span>
                    <div className="font-headline font-semibold text-xs text-[#1E2F28]">{k.label}</div>
                    <div className="text-[10px] text-[#1A1A1A]/60 mt-0.5">{k.hint}</div>
                  </div>
                ))}
              </div>
              {draft.kind !== "dos_por_uno" && (
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span className="text-[#1A1A1A]/70 font-medium">{draft.kind === "porcentaje" ? "Descuento:" : draft.kind === "combo" ? "Precio del paquete:" : "Precio especial por unidad:"}</span>
                  {draft.kind !== "porcentaje" && <span className="font-mono text-[#1E2F28]">$</span>}
                  <input type="number" min={0} step={draft.kind === "porcentaje" ? 5 : 1} value={draft.kind === "porcentaje" ? draft.value : draft.value / 100} onChange={(e) => set({ value: draft.kind === "porcentaje" ? Math.round(Number(e.target.value)) : Math.round(Number(e.target.value) * 100) })} className="w-28 text-xs font-mono font-bold bg-white border border-[#C9B89F] rounded-md px-2.5 py-1.5 text-[#1E2F28] focus:border-[#D4AF7C] focus:ring-0" />
                  <span className="font-mono text-[#1E2F28]">{draft.kind === "porcentaje" ? "%" : "MXN"}</span>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg p-4 border border-[#C9B89F]/50 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#1E2F28] uppercase tracking-wider font-headline">2. Productos y Categorías Aplicables</label>
                <button onClick={() => setPicker(!picker)} className="text-xs text-[#1E2F28] font-medium hover:text-[#B8935F] flex items-center gap-1"><span className="material-symbols-outlined text-xs">{picker ? "expand_less" : "add"}</span>{picker ? "Cerrar" : "Agregar Ítem o Categoría"}</button>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {draft.categoryIds.map((id) => { const c = menu.categories.find((x) => x.id === id); return (
                  <span key={id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1E2F28] text-[#D4AF7C] text-xs font-medium"><span className="material-symbols-outlined text-xs">category</span>Cat: {c?.name ?? "—"} ({menu.products.filter((p) => p.categoryId === id && p.active).length})<button onClick={() => set({ categoryIds: draft.categoryIds.filter((x) => x !== id) })} className="hover:text-white"><span className="material-symbols-outlined text-[13px]">close</span></button></span>
                ); })}
                {draft.productIds.map((id) => { const p = menu.products.find((x) => x.id === id); return (
                  <span key={id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAE6DD] text-[#1E2F28] border border-[#C9B89F] text-xs font-medium"><span className="material-symbols-outlined text-xs">restaurant</span>{p?.name ?? "—"}<button onClick={() => set({ productIds: draft.productIds.filter((x) => x !== id) })} className="hover:text-[#B45A3C]"><span className="material-symbols-outlined text-[13px]">close</span></button></span>
                ); })}
                {!draft.categoryIds.length && !draft.productIds.length && <span className="text-[11px] text-[#1A1A1A]/50 italic">Sin productos todavía.</span>}
              </div>
              {picker && (
                <div className="bg-[#F7F5F0] rounded-md p-2.5 border border-[#C9B89F]/30 max-h-60 overflow-y-auto text-xs space-y-2">
                  {menu.categories.map((c) => (
                    <div key={c.id}>
                      {draft.kind !== "combo" && (
                        <label className="flex items-center gap-2 font-semibold text-[#1E2F28] cursor-pointer py-0.5">
                          <input type="checkbox" checked={draft.categoryIds.includes(c.id)} onChange={(e) => set({ categoryIds: e.target.checked ? [...draft.categoryIds, c.id] : draft.categoryIds.filter((x) => x !== c.id) })} className="rounded text-[#1E2F28] focus:ring-[#D4AF7C] border-[#C9B89F]" />
                          Toda la categoría {c.name}
                        </label>
                      )}
                      <div className="pl-5 grid grid-cols-2 gap-x-3">
                        {menu.products.filter((p) => p.categoryId === c.id && p.active).map((p) => (
                          <label key={p.id} className="flex items-center gap-2 cursor-pointer py-0.5 text-[#1A1A1A]/80">
                            <input type="checkbox" checked={draft.productIds.includes(p.id)} onChange={(e) => set({ productIds: e.target.checked ? [...draft.productIds, p.id] : draft.productIds.filter((x) => x !== p.id) })} className="rounded text-[#1E2F28] focus:ring-[#D4AF7C] border-[#C9B89F]" />
                            <span className="truncate">{p.name}</span><span className="font-mono text-[10px] text-[#1A1A1A]/50 ml-auto">{mxn(p.price)}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {affected.length > 0 && draft.kind !== "combo" && (
                <div className="bg-[#F7F5F0] rounded-md p-2.5 border border-[#C9B89F]/30 divide-y divide-[#C9B89F]/20 text-xs max-h-48 overflow-y-auto">
                  {affected.map((p) => (
                    <div key={p.id} className="py-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[#D4AF7C] text-sm">check_circle</span><span className="font-medium text-[#1E2F28]">{p.name}</span></div>
                      <span className="text-xs font-mono text-[#1A1A1A]/70">{mxn(p.price)} MXN (Normal) → <span className="font-semibold text-emerald-800">{draft.kind === "dos_por_uno" ? `2x1 (${mxn(Math.round(p.price / 2))} c/u)` : draft.kind === "porcentaje" ? mxn(Math.round(p.price * (1 - draft.value / 100))) : mxn(Math.min(p.price, draft.value))}</span></span>
                    </div>
                  ))}
                </div>
              )}
              {draft.kind === "combo" && affected.length >= 2 && (
                <div className="flex items-center gap-2 text-[11px] text-emerald-800 bg-emerald-50/70 p-2 rounded border border-emerald-200/80">
                  <span className="material-symbols-outlined text-xs">savings</span>
                  <span>Por separado: {mxn(affected.reduce((n, p) => n + p.price, 0))} → Paquete: {mxn(draft.value)} (ahorro {mxn(Math.max(0, affected.reduce((n, p) => n + p.price, 0) - draft.value))}). Se aplica cuando la cuenta tiene uno de cada producto.</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-4 border border-[#C9B89F]/50 shadow-xs">
                <label className="block text-xs font-semibold text-[#1E2F28] uppercase tracking-wider mb-2 font-headline">3. Días de la Semana</label>
                <div className="flex items-center justify-between gap-1 mb-2">
                  {WEEK.map(([d, l, name]) => draft.days.includes(d) ? (
                    <button key={d} title={name} onClick={() => set({ days: draft.days.filter((x) => x !== d) })} className="w-8 h-8 rounded-full bg-[#1E2F28] text-[#D4AF7C] font-semibold text-xs border border-[#1E2F28] shadow-xs hover:scale-105 transition-transform">{l}</button>
                  ) : (
                    <button key={d} title={name} onClick={() => set({ days: [...draft.days, d] })} className="w-8 h-8 rounded-full bg-[#EAE6DD]/50 text-[#1A1A1A]/40 font-medium text-xs border border-[#C9B89F]/40 hover:bg-[#EAE6DD]">{l}</button>
                  ))}
                </div>
                <div className="text-[11px] text-[#1E2F28]/80 flex items-center justify-between"><span>Vigencia: <strong>{daysLabel(draft.days)}</strong></span><span className="text-[#D4AF7C] font-medium">{draft.days.length || 7} días/sem</span></div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-[#C9B89F]/50 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-[#1E2F28] uppercase tracking-wider font-headline">4. Franja Horaria</label>
                  <label className="flex items-center gap-1 text-[10px] text-[#1A1A1A]/60"><input type="checkbox" checked={!draft.startTime} onChange={(e) => set(e.target.checked ? { startTime: null, endTime: null } : { startTime: "17:00", endTime: "20:00" })} className="rounded text-[#1E2F28] border-[#C9B89F]" />Todo el día</label>
                </div>
                {draft.startTime && draft.endTime ? (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1"><span className="text-[10px] text-[#1A1A1A]/60 block mb-0.5 font-medium">Inicio</span><input type="time" value={draft.startTime} onChange={(e) => set({ startTime: e.target.value })} className="w-full text-xs font-mono font-bold bg-[#F7F5F0] border border-[#C9B89F] rounded-md px-2.5 py-1.5 text-center text-[#1E2F28] focus:border-[#D4AF7C] focus:ring-0" /></div>
                      <span className="text-xs text-[#1A1A1A]/40 pt-4">a</span>
                      <div className="flex-1"><span className="text-[10px] text-[#1A1A1A]/60 block mb-0.5 font-medium">Cierre</span><input type="time" value={draft.endTime} onChange={(e) => set({ endTime: e.target.value })} className="w-full text-xs font-mono font-bold bg-[#F7F5F0] border border-[#C9B89F] rounded-md px-2.5 py-1.5 text-center text-[#1E2F28] focus:border-[#D4AF7C] focus:ring-0" /></div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#1A1A1A]/70">
                      <span>Duración: <strong>{(() => { const d = (toMin(draft.endTime) - toMin(draft.startTime) + 1440) % 1440; return `${Math.floor(d / 60)}h${d % 60 ? ` ${d % 60}m` : ""}`; })()}</strong>{toMin(draft.endTime) < toMin(draft.startTime) && " · cruza medianoche"}</span>
                      {original?.liveNow && <span className="text-emerald-700 font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />En curso</span>}
                    </div>
                  </>
                ) : <p className="text-[11px] text-[#1A1A1A]/60">Aplica en cualquier horario de los días elegidos.</p>}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-[#C9B89F]/50 shadow-xs space-y-3.5">
              <label className="block text-xs font-semibold text-[#1E2F28] uppercase tracking-wider font-headline">5. Zonas del Local</label>
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!draft.zones.length} onChange={(e) => set({ zones: e.target.checked ? [] : [zones[0]!.id] })} className="rounded text-[#1E2F28] focus:ring-[#D4AF7C] border-[#C9B89F] text-xs" /><span className="font-medium">Todo el local</span></label>
                {zones.map((z) => (
                  <label key={z.id} className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!draft.zones.length || draft.zones.includes(z.id)} onChange={(e) => { const base = draft.zones.length ? draft.zones : zones.map((x) => x.id); const next = e.target.checked ? [...base, z.id] : base.filter((x) => x !== z.id); set({ zones: next.length === zones.length ? [] : next }); }} className="rounded text-[#1E2F28] focus:ring-[#D4AF7C] border-[#C9B89F] text-xs" /><span>{z.name}</span></label>
                ))}
              </div>
            </div>

            <div className="bg-[#1E2F28] text-[#EAE6DD] rounded-lg p-4 shadow-sm space-y-3 border border-[#D4AF7C]/30">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#D4AF7C]">auto_fix_high</span>
                <div>
                  <h4 className="font-headline font-semibold text-sm text-[#D4AF7C]">Se aplica automáticamente en comanda</h4>
                  <p className="text-[11px] text-[#EAE6DD]/70">Caja y comanderos aplican el beneficio solos, sin PIN ni autorización del capitán. Se recalcula al agregar o cancelar productos.</p>
                </div>
              </div>
              <div className="pt-3 border-t border-[#C9B89F]/20 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[#C9B89F] text-sm">hourglass_top</span><span>Tolerancia de salida para mesas abiertas:</span></div>
                <div className="flex items-center gap-1">
                  <select value={draft.toleranceMin} onChange={(e) => set({ toleranceMin: Number(e.target.value) })} className="px-2 py-0.5 rounded bg-[#2A3E35] text-[#D4AF7C] font-mono font-bold border-0 text-xs focus:ring-0">
                    {[0, 5, 10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>+{m} min</option>)}
                  </select>
                  {draft.endTime && draft.toleranceMin > 0 && <span className="text-[10px] text-[#EAE6DD]/60">(hasta las {(() => { const t = (toMin(draft.endTime) + draft.toleranceMin) % 1440; return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; })()} hrs)</span>}
                </div>
              </div>
            </div>
            {err && <p className="text-xs text-[#B45A3C]">{err}</p>}
          </div>
          <div className="p-4 bg-white border-t border-[#C9B89F]/40 flex items-center justify-between">
            <button disabled={!dirty} onClick={() => setDraft(original ? { ...original } : blank())} className="px-3.5 py-2 rounded-lg text-xs font-medium text-[#1A1A1A]/70 hover:text-[#B45A3C] transition-colors disabled:opacity-40">Descartar cambios</button>
            <div className="flex items-center gap-2">
              {draft.id && draft.status === "activa" && <button onClick={() => save("pausada")} className="px-3.5 py-2 rounded-lg border border-[#C9B89F] text-[#1E2F28] hover:bg-[#EAE6DD] text-xs font-medium transition-colors flex items-center gap-1.5"><span className="material-symbols-outlined text-xs">pause_circle</span><span>Pausar Regla</span></button>}
              {!draft.id && <button onClick={() => save("borrador")} className="px-3.5 py-2 rounded-lg border border-[#C9B89F] text-[#1E2F28] hover:bg-[#EAE6DD] text-xs font-medium transition-colors">Guardar borrador</button>}
              <button onClick={() => save("activa")} className="px-5 py-2 rounded-lg bg-[#1E2F28] hover:bg-[#2A3E35] text-[#D4AF7C] text-xs font-semibold tracking-wide flex items-center gap-2 shadow-sm transition-all border border-[#D4AF7C]/40"><span className="material-symbols-outlined text-sm">cloud_done</span><span>{draft.status === "activa" ? "Guardar y Publicar" : "Publicar en Caja y Comanderos"}</span></button>
            </div>
          </div>
        </section>
      )}

      <section className="col-span-3 flex flex-col h-screen bg-[#F7F5F0] overflow-y-auto p-4 space-y-4">
        <div className="bg-white rounded-lg p-4 border border-[#C9B89F]/50 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-headline font-semibold text-xs uppercase tracking-wider text-[#1E2F28]">Matriz Semanal</h3>
            <Conflicts promos={promos.filter((p) => p.status === "activa")} />
          </div>
          <p className="text-[11px] text-[#1A1A1A]/60 mb-3">Distribución de las promociones activas por día.</p>
          <div className="space-y-1.5 text-[11px]">
            <div className="grid grid-cols-7 text-center font-mono text-[10px] text-[#1A1A1A]/60 pb-1 border-b border-[#C9B89F]/30">{WEEK.map(([d, l]) => <span key={d}>{l}</span>)}</div>
            {promos.filter((p) => p.status === "activa").map((p) => (
              <div key={p.id} onClick={() => setDraft({ ...p })} className={p.liveNow ? "p-2 rounded bg-[#D4AF7C]/15 border border-[#D4AF7C] relative cursor-pointer" : "p-2 rounded bg-[#EAE6DD]/70 border border-[#C9B89F]/60 cursor-pointer"}>
                <div className="flex items-center justify-between font-semibold text-[#1E2F28] text-[10px]">
                  <span className="flex items-center gap-1">{p.liveNow && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />}{p.name}</span>
                  <span className="font-mono text-[9px]">{p.startTime ? `${p.startTime} - ${p.endTime}` : "Todo el día"}</span>
                </div>
                <div className="grid grid-cols-7 gap-1 mt-1.5">{WEEK.map(([d, , name]) => <span key={d} className={`h-2 rounded ${!p.days.length || p.days.includes(d) ? (p.liveNow ? "bg-[#D4AF7C]" : "bg-[#B45A3C]") : "bg-[#EAE6DD]"}`} title={`${name}${!p.days.length || p.days.includes(d) ? " activo" : " inactivo"}`} />)}</div>
              </div>
            ))}
            {!promos.some((p) => p.status === "activa") && <p className="text-[11px] text-[#1A1A1A]/50 italic">No hay promociones activas.</p>}
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-[#C9B89F]/50 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-headline font-semibold text-xs uppercase tracking-wider text-[#1E2F28]">Impacto de Hoy</h3>
            <span className="text-[10px] font-mono text-[#D4AF7C] bg-[#1E2F28] px-1.5 py-0.5 rounded">En vivo</span>
          </div>
          <div className="p-2.5 rounded bg-[#F7F5F0] border border-[#C9B89F]/30 flex items-center justify-between">
            <div><span className="text-[10px] text-[#1A1A1A]/60 block">Bonificado hoy</span><span className="font-headline font-bold text-base text-[#1E2F28]">{mxn(impact?.totalDiscount ?? 0)} MXN</span></div>
            <div className="text-right"><span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">{impact?.checks ?? 0} cuentas</span></div>
          </div>
          {draft?.id && (
            <div className="p-2.5 rounded bg-[#F7F5F0] border border-[#C9B89F]/30 flex items-center justify-between">
              <div><span className="text-[10px] text-[#1A1A1A]/60 block">Esta promoción hoy</span><span className="font-headline font-bold text-base text-[#1E2F28]">{mxn(impact?.byPromotion.find((b) => b.id === draft.id)?.discount ?? 0)} MXN</span></div>
              <div className="text-right"><span className="text-[10px] font-semibold text-emerald-800">{impact?.byPromotion.find((b) => b.id === draft.id)?.checks ?? 0} cuentas</span></div>
            </div>
          )}
          {impact?.topProduct && (
            <div className="text-xs pt-1">
              <span className="text-[10px] text-[#1A1A1A]/60 uppercase tracking-wider font-semibold block mb-1">Ítem más ordenado en promo:</span>
              <div className="flex items-center gap-2 p-2 rounded bg-[#EAE6DD]/40 border border-[#C9B89F]/30">
                <span className="material-symbols-outlined text-[#D4AF7C] text-lg">local_offer</span>
                <div className="flex-1 min-w-0"><span className="font-medium text-[#1E2F28] text-xs truncate block">{impact.topProduct.name}</span><span className="text-[10px] text-[#1A1A1A]/60">{impact.topProduct.quantity} unidades</span></div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

/** Campos editables (sin metadatos del servidor) para comparar y enviar. */
function strip(p: Promo) {
  const { name, kind, value, productIds, categoryIds, days, startTime, endTime, zones, toleranceMin, status } = p;
  return { name, kind, value, productIds, categoryIds, days, startTime, endTime, zones, toleranceMin, status };
}

/** Avisa si dos promociones activas coinciden en día y horario (la de mayor beneficio gana, pero conviene saberlo). */
function Conflicts({ promos }: { promos: Promo[] }) {
  const overlap = (a: Promo, b: Promo) => {
    const days = (p: Promo) => (p.days.length ? p.days : [0, 1, 2, 3, 4, 5, 6]);
    if (!days(a).some((d) => days(b).includes(d))) return false;
    if (!a.startTime || !b.startTime) return true;
    const range = (p: Promo) => { const s = toMin(p.startTime!), e = toMin(p.endTime!); return e > s ? [[s, e]] : [[s, 1440], [0, e]]; };
    return range(a).some(([s1, e1]) => range(b).some(([s2, e2]) => s1! < e2! && s2! < e1!));
  };
  const n = promos.flatMap((a, i) => promos.slice(i + 1).filter((b) => overlap(a, b))).length;
  return n === 0
    ? <span className="inline-flex items-center gap-1 text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"><span className="material-symbols-outlined text-[10px]">verified</span>Sin cruces</span>
    : <span className="inline-flex items-center gap-1 text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200" title="Coinciden en día y horario: se aplica la de mayor beneficio"><span className="material-symbols-outlined text-[10px]">warning</span>{n} {n === 1 ? "cruce" : "cruces"}</span>;
}
