/* Proveedores (E8-01). Componentes y clases del sistema de diseño Stitch (admin-compras-oc, admin-cxp). */
import { client } from "@convivium/app-shell";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

interface Supplier { id: string; name: string; tradeName: string | null; categories: string[]; deliveryDays: string[] | null; balance: number; active: boolean }
interface Detail extends Omit<Supplier, "balance"> {
  rfc: string | null; contactName: string | null; phone: string | null; email: string | null; creditDays: number; minOrder: number; notes: string | null;
  priceList: { ingredientId: string; name: string; purchaseUnit: string; unitPrice: number; validFrom: string; previousPrice: number | null; changePct: number | null }[];
  stats: { purchases90d: number; receipts90d: number; openOrders: number; balance: number; nextDue: string | null; overdue: boolean };
}
interface Ingredient { id: string; name: string; purchaseUnit: string }
type Form = Omit<Detail, "id" | "priceList" | "stats" | "deliveryDays"> & { deliveryDays: string[] };

const money = (c: number) => `$${(c / 100).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
const DAYS: [string, string][] = [["L", "Lunes"], ["M", "Martes"], ["X", "Miércoles"], ["J", "Jueves"], ["V", "Viernes"], ["S", "Sábado"], ["D", "Domingo"]];
const CATS = ["Carnes", "Abarrotes", "Frutas y verduras", "Lácteos", "Bebidas", "Licores", "Desechables", "Limpieza"];
const blank = (): Form => ({ name: "", tradeName: "", rfc: "", contactName: "", phone: "", email: "", creditDays: 0, deliveryDays: [], categories: [], minOrder: 0, notes: "", active: true });

export function SuppliersPage() {
  const nav = useNavigate();
  const [list, setList] = useState<Supplier[]>([]);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | "new" | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [form, setForm] = useState<Form>(blank());
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [adding, setAdding] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const canEdit = !!client.session?.permissions.includes("compras.aprobar_oc");

  const load = useCallback(() => client.request<Supplier[]>("GET", "/purchasing/suppliers").then((l) => { setList(l); return l; }), []);
  useEffect(() => {
    load().then((l) => setSel((s) => s ?? l[0]?.id ?? "new"));
    client.request<Ingredient[]>("GET", "/inventory/ingredients").then(setIngredients);
  }, [load]);
  useEffect(() => {
    setMsg(null);
    if (!sel || sel === "new") { setDetail(null); setForm(blank()); setPrices({}); return; }
    client.request<Detail>("GET", `/purchasing/suppliers/${sel}`).then((d) => {
      setDetail(d);
      setForm({ name: d.name, tradeName: d.tradeName ?? "", rfc: d.rfc ?? "", contactName: d.contactName ?? "", phone: d.phone ?? "", email: d.email ?? "", creditDays: d.creditDays, deliveryDays: d.deliveryDays ?? [], categories: d.categories, minOrder: d.minOrder, notes: d.notes ?? "", active: d.active });
      setPrices(Object.fromEntries(d.priceList.map((p) => [p.ingredientId, p.unitPrice])));
    });
  }, [sel]);

  const shown = useMemo(() => list.filter((s) => `${s.name} ${s.tradeName ?? ""} ${s.categories.join(" ")}`.toLowerCase().includes(q.toLowerCase())), [list, q]);
  const set = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));
  const nul = (v: string | null) => (v && v.trim() ? v.trim() : null);

  const save = async () => {
    setMsg(null);
    const body = { ...form, tradeName: nul(form.tradeName), rfc: nul(form.rfc)?.toUpperCase() ?? null, contactName: nul(form.contactName), phone: nul(form.phone), email: nul(form.email), notes: nul(form.notes) };
    try {
      const saved = sel === "new" ? await client.request<{ id: string }>("POST", "/purchasing/suppliers", body) : await client.request<{ id: string }>("PUT", `/purchasing/suppliers/${sel}`, body);
      const id = sel === "new" ? saved.id : sel!;
      const current = detail?.priceList ?? [];
      const removed = current.filter((p) => !(p.ingredientId in prices)).map((p) => p.ingredientId);
      await client.request("PUT", `/purchasing/suppliers/${id}/prices`, { prices: Object.entries(prices).map(([ingredientId, unitPrice]) => ({ ingredientId, unitPrice })), removed });
      await load();
      setSel(null); setTimeout(() => setSel(id));
      setMsg({ ok: true, text: "Proveedor guardado." });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  };

  const days = (d: string[] | null) => (d?.length ? d.join(" · ") : "Sin días de entrega");

  return (
    <main className="flex-1 flex h-screen overflow-hidden bg-marfil">
      <section className="w-80 bg-marfil-card border-r border-arena-border flex flex-col shrink-0">
        <div className="p-4 border-b border-arena-border/70 space-y-3 bg-marfil/40">
          <div className="flex items-center justify-between">
            <div><h2 className="font-serif-brand text-lg font-bold text-stone-900">Proveedores</h2><p className="text-[11px] text-stone-500">{list.filter((s) => s.active).length} activos</p></div>
            {canEdit && <button onClick={() => setSel("new")} className="bg-olivo hover:bg-olivo-hover text-white text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-xs"><span className="material-symbols-outlined text-sm">add</span>Nuevo</button>}
          </div>
          <div className="relative"><span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm">search</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o categoría..." className="w-full bg-white/90 border border-arena-border text-xs rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-olivo" /></div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-arena-border/50">
          {shown.map((s) => (
            <div key={s.id} onClick={() => setSel(s.id)} className={sel === s.id ? "p-3.5 bg-dorado/10 border-l-4 border-dorado cursor-pointer" : `p-3.5 hover:bg-stone-50/80 cursor-pointer ${s.active ? "" : "opacity-50"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><h4 className="text-xs font-semibold text-stone-900 font-serif-brand truncate">{s.tradeName || s.name}</h4><p className="text-[10px] text-stone-500 truncate">{days(s.deliveryDays)}</p></div>
                {s.balance > 0 && <span className="text-[10px] font-mono font-semibold text-terracota bg-terracota/10 border border-terracota/20 px-1.5 py-0.5 rounded shrink-0">{money(s.balance)}</span>}
              </div>
              <div className="flex flex-wrap gap-1 mt-1.5">{s.categories.map((c) => <span key={c} className="text-[9px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200">{c}</span>)}{!s.active && <span className="text-[9px] px-1.5 py-0.5 rounded bg-stone-200 text-stone-600">Inactivo</span>}</div>
            </div>
          ))}
          {!shown.length && <p className="p-4 text-xs text-stone-500 italic">Sin proveedores.</p>}
        </div>
      </section>

      {sel && (
        <section className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-y-auto p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div><span className="text-[11px] font-bold uppercase tracking-[0.2em] text-terracota">Compras</span><h1 className="font-serif-brand text-2xl font-bold text-stone-900">{sel === "new" ? "Nuevo proveedor" : form.tradeName || form.name}</h1></div>
              {detail && <button onClick={() => nav(`/compras/nueva?proveedor=${detail.id}`)} className="px-4 py-2 rounded-lg bg-olivo text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"><span className="material-symbols-outlined text-sm text-dorado">add_shopping_cart</span>Generar nueva compra</button>}
            </div>

            <div className="bg-white rounded-xl border border-arena-border p-6 shadow-xs">
              <h3 className="font-serif-brand text-base font-semibold text-stone-900 mb-4 pb-2 border-b border-arena-light">Datos del proveedor</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {([["name", "Razón social *"], ["tradeName", "Nombre comercial"], ["rfc", "RFC"], ["contactName", "Contacto"], ["phone", "Teléfono / WhatsApp"], ["email", "Correo"]] as const).map(([k, l]) => (
                  <label key={k}><span className="block font-semibold text-stone-700 mb-1.5">{l}</span><input disabled={!canEdit} value={(form[k] as string) ?? ""} onChange={(e) => set({ [k]: k === "rfc" ? e.target.value.toUpperCase() : e.target.value } as Partial<Form>)} className={`w-full bg-marfil-canvas/40 border border-arena-border rounded-lg px-3 py-2 focus:bg-white focus:ring-1 focus:ring-olivo ${k === "rfc" ? "font-mono" : ""}`} /></label>
                ))}
                <label><span className="block font-semibold text-stone-700 mb-1.5">Días de crédito</span><input disabled={!canEdit} type="number" min={0} value={form.creditDays} onChange={(e) => set({ creditDays: Number(e.target.value) })} className="w-full bg-marfil-canvas/40 border border-arena-border rounded-lg px-3 py-2 font-mono" /></label>
                <label><span className="block font-semibold text-stone-700 mb-1.5">Pedido mínimo (MXN)</span><input disabled={!canEdit} type="number" min={0} value={form.minOrder / 100} onChange={(e) => set({ minOrder: Math.round(Number(e.target.value) * 100) })} className="w-full bg-marfil-canvas/40 border border-arena-border rounded-lg px-3 py-2 font-mono" /></label>
                <div className="md:col-span-2"><span className="block font-semibold text-stone-700 mb-1.5">Días de entrega</span>
                  <div className="flex gap-1.5">{DAYS.map(([d, name]) => { const on = form.deliveryDays.includes(d); return <button key={d} disabled={!canEdit} title={name} onClick={() => set({ deliveryDays: on ? form.deliveryDays.filter((x) => x !== d) : [...form.deliveryDays, d] })} className={on ? "w-9 h-9 rounded-full bg-olivo text-dorado font-semibold border border-olivo" : "w-9 h-9 rounded-full bg-marfil-canvas/60 text-stone-400 border border-arena-border"}>{d}</button>; })}</div>
                </div>
                <div className="md:col-span-2"><span className="block font-semibold text-stone-700 mb-1.5">Categorías</span>
                  <div className="flex flex-wrap gap-1.5">{CATS.map((c) => { const on = form.categories.includes(c); return <button key={c} disabled={!canEdit} onClick={() => set({ categories: on ? form.categories.filter((x) => x !== c) : [...form.categories, c] })} className={on ? "px-3 py-1 rounded-full bg-olivo text-dorado text-[11px] font-medium" : "px-3 py-1 rounded-full bg-white border border-arena-border text-stone-600 text-[11px]"}>{c}</button>; })}</div>
                </div>
                <label className="md:col-span-2"><span className="block font-semibold text-stone-700 mb-1.5">Notas</span><textarea disabled={!canEdit} rows={2} value={form.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} className="w-full bg-marfil-canvas/40 border border-arena-border rounded-lg p-2.5 resize-none" /></label>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-arena-border p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-arena-light">
                <h3 className="font-serif-brand text-base font-semibold text-stone-900">Lista de precios</h3>
                <div className="flex items-center gap-2">
                  <select value={adding} onChange={(e) => setAdding(e.target.value)} className="text-xs border border-arena-border rounded-lg px-2 py-1.5"><option value="">Agregar insumo…</option>{ingredients.filter((i) => !(i.id in prices)).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
                  <button disabled={!adding} onClick={() => { setPrices({ ...prices, [adding]: 0 }); setAdding(""); }} className="text-xs font-semibold text-olivo bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-lg border border-arena-border disabled:opacity-40">+ Agregar</button>
                </div>
              </div>
              <table className="w-full text-xs">
                <thead><tr className="text-[11px] uppercase tracking-wider text-stone-500 border-b border-arena-light"><th className="text-left py-2">Insumo</th><th className="text-left py-2">Presentación de compra</th><th className="text-right py-2">Precio</th><th className="text-right py-2">Actualizado</th><th className="text-right py-2">Variación</th><th /></tr></thead>
                <tbody className="divide-y divide-stone-100">
                  {Object.keys(prices).map((id) => {
                    const cur = detail?.priceList.find((p) => p.ingredientId === id);
                    const ing = ingredients.find((i) => i.id === id);
                    return (
                      <tr key={id}>
                        <td className="py-2 font-medium text-stone-800">{cur?.name ?? ing?.name}</td>
                        <td className="py-2 text-stone-500">{cur?.purchaseUnit ?? ing?.purchaseUnit}</td>
                        <td className="py-2 text-right"><span className="text-stone-400 mr-1">$</span><input type="number" min={0} step="0.5" value={prices[id]! / 100} onChange={(e) => setPrices({ ...prices, [id]: Math.round(Number(e.target.value) * 100) })} className="w-24 text-right font-mono border border-arena-border rounded px-2 py-1" /></td>
                        <td className="py-2 text-right text-stone-500 font-mono">{cur?.validFrom ?? "Nuevo"}</td>
                        <td className="py-2 text-right font-mono">{cur?.changePct != null ? <span className={cur.changePct > 0 ? "text-terracota" : "text-emerald-700"}><span className="material-symbols-outlined text-[12px] align-middle">{cur.changePct > 0 ? "arrow_upward" : "arrow_downward"}</span>{Math.abs(cur.changePct)}%</span> : "—"}</td>
                        <td className="py-2 text-right"><button onClick={() => { const n = { ...prices }; delete n[id]; setPrices(n); }} className="text-stone-400 hover:text-terracota"><span className="material-symbols-outlined text-sm">delete</span></button></td>
                      </tr>
                    );
                  })}
                  {!Object.keys(prices).length && <tr><td colSpan={6} className="py-4 text-center text-stone-500 italic">Sin insumos en la lista de precios.</td></tr>}
                </tbody>
              </table>
            </div>
            {msg && <p className={`text-xs ${msg.ok ? "text-emerald-700" : "text-terracota"}`}>{msg.text}</p>}
            <div className="flex justify-between">
              {sel !== "new" && canEdit ? <button onClick={() => set({ active: !form.active })} className="px-4 py-2 rounded-lg border border-arena-border text-xs text-stone-700">{form.active ? "Desactivar proveedor" : "Reactivar proveedor"}</button> : <span />}
              <button disabled={!form.name.trim()} onClick={save} className="px-5 py-2 rounded-lg bg-olivo text-white text-xs font-semibold shadow-sm disabled:opacity-40 flex items-center gap-1.5"><span className="material-symbols-outlined text-sm text-dorado">check_circle</span>Guardar</button>
            </div>
          </div>

          {detail && (
            <aside className="w-72 shrink-0 border-l border-arena-border bg-white p-5 space-y-3 overflow-y-auto">
              {[["Compras últimos 90 días", money(detail.stats.purchases90d), `${detail.stats.receipts90d} recepciones`, "shopping_bag"], ["Órdenes abiertas", String(detail.stats.openOrders), "Borrador, aprobadas o enviadas", "receipt_long"]].map(([t, v, s, i]) => (
                <div key={t} className="p-4 rounded-lg bg-marfil-canvas/40 border border-arena-border"><div className="flex items-center justify-between text-[11px] text-stone-500"><span>{t}</span><span className="material-symbols-outlined text-base text-olivo">{i}</span></div><span className="font-serif-brand text-xl font-bold text-stone-900">{v}</span><span className="block text-[10px] text-stone-400">{s}</span></div>
              ))}
              <div className={`p-4 rounded-lg border ${detail.stats.overdue ? "bg-terracota/5 border-terracota/30" : "bg-marfil-canvas/40 border-arena-border"}`}>
                <div className="flex items-center justify-between text-[11px] text-stone-500"><span>Saldo por pagar</span><span className="material-symbols-outlined text-base text-terracota">account_balance_wallet</span></div>
                <span className={`font-serif-brand text-xl font-bold ${detail.stats.balance ? "text-terracota" : "text-stone-900"}`}>{money(detail.stats.balance)}</span>
                <span className="block text-[10px] text-stone-500">{detail.stats.overdue ? "Tiene pagos vencidos" : detail.stats.nextDue ? `Próximo vencimiento ${detail.stats.nextDue}` : "Sin pagos pendientes"}</span>
                {detail.stats.balance > 0 && <button onClick={() => nav("/cxp")} className="mt-2 text-xs text-olivo font-semibold hover:underline">Ir a cuentas por pagar →</button>}
              </div>
              <p className="text-[11px] text-stone-500 leading-relaxed">{form.deliveryDays.length ? `Entrega: ${form.deliveryDays.map((d) => DAYS.find((x) => x[0] === d)![1]).join(", ")}.` : ""} {form.minOrder ? `Pedido mínimo ${money(form.minOrder)}.` : ""} {form.creditDays ? `Crédito ${form.creditDays} días.` : "Pago de contado."}</p>
            </aside>
          )}
        </section>
      )}
    </main>
  );
}
