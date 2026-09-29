/* Diseño: design/stitch/admin-compras-oc.html (Stitch). Marcado y clases originales; datos reales. E7-12, E8-01, E8-02. */
import { client } from "@convivium/app-shell";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PurchasingApi, type PurchaseOrder, type Suggestion } from "./api";

const money = (c: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(c / 100);
const fmt = (n: number) => new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(n);
const STATUS: Record<string, { label: string; cls: string }> = {
  borrador: { label: "Borrador → Requiere aprobación del Gerente", cls: "bg-amber-50 border-amber-300 text-amber-900" },
  aprobada: { label: "Aprobada · lista para enviar", cls: "bg-emerald-50 border-emerald-300 text-emerald-900" },
  enviada: { label: "Enviada al proveedor", cls: "bg-emerald-50 border-emerald-300 text-emerald-900" },
  recibida_parcial: { label: "Recibida parcialmente", cls: "bg-dorado/15 border-dorado/40 text-olivo" },
  recibida: { label: "Recibida", cls: "bg-marfil-deep border-arena text-carbon" },
};

export function PurchasesPage() {
  const nav = useNavigate();
  const [sug, setSug] = useState<Suggestion[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [off, setOff] = useState<Set<string>>(new Set());
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [current, setCurrent] = useState<PurchaseOrder | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const canApprove = client.can("compras.aprobar_oc");

  const load = useCallback(async () => {
    const [s, o] = await Promise.all([client.inventory.suggestions(), PurchasingApi.orders()]);
    setSug(s);
    setQty(Object.fromEntries(s.map((x) => [x.ingredientId, x.suggestedQty])));
    setOrders(o);
  }, []);
  useEffect(() => { load(); }, [load]);

  const bySupplier = useMemo(() => {
    const m = new Map<string, { name: string; items: Suggestion[] }>();
    for (const s of sug) {
      const k = s.supplierId ?? "sin";
      m.set(k, { name: s.supplierName ?? "Sin proveedor asignado", items: [...(m.get(k)?.items ?? []), s] });
    }
    return [...m];
  }, [sug]);

  const generate = async (supplierId: string, items: Suggestion[]) => {
    const whs = await client.inventory.warehouses();
    const lines = items.filter((i) => !off.has(i.ingredientId) && (qty[i.ingredientId] ?? 0) > 0).map((i) => ({ ingredientId: i.ingredientId, quantity: qty[i.ingredientId]!, unitPrice: i.unitPrice ?? 0 }));
    if (!lines.length) return;
    const po = await PurchasingApi.createOrder({ supplierId, warehouseId: whs.find((w) => w.name === "General")?.id ?? whs[0]!.id, lines });
    setCurrent(po); setMsg(`Se generó ${po.folio}.`); load();
  };
  const approve = async () => { if (current) { setCurrent(await PurchasingApi.approve(current.id)); load(); } };
  const share = async (via: "whatsapp" | "mail") => {
    if (!current) return;
    const r = await PurchasingApi.share(current.id);
    window.open(via === "whatsapp" ? r.whatsappUrl : r.mailto, "_blank");
    setCurrent(await PurchasingApi.order(current.id)); load();
  };

  return (
    <main className="flex-1 p-6 lg:p-8 flex flex-col xl:flex-row gap-7 overflow-x-hidden bg-[#F7F5F0]">
      <section className="w-full xl:w-[54%] flex flex-col gap-5">
        <div className="bg-white rounded-xl p-5 border border-arena/50 shadow-sm relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full bg-dorado/10 blur-2xl pointer-events-none" />
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-dorado/15 text-olivo text-[11px] font-semibold tracking-wide border border-dorado/30">
              <span className="material-symbols-outlined text-xs text-dorado-dark" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
              Mínimos y máximos por insumo
            </span>
          </div>
          <h1 className="font-headline text-2xl font-bold text-olivo tracking-tight">Sugerencia de Reabastecimiento</h1>
          <p className="text-xs text-carbon-muted mt-1 leading-relaxed max-w-xl">Insumos por debajo de su mínimo; la cantidad sugerida lleva la existencia al máximo, en unidades de compra y con el mejor precio pactado.</p>
          {msg && <p className="mt-3 text-xs font-medium text-olivo">{msg}</p>}
        </div>

        {bySupplier.length === 0 && <p className="text-sm text-carbon-soft bg-white rounded-xl border border-arena/60 p-5">Todo el inventario está sobre su mínimo.</p>}
        {bySupplier.map(([supplierId, g]) => {
          const active = g.items.filter((i) => !off.has(i.ingredientId));
          const subtotal = active.reduce((s, i) => s + (qty[i.ingredientId] ?? 0) * (i.unitPrice ?? 0), 0);
          return (
            <div key={supplierId} className="bg-white rounded-xl border border-arena/60 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
              <div className="bg-marfil-subtle px-5 py-3.5 border-b border-arena/40 flex items-center justify-between">
                <h3 className="font-headline text-base font-bold text-olivo tracking-wide">{g.name}</h3>
                <span className="text-[11px] text-carbon-soft">{g.items.length} insumo(s)</span>
              </div>
              <div className="divide-y divide-arena/30">
                {g.items.map((i) => {
                  const on = !off.has(i.ingredientId);
                  const q = qty[i.ingredientId] ?? 0;
                  return (
                    <div key={i.ingredientId} className="p-4 sm:p-5 hover:bg-marfil/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-3.5">
                        <input checked={on} onChange={() => setOff((s) => { const n = new Set(s); if (n.has(i.ingredientId)) n.delete(i.ingredientId); else n.add(i.ingredientId); return n; })} className="mt-1 w-4 h-4 rounded border-arena text-olivo focus:ring-dorado cursor-pointer" type="checkbox" />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-carbon text-sm">{i.name}</span>
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-bold tracking-tight">
                              <span className="material-symbols-outlined text-[12px] text-red-700">warning</span>Bajo mínimo
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-1 gap-x-4 text-xs text-carbon-muted">
                            <div>Stock actual: <strong className="text-terracota font-semibold">{fmt(i.stock)} {i.useUnit}</strong> <span className="text-[10px] text-carbon-soft">(Mín. {fmt(i.minStock)})</span></div>
                            <div>Precio pactado: <strong className="text-olivo font-semibold">{i.unitPrice !== null ? money(i.unitPrice) : "—"} / {i.purchaseUnit}</strong></div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between md:justify-end gap-5 pl-7 md:pl-0">
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] uppercase font-semibold text-carbon-soft mb-1">Cantidad sugerida</span>
                          <div className="flex items-center border border-arena rounded-lg bg-white overflow-hidden shadow-xs">
                            <button onClick={() => setQty((x) => ({ ...x, [i.ingredientId]: Math.max(0, q - 1) }))} className="w-8 h-8 flex items-center justify-center text-carbon hover:bg-marfil-deep active:bg-arena transition-colors"><span className="material-symbols-outlined text-sm">remove</span></button>
                            <input value={q} onChange={(e) => setQty((x) => ({ ...x, [i.ingredientId]: Math.max(0, Number(e.target.value) || 0) }))} className="w-12 text-center text-xs font-bold text-olivo border-none focus:ring-0 p-0" type="text" />
                            <button onClick={() => setQty((x) => ({ ...x, [i.ingredientId]: q + 1 }))} className="w-8 h-8 flex items-center justify-center text-carbon hover:bg-marfil-deep active:bg-arena transition-colors"><span className="material-symbols-outlined text-sm">add</span></button>
                          </div>
                          <span className="text-[10px] text-carbon-soft mt-0.5">{i.purchaseUnit}</span>
                        </div>
                        <div className="text-right min-w-[90px]">
                          <span className="text-[10px] uppercase font-semibold text-carbon-soft block">Subtotal</span>
                          <span className="text-sm font-bold text-olivo tracking-tight">{money(q * (i.unitPrice ?? 0))}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="bg-marfil/60 px-5 py-3 border-t border-arena/40 flex items-center justify-between">
                <div className="text-xs text-carbon-muted">Subtotal proveedor: <strong className="text-carbon">{money(subtotal)} MXN</strong> ({active.length} insumos)</div>
                {supplierId !== "sin" && (
                  <button onClick={() => generate(supplierId, g.items)} className="text-xs font-semibold text-olivo hover:text-dorado-dark flex items-center gap-1.5 transition-colors">
                    <span className="material-symbols-outlined text-base">receipt_long</span>Generar OC para {g.name}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <div className="bg-white rounded-xl border border-arena/60 shadow-sm overflow-hidden">
          <div className="bg-marfil-subtle px-5 py-3 border-b border-arena/40"><h3 className="font-headline text-base font-bold text-olivo">Órdenes recientes</h3></div>
          <div className="divide-y divide-arena/30 text-xs">
            {orders.map((o) => (
              <div key={o.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <button onClick={() => setCurrent(o)} className="text-left">
                  <span className="font-mono font-bold text-olivo">{o.folio}</span> · {o.supplier.name}
                  <span className={`ml-2 inline-flex px-2 py-0.5 rounded-full border text-[10px] font-semibold ${STATUS[o.status]?.cls ?? ""}`}>{o.status.replace("_", " ")}</span>
                </button>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-semibold">{money(o.total)}</span>
                  {["aprobada", "enviada", "recibida_parcial"].includes(o.status) && client.can("compras.recibir") && (
                    <button onClick={() => nav(`/recepcion?oc=${o.id}`)} className="px-2.5 py-1 rounded bg-olivo text-dorado font-semibold">Recibir</button>
                  )}
                </div>
              </div>
            ))}
            {orders.length === 0 && <p className="px-5 py-4 text-carbon-soft">Aún no hay órdenes.</p>}
          </div>
        </div>
      </section>

      <section className="w-full xl:w-[46%] flex flex-col gap-5">
        {!current ? (
          <div className="bg-white rounded-xl border border-arena/60 shadow-sm p-8 text-center text-sm text-carbon-soft">Genera o selecciona una orden para verla aquí.</div>
        ) : (
          <div className="bg-white rounded-xl border border-arena/60 shadow-lg relative flex flex-col overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-olivo via-dorado to-olivo" />
            <div className="p-6 border-b border-arena/40 watermark-pattern bg-marfil-subtle/50">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-olivo bg-marfil-deep px-2 py-0.5 rounded border border-arena/60">FOLIO: {current.folio}</span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${STATUS[current.status]?.cls ?? ""}`}>
                      {current.status === "borrador" && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                      {STATUS[current.status]?.label ?? current.status}
                    </span>
                  </div>
                  <h2 className="font-headline text-2xl font-bold text-olivo mt-2 tracking-tight">Orden de Compra y Abastecimiento</h2>
                  <p className="text-xs text-carbon-soft mt-0.5">Emisión: {new Date(current.createdAt).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</p>
                </div>
                <div className="w-12 h-12 rounded-full border border-dorado/50 bg-white flex flex-col items-center justify-center shadow-xs shrink-0">
                  <span className="font-headline text-dorado-dark font-bold text-sm leading-none">CONV</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5 p-3.5 rounded-lg bg-white/80 border border-arena/40 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-carbon-soft block">Proveedor:</span>
                  <p className="font-medium text-carbon mt-0.5">{current.supplier.name}</p>
                  {current.supplier.rfc && <p className="text-[11px] text-carbon-soft">RFC: {current.supplier.rfc}</p>}
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-carbon-soft block">Condiciones comerciales:</span>
                  <p className="font-medium text-carbon mt-0.5 flex items-center gap-1"><span className="material-symbols-outlined text-[14px] text-dorado-dark">credit_card</span>{current.supplier.creditDays ? `Crédito a ${current.supplier.creditDays} días` : "Pago de contado"}</p>
                </div>
              </div>
            </div>
            <div className="p-6 flex-1 flex flex-col">
              <h4 className="text-xs font-bold uppercase tracking-wider text-olivo mb-3 flex items-center justify-between">Partidas de Compra <span className="text-[11px] font-normal text-carbon-soft lowercase">{current.lines.length} partidas</span></h4>
              <div className="overflow-x-auto border border-arena/50 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-marfil-deep text-carbon font-semibold border-b border-arena/50">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Insumo</th>
                      <th className="py-2.5 px-2 text-center font-semibold">Cant.</th>
                      <th className="py-2.5 px-2 text-center font-semibold">Unidad</th>
                      <th className="py-2.5 px-3 text-right font-semibold">P. Pactado</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Importe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-arena/30">
                    {current.lines.map((l) => (
                      <tr key={l.id} className="hover:bg-marfil/30 transition-colors">
                        <td className="py-2.5 px-3"><span className="font-medium text-carbon block">{l.name}</span></td>
                        <td className="py-2.5 px-2 text-center font-bold text-olivo">{fmt(l.quantity)}</td>
                        <td className="py-2.5 px-2 text-center text-carbon-muted">{l.purchaseUnit}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-carbon">{money(l.unitPrice)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-olivo font-mono">{money(l.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex justify-end pt-3 border-t border-arena/30">
                <div className="w-full sm:w-56 bg-marfil-subtle p-3 rounded-lg border border-arena/40 text-xs">
                  <div className="flex justify-between text-sm font-bold text-olivo">Total: <span className="font-mono text-base text-dorado-dark">{money(current.total)} MXN</span></div>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2">
                {current.status === "borrador" ? (
                  <button disabled={!canApprove} title={canApprove ? "" : "Requiere gerente"} onClick={approve} className="sm:col-span-3 py-3 rounded-lg bg-olivo text-dorado font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                    <span className="material-symbols-outlined">task_alt</span>{canApprove ? "Aprobar orden" : "Pendiente de aprobación del gerente"}
                  </button>
                ) : (
                  <>
                    <button onClick={() => share("whatsapp")} className="py-3 rounded-lg bg-olivo text-dorado font-semibold text-xs flex items-center justify-center gap-1.5"><span className="material-symbols-outlined text-base">chat</span>Enviar por WhatsApp</button>
                    <button onClick={() => share("mail")} className="py-3 rounded-lg bg-white border border-arena text-olivo font-semibold text-xs flex items-center justify-center gap-1.5"><span className="material-symbols-outlined text-base">mail</span>Enviar por correo</button>
                    <button onClick={() => window.print()} className="py-3 rounded-lg bg-white border border-arena text-olivo font-semibold text-xs flex items-center justify-center gap-1.5"><span className="material-symbols-outlined text-base">picture_as_pdf</span>Imprimir / PDF</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
