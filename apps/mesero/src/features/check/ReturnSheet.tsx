/* Diseño: design/stitch/mesero-devolucion.html (Stitch). Marcado y clases originales; datos reales. E3-08, E5-02, E5-03. */
import type { OrderItem } from "@convivium/api-client";
import { useSession } from "@convivium/app-shell";
import { useEffect, useState } from "react";

const money = (c: number) => `$${(c / 100).toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN`;

export function ReturnSheet({ item, tableLabel, onClose, onDone }: { item: OrderItem; tableLabel: string; onClose: () => void; onDone: (msg: string) => void }) {
  const { client } = useSession();
  const [reasons, setReasons] = useState<{ id: string; label: string }[]>([]);
  const [reasonId, setReasonId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [action, setAction] = useState<"rehacer" | "retirar_de_cuenta">("rehacer");
  const [pinMode, setPinMode] = useState(false);
  const [managers, setManagers] = useState<{ id: string; name: string }[]>([]);
  const [approverId, setApproverId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const amount = item.unitPrice * item.quantity - item.promoDiscount;

  useEffect(() => { client.catalog.reasons("devolucion").then((r) => { setReasons(r); setReasonId(r[0]?.id ?? null); }); }, [client]);
  useEffect(() => { if (pinMode) client.auth.deviceUsers().then(setManagers); }, [pinMode, client]);

  const remake = async () => {
    const r = await client.orders.returnItem(item.id, { reasonId: reasonId!, resolution: "rehacer", note: note || undefined });
    onDone(r.status === "remade" ? `${item.productName} regresó a cocina como REHACER.` : "Devolución registrada.");
  };
  /** Retirar de cuenta: solicitud al gerente (remota) y, si se usa PIN aquí, se resuelve en el acto. */
  const remove = async (withPin: boolean) => {
    const a = await client.approvals.create({ kind: "devolucion_retiro", checkId: item.checkId, itemId: item.id, amount, reasonId, note: note || undefined });
    if (!withPin) return onDone("Solicitud enviada al gerente. Te avisamos al aprobarse.");
    await client.approvals.resolve(a.id, "aprobar", { approverId, approverPin: pin });
    onDone(`${item.productName} retirado de la cuenta con autorización.`);
  };
  const run = (fn: () => Promise<void>) => { setError(null); fn().catch((e) => setError((e as Error).message)); };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end items-center bg-black/60" onClick={onClose}>
      <section className="w-full max-w-md bg-marfil-sheet rounded-t-3xl shadow-2xl border-t border-arena-light overflow-hidden transition-all duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="w-full pt-3 pb-2 flex justify-center items-center"><span className="w-12 h-1.5 bg-arena/70 rounded-full block" /></div>
        <div className="px-5 pt-1 pb-4 border-b border-arena/30 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-terracota/10 text-terracota border border-terracota/20">Incidencia de cocina</span>
            </div>
            <h2 className="font-headline text-2xl font-bold text-olivo tracking-tight">Devolución de Platillo</h2>
            <p className="font-body text-xs text-carbon-muted mt-0.5 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-dorado-dark">chair</span>{tableLabel}{item.guest ? ` • Comensal ${item.guest}` : ""}
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="w-8 h-8 rounded-full bg-arena/20 text-carbon hover:bg-arena/40 flex items-center justify-center transition-colors">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="px-5 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
          <article className="p-3.5 bg-marfil-pure rounded-xl border border-arena/60 shadow-sm relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-dorado/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="font-headline text-lg font-bold text-olivo tracking-wide">{item.quantity > 1 ? `${item.quantity}× ` : ""}{item.productName}</h3>
                {item.modifiers.length > 0 && <p className="text-xs text-carbon-muted">Ordenado: <span className="font-semibold text-carbon">{item.modifiers.join(" · ")}</span></p>}
              </div>
              <div className="text-right flex-shrink-0">
                <span className="text-xs text-stone-500 block leading-none">Importe</span>
                <span className="font-body text-base font-bold text-olivo tracking-tight">{money(amount)}</span>
              </div>
            </div>
          </article>

          <section>
            <div className="flex items-center justify-between mb-2.5">
              <label className="font-label text-xs uppercase tracking-wider font-bold text-olivo flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-olivo text-marfil text-[10px] flex items-center justify-center font-bold">1</span>Motivo de la Devolución
              </label>
              <span className="text-[11px] text-terracota font-medium">Requerido *</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs" role="radiogroup">
              {reasons.map((r) =>
                r.id === reasonId ? (
                  <button key={r.id} aria-checked="true" role="radio" className="px-3 py-2.5 rounded-lg border-2 border-olivo bg-olivo/5 text-olivo text-left flex items-center justify-between shadow-xs transition-all">
                    <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-base text-olivo material-symbols-fill">check_circle</span>{r.label}</span>
                  </button>
                ) : (
                  <button key={r.id} onClick={() => setReasonId(r.id)} aria-checked="false" role="radio" className="px-3 py-2.5 rounded-lg border border-arena bg-white/70 text-carbon hover:bg-white text-left flex items-center justify-between transition-all">
                    <span className="font-medium truncate">{r.label}</span><span className="w-3.5 h-3.5 rounded-full border border-arena" />
                  </button>
                ),
              )}
            </div>
            <div className="mt-2.5">
              <label className="block text-[11px] font-medium text-carbon-muted mb-1" htmlFor="chef-notes">Nota / Instrucción precisa para Cocina:</label>
              <input id="chef-notes" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. Solicitado término medio, salió cocido de más" className="w-full text-xs text-carbon bg-white border border-arena rounded-lg px-3 py-2.5 focus:outline-none focus:border-olivo focus:ring-1 focus:ring-olivo transition-all" />
            </div>
          </section>

          <section>
            <label className="font-label text-xs uppercase tracking-wider font-bold text-olivo flex items-center gap-1.5 mb-2.5">
              <span className="w-4 h-4 rounded-full bg-olivo text-marfil text-[10px] flex items-center justify-center font-bold">2</span>Acción a Realizar en Sistema
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              <label className={action === "rehacer" ? "relative flex items-start gap-3 p-3.5 rounded-xl border-2 border-olivo bg-olivo text-marfil-sheet shadow-sm cursor-pointer transition" : "relative flex items-start gap-3 p-3.5 rounded-xl border border-arena/70 bg-white hover:bg-stone-50 text-carbon shadow-sm cursor-pointer transition"}>
                <input checked={action === "rehacer"} onChange={() => setAction("rehacer")} className="mt-1 text-dorado focus:ring-dorado h-4 w-4 border-arena" name="recovery_action" type="radio" />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-dorado text-lg">replay</span>
                      <span className={`font-headline font-bold text-sm tracking-wide ${action === "rehacer" ? "text-white" : "text-carbon"}`}>Rehacer platillo</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase bg-dorado text-olivo-dark">Prioridad en KDS</span>
                  </div>
                  <p className={`text-[11px] mt-1 leading-relaxed ${action === "rehacer" ? "text-stone-300" : "text-carbon-muted"}`}>Vuelve a la estación con etiqueta REHACER, sin costo extra para el cliente.</p>
                </div>
              </label>
              <label className={action === "retirar_de_cuenta" ? "relative flex items-start gap-3 p-3.5 rounded-xl border-2 border-terracota bg-white text-carbon shadow-sm cursor-pointer transition" : "relative flex items-start gap-3 p-3.5 rounded-xl border border-arena/70 bg-white hover:bg-stone-50 text-carbon shadow-sm cursor-pointer transition"}>
                <input checked={action === "retirar_de_cuenta"} onChange={() => setAction("retirar_de_cuenta")} className="mt-1 text-terracota focus:ring-terracota h-4 w-4 border-arena" name="recovery_action" type="radio" />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-terracota text-lg">lock</span>
                      <span className="font-headline font-bold text-sm tracking-wide text-carbon">Retirar de cuenta</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase bg-terracota-soft text-terracota border border-terracota/20">Requiere gerencia</span>
                  </div>
                  <p className="text-[11px] text-carbon-muted mt-1 leading-relaxed">Descuenta <span className="font-semibold text-carbon">{money(amount)}</span> de la cuenta.</p>
                </div>
              </label>
            </div>
          </section>

          <aside className="p-3 rounded-lg bg-amber-50 border border-amber-200/80 flex items-start gap-2.5 text-stone-800">
            <span className="material-symbols-outlined text-amber-700 text-lg flex-shrink-0 mt-0.5">scale</span>
            <div className="text-[11px] leading-snug">
              <span className="font-bold text-stone-900 block mb-0.5">Impacto en inventario</span>
              {action === "rehacer" ? "El platillo rehecho vuelve a descontar insumos; el devuelto queda como merma al costo teórico." : "El platillo devuelto queda registrado como merma al costo teórico."}
            </div>
          </aside>

          {pinMode && action === "retirar_de_cuenta" && (
            <div className="p-3 rounded-lg bg-white border border-arena space-y-2 text-xs">
              <select value={approverId} onChange={(e) => setApproverId(e.target.value)} className="w-full rounded border-arena text-xs">
                <option value="">¿Quién autoriza?</option>
                {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} type="password" inputMode="numeric" placeholder="PIN del gerente" className="w-full text-center tracking-[0.6em] font-bold rounded border-arena" />
            </div>
          )}
          {error && <p className="text-xs text-terracota font-medium">{error}</p>}

          <div className="pt-2 space-y-2.5">
            {action === "rehacer" ? (
              <button disabled={!reasonId} onClick={() => run(remake)} className="w-full py-3.5 px-4 bg-olivo hover:bg-olivo-surface text-marfil rounded-xl font-body font-semibold text-xs tracking-wider uppercase flex items-center justify-center gap-2 shadow-md disabled:opacity-50">
                <span className="material-symbols-outlined text-dorado text-base">replay</span>Enviar a cocina como REHACER
              </button>
            ) : pinMode ? (
              <button disabled={!reasonId || !approverId || pin.length < 4} onClick={() => run(() => remove(true))} className="w-full py-3.5 px-4 bg-olivo text-marfil rounded-xl font-body font-semibold text-xs tracking-wider uppercase flex items-center justify-center gap-2 shadow-md disabled:opacity-50">
                <span className="material-symbols-outlined text-dorado text-base">pin</span>Autorizar y retirar
              </button>
            ) : (
              <>
                <button disabled={!reasonId} onClick={() => run(() => remove(false))} className="w-full py-3.5 px-4 bg-olivo hover:bg-olivo-surface text-marfil rounded-xl font-body font-semibold text-xs tracking-wider uppercase flex items-center justify-center gap-2 shadow-md disabled:opacity-50">
                  <span className="material-symbols-outlined text-dorado text-base">send_to_mobile</span>Solicitar aprobación remota
                </button>
                <button onClick={() => setPinMode(true)} className="w-full py-3 px-4 bg-transparent hover:bg-arena/20 text-olivo border border-arena rounded-xl font-body font-semibold text-xs tracking-wider uppercase flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-base text-olivo">pin</span>Autorizar con PIN de gerente aquí
                </button>
              </>
            )}
          </div>
          <div className="h-4 bg-marfil-sheet" />
        </div>
      </section>
    </div>
  );
}
