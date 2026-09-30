/* Nueva orden de compra manual (E8-02). Componentes y clases del diseño Stitch admin-compras-oc. */
import { client } from "@convivium/app-shell";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

interface Supplier { id: string; name: string; tradeName: string | null; active: boolean; deliveryDays: string[] | null; minOrder?: number }
interface Detail { id: string; minOrder: number; deliveryDays: string[] | null; creditDays: number; priceList: { ingredientId: string; name: string; purchaseUnit: string; unitPrice: number; changePct: number | null }[] }
interface Suggestion { ingredientId: string; stock: number; minStock: number; useUnit: string; suggestedQty: number; supplierId: string | null }
interface Warehouse { id: string; name: string }
interface Line { ingredientId: string; quantity: number; unitPrice: number }

const money = (c: number) => `$${(c / 100).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;

export function NewPurchasePage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [supplierId, setSupplierId] = useState(params.get("proveedor") ?? "");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [adding, setAdding] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const canApprove = !!client.session?.permissions.includes("compras.aprobar_oc");

  useEffect(() => {
    client.request<Supplier[]>("GET", "/purchasing/suppliers").then((l) => setSuppliers(l.filter((s) => s.active)));
    client.request<Warehouse[]>("GET", "/inventory/warehouses").then((w) => { setWarehouses(w); setWarehouseId((x) => x || w[0]?.id || ""); });
    client.request<Suggestion[]>("GET", "/inventory/purchase-suggestions").then(setSuggestions).catch(() => setSuggestions([]));
  }, []);
  useEffect(() => {
    setLines([]); setDetail(null);
    if (supplierId) client.request<Detail>("GET", `/purchasing/suppliers/${supplierId}`).then(setDetail);
  }, [supplierId]);

  const price = (id: string) => detail?.priceList.find((p) => p.ingredientId === id);
  const sugg = (id: string) => suggestions.find((s) => s.ingredientId === id);
  const subtotal = lines.reduce((n, l) => n + Math.round(l.quantity * l.unitPrice), 0);
  const belowMin = !!detail?.minOrder && subtotal < detail.minOrder;
  const lowStock = useMemo(() => (detail?.priceList ?? []).filter((p) => sugg(p.ingredientId) && !lines.some((l) => l.ingredientId === p.ingredientId)), [detail, suggestions, lines]);

  const add = (id: string, qty?: number) => {
    const p = price(id);
    if (!p || lines.some((l) => l.ingredientId === id)) return;
    setLines((ls) => [...ls, { ingredientId: id, quantity: qty ?? Math.max(1, Math.ceil(sugg(id)?.suggestedQty ?? 1)), unitPrice: p.unitPrice }]);
  };
  const patch = (id: string, p: Partial<Line>) => setLines((ls) => ls.map((l) => (l.ingredientId === id ? { ...l, ...p } : l)));

  const submit = async (approve: boolean) => {
    setErr(""); setSaving(true);
    try {
      const po = await client.request<{ id: string }>("POST", "/purchasing/purchase-orders", { supplierId, warehouseId, expectedAt: expectedAt || undefined, lines: lines.filter((l) => l.quantity > 0) });
      if (approve) await client.request("POST", `/purchasing/purchase-orders/${po.id}/approve`);
      nav(`/compras?oc=${po.id}`);
    } catch (e) { setErr((e as Error).message); } finally { setSaving(false); }
  };

  const sup = suppliers.find((s) => s.id === supplierId);
  return (
    <main className="flex-1 flex h-screen overflow-hidden bg-marfil">
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-terracota">Compras</span>
          <h1 className="font-serif-brand text-2xl font-bold text-stone-900">Nueva orden de compra</h1>
          <div className="flex items-center gap-2 mt-3 text-xs">
            {["Proveedor", "Insumos", "Revisar y enviar"].map((s, i) => {
              const step = !supplierId ? 0 : !lines.length ? 1 : 2;
              return <span key={s} className={`flex items-center gap-1.5 ${i <= step ? "text-olivo font-semibold" : "text-stone-400"}`}><span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${i <= step ? "bg-olivo text-dorado" : "bg-stone-200 text-stone-500"}`}>{i + 1}</span>{s}{i < 2 && <span className="text-stone-300 mx-1">—</span>}</span>;
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-arena-border p-5 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <label><span className="block font-semibold text-stone-700 mb-1.5">Proveedor</span>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full bg-marfil-canvas/40 border border-arena-border rounded-lg px-3 py-2"><option value="">Elegir…</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.tradeName || s.name}</option>)}</select>
            {detail && <span className="block text-[10px] text-stone-500 mt-1">Entrega {detail.deliveryDays?.join(" · ") || "sin días definidos"} · mínimo {money(detail.minOrder)} · crédito {detail.creditDays} días</span>}
          </label>
          <label><span className="block font-semibold text-stone-700 mb-1.5">Almacén destino</span><select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="w-full bg-marfil-canvas/40 border border-arena-border rounded-lg px-3 py-2">{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
          <label><span className="block font-semibold text-stone-700 mb-1.5">Fecha esperada de entrega</span><input type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} className="w-full bg-marfil-canvas/40 border border-arena-border rounded-lg px-3 py-2" /></label>
        </div>

        {detail && (
          <div className="bg-white rounded-xl border border-arena-border p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-arena-light">
              <h3 className="font-serif-brand text-base font-semibold text-stone-900">Insumos</h3>
              <div className="flex items-center gap-2 text-xs">
                <select value={adding} onChange={(e) => setAdding(e.target.value)} className="border border-arena-border rounded-lg px-2 py-1.5"><option value="">Agregar de la lista de precios…</option>{detail.priceList.filter((p) => !lines.some((l) => l.ingredientId === p.ingredientId)).map((p) => <option key={p.ingredientId} value={p.ingredientId}>{p.name} · {money(p.unitPrice)} / {p.purchaseUnit}</option>)}</select>
                <button disabled={!adding} onClick={() => { add(adding); setAdding(""); }} className="font-semibold text-olivo bg-stone-100 px-3 py-1.5 rounded-lg border border-arena-border disabled:opacity-40">+ Agregar insumo</button>
                <button disabled={!lowStock.length} onClick={() => lowStock.forEach((p) => add(p.ingredientId))} className="font-semibold text-olivo bg-dorado/20 px-3 py-1.5 rounded-lg border border-dorado/50 disabled:opacity-40">Agregar sugeridos bajo mínimo ({lowStock.length})</button>
              </div>
            </div>
            {!detail.priceList.length && <p className="text-xs text-stone-500">Este proveedor no tiene lista de precios. Agrégala en Proveedores.</p>}
            <table className="w-full text-xs">
              <thead><tr className="text-[11px] uppercase tracking-wider text-stone-500"><th className="text-left py-2">Insumo</th><th className="text-right py-2">Existencia</th><th className="text-right py-2">Mínimo</th><th className="text-right py-2">Sugerido</th><th className="text-center py-2">Cantidad</th><th className="text-right py-2">Precio unitario</th><th className="text-right py-2">Importe</th><th /></tr></thead>
              <tbody className="divide-y divide-stone-100">
                {lines.map((l) => {
                  const p = price(l.ingredientId)!, s = sugg(l.ingredientId);
                  return (
                    <tr key={l.ingredientId}>
                      <td className="py-2 font-medium text-stone-800">
                        <span className="flex items-center gap-2">{p.name}{s && <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${s.stock <= s.minStock / 2 ? "bg-terracota/10 text-terracota border-terracota/30" : "bg-amber-50 text-amber-800 border-amber-200"}`}><span className="material-symbols-outlined text-[12px]">{s.stock <= s.minStock / 2 ? "warning" : "schedule"}</span>{s.stock <= s.minStock / 2 ? "Stock crítico" : "Bajo mínimo"}</span>}</span>
                        <span className="block text-[10px] text-stone-400">{p.purchaseUnit}</span>
                      </td>
                      <td className="py-2 text-right font-mono">{s ? `${s.stock} ${s.useUnit}` : "—"}</td>
                      <td className="py-2 text-right font-mono">{s ? `${s.minStock} ${s.useUnit}` : "—"}</td>
                      <td className="py-2 text-right">{s ? <span className="text-[10px] font-semibold bg-dorado/25 text-stone-800 px-1.5 py-0.5 rounded">{s.suggestedQty}</span> : "—"}</td>
                      <td className="py-2 text-center">
                        <div className="inline-flex items-center border border-arena-border rounded-lg overflow-hidden">
                          <button onClick={() => patch(l.ingredientId, { quantity: Math.max(0, l.quantity - 1) })} className="w-7 h-7 hover:bg-stone-100">−</button>
                          <input type="number" min={0} step="0.5" value={l.quantity} onChange={(e) => patch(l.ingredientId, { quantity: Number(e.target.value) })} className="w-14 text-center font-mono border-0 p-0 focus:ring-0" />
                          <button onClick={() => patch(l.ingredientId, { quantity: l.quantity + 1 })} className="w-7 h-7 hover:bg-stone-100">+</button>
                        </div>
                      </td>
                      <td className="py-2 text-right"><input type="number" min={0} step="0.5" value={l.unitPrice / 100} onChange={(e) => patch(l.ingredientId, { unitPrice: Math.round(Number(e.target.value) * 100) })} className="w-24 text-right font-mono border border-arena-border rounded px-2 py-1" />{l.unitPrice !== p.unitPrice && <span className="block text-[10px] text-amber-700">Lista: {money(p.unitPrice)}</span>}</td>
                      <td className="py-2 text-right font-mono font-semibold">{money(Math.round(l.quantity * l.unitPrice))}</td>
                      <td className="py-2 text-right"><button onClick={() => setLines(lines.filter((x) => x.ingredientId !== l.ingredientId))} className="text-stone-400 hover:text-terracota"><span className="material-symbols-outlined text-sm">close</span></button></td>
                    </tr>
                  );
                })}
                {!lines.length && <tr><td colSpan={8} className="py-6 text-center text-stone-500 italic">Agrega insumos de la lista de precios del proveedor.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <aside className="w-80 shrink-0 border-l border-arena-border bg-white p-6 flex flex-col gap-4">
        <h3 className="font-serif-brand text-base font-semibold text-stone-900">Resumen</h3>
        <div className="text-xs space-y-2">
          <div className="flex justify-between"><span className="text-stone-500">Proveedor</span><span className="font-medium text-right">{sup ? sup.tradeName || sup.name : "—"}</span></div>
          <div className="flex justify-between"><span className="text-stone-500">Insumos</span><span className="font-mono">{lines.length}</span></div>
          <div className="flex justify-between pt-2 border-t border-arena-light text-sm"><span className="font-semibold">Total estimado</span><span className="font-mono font-bold">{money(subtotal)}</span></div>
          <p className="text-[10px] text-stone-400">Precios de lista del proveedor; el importe final se confirma al recibir con su factura.</p>
        </div>
        {belowMin && <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">Por debajo del pedido mínimo del proveedor ({money(detail!.minOrder)}).</div>}
        {!canApprove && <div className="p-3 rounded-lg bg-marfil-canvas/60 border border-arena-border text-[11px] text-stone-600">Requiere aprobación de gerente: el almacenista la propone y el gerente la aprueba y envía.</div>}
        {err && <p className="text-xs text-terracota">{err}</p>}
        <div className="mt-auto space-y-2">
          <button disabled={saving || !supplierId || !warehouseId || !lines.some((l) => l.quantity > 0)} onClick={() => submit(false)} className="w-full py-2.5 rounded-lg border border-arena-border text-xs font-semibold text-olivo disabled:opacity-40">{canApprove ? "Guardar borrador" : "Enviar a aprobación"}</button>
          {canApprove && <button disabled={saving || !supplierId || !warehouseId || !lines.some((l) => l.quantity > 0)} onClick={() => submit(true)} className="w-full py-2.5 rounded-lg bg-olivo text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"><span className="material-symbols-outlined text-sm text-dorado">verified</span>Aprobar y continuar al envío</button>}
        </div>
      </aside>
    </main>
  );
}
