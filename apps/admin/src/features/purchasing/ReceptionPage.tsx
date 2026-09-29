/* Diseño: design/stitch/admin-recepcion.html (Stitch). Marcado y clases originales; datos reales. E8-03, E8-04, E8-05. */
import { client } from "@convivium/app-shell";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PurchasingApi, type PurchaseOrder } from "./api";

const money = (c: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(c / 100);
const fmt = (n: number) => new Intl.NumberFormat("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
type Row = { ingredientId: string; name: string; unit: string; ordered: number; received: number; agreed: number; billed: number; lot: string; expiresAt: string; lotTracking: boolean };

export function ReceptionPage() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [whs, setWhs] = useState<{ id: string; name: string }[]>([]);
  const [wh, setWh] = useState("");
  const [folio, setFolio] = useState("");
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    PurchasingApi.orders().then((o) => setOrders(o.filter((x) => ["aprobada", "enviada", "recibida_parcial"].includes(x.status))));
    client.inventory.warehouses().then((w) => { setWhs(w); setWh((x) => x || (w.find((a) => a.name === "Cocina") ?? w[0])?.id || ""); });
  }, []);
  useEffect(() => {
    const id = params.get("oc");
    if (!id) return;
    Promise.all([PurchasingApi.order(id), client.inventory.ingredients()]).then(([o, ings]) => {
      setPo(o);
      setRows(o.lines.map((l) => ({ ingredientId: l.ingredientId, name: l.name, unit: l.purchaseUnit, ordered: l.quantity, received: l.quantity, agreed: l.unitPrice, billed: l.unitPrice, lot: "", expiresAt: "", lotTracking: !!ings.find((i) => i.id === l.ingredientId)?.lotTracking })));
    });
  }, [params]);

  const set = (id: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.ingredientId === id ? { ...r, ...p } : r)));
  const status = (r: Row) => (r.received < r.ordered ? "faltante" : r.received > r.ordered ? "sobrante" : r.billed > r.agreed ? "precio" : "ok");
  const discrepancies = rows.filter((r) => status(r) !== "ok");
  const total = rows.reduce((s, r) => s + Math.round(r.received * r.billed), 0);

  const loadCfdi = async (file: File) => {
    try {
      const c = await PurchasingApi.parseCfdi(await file.text());
      setFolio(c.folio ?? "");
      setRows((rs) => rs.map((r) => {
        const con = c.conceptos.find((x) => x.ingredientId === r.ingredientId);
        return con ? { ...r, received: con.quantity, billed: con.unitPrice } : r;
      }));
      setMsg({ ok: true, text: `CFDI ${c.folio ?? ""} de ${c.emisor.name ?? c.emisor.rfc}: ${c.conceptos.filter((x) => x.ingredientId).length} conceptos ligados · total ${money(c.total)}` });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  };

  const confirm = async () => {
    if (!po) return;
    try {
      const r = await PurchasingApi.receive({
        purchaseOrderId: po.id, supplierId: po.supplierId, warehouseId: wh, invoiceFolio: folio || undefined, createPayable: true,
        lines: rows.map((x) => ({ ingredientId: x.ingredientId, quantity: x.received, unitPrice: x.billed, lot: x.lot || undefined, expiresAt: x.expiresAt || undefined })),
      });
      setMsg({ ok: true, text: `Recepción registrada por ${money(r.total)}. Existencias y costo promedio actualizados.${r.payable ? ` Cuenta por pagar con vencimiento ${r.payable.dueAt}.` : ""}` });
      setPo(null); setRows([]);
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  };

  return (
    <main className="flex-1 flex overflow-hidden bg-surface min-h-screen">
      <aside className="w-60 bg-surface-container border-r border-outline-variant flex-col justify-between p-4 hidden md:flex shrink-0">
        <div className="space-y-4">
          <div className="bg-surface p-3.5 rounded-lg border border-outline-variant shadow-xs">
            <p className="font-headline font-semibold text-xs text-primary leading-tight mb-2">Almacén destino</p>
            <select value={wh} onChange={(e) => setWh(e.target.value)} className="w-full text-xs rounded border-outline-variant focus:ring-dorado">{whs.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
          </div>
          <div className="bg-surface p-3.5 rounded-lg border border-outline-variant shadow-xs space-y-1.5">
            <p className="font-headline font-semibold text-xs text-primary leading-tight">Órdenes por recibir</p>
            {orders.map((o) => (
              <button key={o.id} onClick={() => nav(`/recepcion?oc=${o.id}`)} className={`w-full text-left px-2.5 py-2 rounded-lg text-xs ${o.id === po?.id ? "bg-surface-container border border-dorado/40 text-primary font-semibold" : "text-on-surface-variant hover:bg-surface-container/60"}`}>
                <span className="font-mono">{o.folio}</span> · {o.supplier.name}
              </button>
            ))}
            {orders.length === 0 && <p className="text-[11px] text-on-surface-variant">Sin órdenes aprobadas pendientes.</p>}
          </div>
          {po && (
            <label className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg bg-surface border border-dorado/40 text-primary hover:bg-surface-container cursor-pointer">
              <span className="material-symbols-outlined text-base text-dorado">upload_file</span>Cargar XML CFDI
              <input type="file" accept=".xml,text/xml" className="hidden" onChange={(e) => e.target.files?.[0] && loadCfdi(e.target.files[0])} />
            </label>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-y-auto">
        {msg && <div className={`m-6 mb-0 text-xs font-medium px-3 py-2 rounded-lg border ${msg.ok ? "bg-status-green-bg text-status-green-text border-status-green-text/20" : "bg-terracota-light text-terracota border-terracota/30"}`}>{msg.text}</div>}
        {!po ? (
          <div className="p-10 text-sm text-on-surface-variant">Selecciona una orden de compra aprobada para recibirla.</div>
        ) : (
          <>
            <div className="p-6 pb-4 bg-surface border-b border-outline-variant">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                  {whs.find((w) => w.id === wh)?.name} <span className="text-secondary">•</span> <span className="font-medium text-carbon">Recepción de Mercancía</span>
                  <span className="ml-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary text-dorado"><span className="w-1.5 h-1.5 rounded-full bg-dorado animate-pulse" />En cotejo físico</span>
                </div>
              </div>
              <h1 className="font-headline text-2xl lg:text-3xl font-bold text-primary tracking-tight mb-3">
                Recepción · {po.folio} · {po.supplier.name} · <span className="font-normal italic text-carbon text-xl">{po.supplier.creditDays ? `crédito ${po.supplier.creditDays} días` : "contado"}</span>
              </h1>
              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container border border-outline-variant text-carbon">
                  <span className="material-symbols-outlined text-sm text-secondary-dark">receipt</span>Folio factura:
                  <input value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="Ej. A-778" className="w-24 text-xs border-0 bg-transparent p-0 font-semibold text-primary focus:ring-0" />
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container border border-outline-variant text-carbon">
                  <span className="material-symbols-outlined text-sm text-secondary-dark">person</span>Recibe: <strong className="font-semibold text-primary">{client.session?.user.name}</strong>
                </div>
              </div>
            </div>

            <div className="p-6 flex-1 bg-surface-container/40">
              <div className="bg-surface rounded-xl border border-secondary shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 bg-surface border-b border-outline-variant flex flex-wrap items-center justify-between gap-4">
                  <span className="font-headline font-semibold text-sm text-primary uppercase tracking-wider">Lista de Insumos a Conciliar ({rows.length} renglones)</span>
                  <button onClick={() => setOnlyDiff((x) => !x)} className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded border text-xs font-medium transition-colors ${onlyDiff ? "bg-primary text-dorado border-primary" : "bg-surface hover:bg-surface-container border-outline-variant text-carbon"}`} type="button">
                    <span className="material-symbols-outlined text-sm">filter_alt</span>Solo discrepancias ({discrepancies.length})
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container/70 border-b border-outline-variant text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                        <th className="py-3 px-4">Insumo</th>
                        <th className="py-3 px-3 text-right">Pedido (OC)</th>
                        <th className="py-3 px-4 text-center w-52 bg-dorado/10 text-primary">Recibido (Físico)</th>
                        <th className="py-3 px-3 text-center">Unidad</th>
                        <th className="py-3 px-3 text-right">Precio Pactado</th>
                        <th className="py-3 px-3 text-right">Facturado</th>
                        <th className="py-3 px-4">Lote / Caducidad</th>
                        <th className="py-3 px-4">Diferencia / Estatus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/60 text-xs">
                      {rows.filter((r) => !onlyDiff || status(r) !== "ok").map((r) => {
                        const st = status(r);
                        return (
                          <tr key={r.ingredientId} className="hover:bg-amber-50/20 transition-colors bg-white">
                            <td className="py-4 px-4 align-middle"><div className="font-semibold text-primary text-sm">{r.name}</div></td>
                            <td className="py-4 px-3 text-right align-middle tabular-nums font-semibold text-carbon text-sm">{fmt(r.ordered)}</td>
                            <td className="py-3 px-3 align-middle bg-dorado/5">
                              <div className={`flex items-center justify-center gap-1.5 bg-surface-card p-1.5 rounded-lg border-2 shadow-sm ${st === "faltante" || st === "sobrante" ? "border-terracota" : "border-outline-variant"}`}>
                                <button onClick={() => set(r.ingredientId, { received: Math.max(0, r.received - 1) })} className="touch-target w-10 h-10 rounded-md bg-[#F3EFE6] hover:bg-[#EAE6DD] active:scale-95 text-primary font-bold text-lg flex items-center justify-center transition-transform select-none" type="button">−</button>
                                <input value={r.received} onChange={(e) => set(r.ingredientId, { received: Math.max(0, Number(e.target.value) || 0) })} className="w-20 text-center font-bold text-base text-carbon border-0 focus:ring-0 p-0 tabular-nums bg-transparent" type="text" inputMode="decimal" />
                                <button onClick={() => set(r.ingredientId, { received: r.received + 1 })} className="touch-target w-10 h-10 rounded-md bg-[#F3EFE6] hover:bg-[#EAE6DD] active:scale-95 text-primary font-bold text-lg flex items-center justify-center transition-transform select-none" type="button">+</button>
                              </div>
                            </td>
                            <td className="py-4 px-3 text-center align-middle font-medium text-carbon">{r.unit}</td>
                            <td className="py-4 px-3 text-right align-middle tabular-nums text-on-surface-variant font-medium">{money(r.agreed)}</td>
                            <td className="py-4 px-3 text-right align-middle tabular-nums font-semibold text-carbon">
                              <input value={r.billed / 100} onChange={(e) => set(r.ingredientId, { billed: Math.round((Number(e.target.value) || 0) * 100) })} inputMode="decimal" className={`w-24 text-right text-xs rounded border-outline-variant ${r.billed > r.agreed ? "text-terracota font-bold" : ""}`} />
                            </td>
                            <td className="py-4 px-4 align-middle">
                              {r.lotTracking ? (
                                <div className="inline-flex flex-col gap-1 text-[11px] bg-surface-container px-2.5 py-1.5 rounded border border-outline-variant">
                                  <input value={r.lot} onChange={(e) => set(r.ingredientId, { lot: e.target.value })} placeholder="Lote" className="w-28 text-[11px] font-mono rounded border-outline-variant py-0.5" />
                                  <input value={r.expiresAt} onChange={(e) => set(r.ingredientId, { expiresAt: e.target.value })} type="date" className="w-28 text-[11px] rounded border-outline-variant py-0.5" />
                                </div>
                              ) : <span className="text-on-surface-variant">— No aplica</span>}
                            </td>
                            <td className="py-4 px-4 align-middle">
                              {st === "ok" ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-status-green-bg border border-status-green-text/20 text-status-green-text"><span className="material-symbols-outlined text-sm">check_circle</span>Conforme</span>
                              ) : st === "precio" ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 border border-amber-300 text-amber-900"><span className="material-symbols-outlined text-sm">trending_up</span>Precio +{Math.round(((r.billed - r.agreed) / (r.agreed || 1)) * 100)}%</span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-terracota-light border border-terracota/40 text-terracota"><span className="material-symbols-outlined text-sm">warning</span>{st === "faltante" ? "Faltante" : "Sobrante"} {fmt(r.received - r.ordered)}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-4 border-t border-outline-variant flex flex-wrap items-center justify-between gap-4 bg-surface">
                  <div className="text-xs text-on-surface-variant">
                    Total a registrar: <strong className="text-primary text-base font-mono">{money(total)} MXN</strong>
                    <span className="block text-[11px]">Se generará una cuenta por pagar{po.supplier.creditDays ? ` a ${po.supplier.creditDays} días` : " de contado"}.</span>
                  </div>
                  <button onClick={confirm} disabled={!wh || rows.every((r) => r.received === 0)} className="px-6 py-3 rounded-lg bg-primary text-dorado font-semibold text-sm flex items-center gap-2 shadow disabled:opacity-50">
                    <span className="material-symbols-outlined">inventory</span>Confirmar recepción
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
