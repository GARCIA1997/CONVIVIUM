/* Diseño: design/stitch/caja-tpv.html (Stitch). Marcado y clases originales; datos reales. E6-02, E6-03, E6-04, E6-05. */
import type { Check, CheckSummary } from "@convivium/api-client";
import { useRealtime, useSession } from "@convivium/app-shell";
import { breakdownIncludedTaxes } from "@convivium/domain";
import { useCallback, useEffect, useState } from "react";

type Method = "efectivo_mxn" | "tarjeta" | "efectivo_usd";
type Filter = "todas" | "por_cobrar" | "consumo";
const USD_RATE = 1720; // TODO: tipo de cambio configurado en la sucursal
const money = (c: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(c / 100);
const elapsed = (iso: string) => {
  const m = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")} h`;
};
const hhmm = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false }) : "");
const label = (c: { kind: string; tableLabel: string | null; name: string | null }) => (c.kind === "barra" ? `Barra · ${c.name}` : `Mesa ${c.tableLabel?.replace(/^M/, "")}`);

export function ChecksView({ onCount, initialCheckId }: { onCount: (n: number) => void; initialCheckId?: string | null }) {
  const { client } = useSession();
  const [list, setList] = useState<CheckSummary[]>([]);
  const [filter, setFilter] = useState<Filter>("todas");
  const [check, setCheck] = useState<Check | null>(null);
  const [guestSel, setGuestSel] = useState<number | null>(null);
  const [tipPct, setTipPct] = useState<number>(15);
  const [amounts, setAmounts] = useState<Record<Method, string>>({ efectivo_mxn: "", tarjeta: "", efectivo_usd: "" });
  const [cardRef, setCardRef] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => client.orders.openChecks().then((l) => { setList(l); onCount(l.length); }), [client, onCount]);
  useEffect(() => { load(); }, [load]);
  useRealtime(["floor"], () => load());

  const select = async (id: string) => {
    setMsg(null); setGuestSel(null);
    setAmounts({ efectivo_mxn: "", tarjeta: "", efectivo_usd: "" }); setCardRef("");
    setCheck(await client.orders.get(id));
  };

  // Viene de "Cobrar" en Para llevar: abre esa cuenta.
  useEffect(() => { if (initialCheckId) void select(initialCheckId); }, [initialCheckId]);

  const shown = list.filter((c) => filter === "todas" || (filter === "por_cobrar" ? c.status === "pidio_cuenta" : c.status === "abierta"));
  const openTotal = list.reduce((s, c) => s + c.total, 0);

  const priced = check?.items.filter((i) => i.unitPrice > 0 || i.state === "cancelado") ?? [];
  const guests = [...new Set(priced.map((i) => i.guest).filter((g): g is number => !!g))].sort((a, b) => a - b);
  const guestTotal = (g: number) => priced.filter((i) => i.guest === g && i.state !== "cancelado" && i.state !== "devuelto").reduce((s, i) => s + i.unitPrice * i.quantity - i.promoDiscount, 0);
  const taxes = check ? breakdownIncludedTaxes(check.total, { ivaPct: 16, iepsPct: 0 }) : null;
  const tip = check ? Math.round((check.total * tipPct) / 100) : 0;
  const cents = (v: string) => Math.round(Number(v || 0) * 100);
  const entered = cents(amounts.efectivo_mxn) + cents(amounts.tarjeta) + Math.round((cents(amounts.efectivo_usd) * USD_RATE) / 100);
  const due = check ? check.total + tip : 0;
  const change = Math.max(0, entered - due);

  const splitByGuest = async () => {
    if (!check) return;
    try {
      const r = await client.cash.split(check.id, { mode: "por_comensal" });
      setMsg({ ok: true, text: `Cuenta dividida en ${r.parts.length} cuentas por comensal` });
      load(); select(check.id);
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  };
  const splitEqual = async () => {
    if (!check) return;
    const r = await client.cash.split(check.id, { mode: "iguales", parts: Math.max(2, check.guests ?? 2) });
    setMsg({ ok: true, text: `Partes iguales: ${r.parts.map((p) => money(p.amount)).join(" / ")}` });
  };

  const pay = async () => {
    if (!check) return;
    try {
      // La propina se registra aparte: se toma primero del efectivo y, si no alcanza, de la tarjeta.
      const cash = cents(amounts.efectivo_mxn);
      const card = cents(amounts.tarjeta);
      const tipCash = Math.min(tip, cash);
      const tipCard = tip - tipCash;
      if (tipCard > card) throw new Error("La propina excede lo ingresado en efectivo y tarjeta");
      const payments = ([
        ["tarjeta", card - tipCard],
        ["efectivo_usd", cents(amounts.efectivo_usd)],
        ["efectivo_mxn", cash - tipCash],
      ] as const).filter(([, a]) => a > 0).map(([method, amount]) => ({ method, amount, ...(method === "efectivo_usd" ? { exchangeRate: USD_RATE } : {}), ...(method === "tarjeta" && cardRef ? { reference: cardRef } : {}) }));
      const r = await client.cash.pay(check.id, { payments, ...(tip ? { tip: { amount: tip, method: tipCash >= tipCard ? "efectivo_mxn" : "tarjeta" } } : {}) });
      setMsg({ ok: r.checkStatus === "cobrada", text: r.checkStatus === "cobrada" ? `Cobro registrado · cambio ${money(r.change)}` : `Pago parcial registrado · faltan ${money(check.total - r.paid)}` });
      setCheck(null); load();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  };

  return (
    <>
      <header className="h-14 bg-stone-100 flex items-center justify-between px-6 border-b border-arena/70 shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <span className="font-headline font-semibold text-xs uppercase tracking-wider text-stone-800">CONVIVIUM POS</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-200 rounded transition-colors" title="Sincronizar">
            <span className="material-symbols-outlined text-sm">sync</span>
          </button>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-12 overflow-hidden bg-marfil">
        {/* Cuentas activas */}
        <section className="col-span-3 border-r border-arena flex flex-col h-full bg-marfil-light/60">
          <div className="p-4 border-b border-arena/80 bg-marfil-card/80 backdrop-blur">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-stone-600 font-headline">Cuentas Activas</h2>
              <span className="text-xs font-semibold text-stone-800 font-mono">{money(openTotal)} MXN</span>
            </div>
            <div className="flex gap-1.5 pt-1">
              {([["todas", `Todas (${list.length})`], ["por_cobrar", `Por cobrar (${list.filter((c) => c.status === "pidio_cuenta").length})`], ["consumo", `En consumo (${list.filter((c) => c.status === "abierta").length})`]] as const).map(([k, text]) =>
                k === filter ? (
                  <button key={k} className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-stone-900 text-amber-200 shadow-xs">{text}</button>
                ) : (
                  <button key={k} onClick={() => setFilter(k)} className={`px-2.5 py-1 rounded-md text-[11px] font-medium bg-white hover:bg-stone-100 transition-colors ${k === "por_cobrar" ? "text-terracota border border-terracota/20" : "text-stone-600 border border-arena"}`}>{text}</button>
                ),
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {shown.map((c) => {
              const active = c.id === check?.id;
              const asked = c.status === "pidio_cuenta";
              return (
                <div key={c.id} onClick={() => select(c.id)} className={active || asked ? `relative p-3.5 rounded-xl bg-white border-2 ${asked ? "border-terracota" : "border-stone-800"} shadow-md cursor-pointer transition-all hover:translate-y-[-1px]` : "p-3.5 rounded-xl bg-white/80 border border-arena hover:border-stone-400 transition-all cursor-pointer"}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-serif-cormorant text-lg font-bold text-stone-900 leading-tight">{label(c)}</span>
                        {asked ? (
                          <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-terracota-light text-terracota font-headline font-semibold">Pidió cuenta</span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">En consumo</span>
                        )}
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">{c.guests ? `${c.guests} Comensales` : "Barra"} · {c.itemCount} artículos</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-base font-bold text-stone-900">{money(c.total)}</span>
                      <span className="block text-[10px] text-stone-400 font-mono">{elapsed(c.openedAt)}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-arena/50 flex items-center justify-between text-[11px] text-stone-600">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-xs text-stone-400">person</span>
                      <span>{c.waiterName}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {shown.length === 0 && <p className="text-xs text-stone-500 text-center py-8">Sin cuentas en esta vista.</p>}
          </div>
        </section>

        {/* Detalle */}
        <section className="col-span-5 border-r border-arena flex flex-col h-full bg-white/70 overflow-hidden">
          {!check ? (
            <div className="flex-1 flex items-center justify-center text-sm text-stone-400 font-headline">Selecciona una cuenta</div>
          ) : (
            <>
              <div className="p-4 border-b border-arena bg-marfil-card/60">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="font-serif-cormorant text-2xl font-bold text-stone-900 tracking-tight">{label(check)}</h1>
                      {check.guests && (<><span className="text-xs text-stone-400">·</span><span className="text-xs text-stone-600 font-medium">{check.guests} Comensales</span></>)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-stone-500 mt-1">
                      <span>Mesero: <strong className="text-stone-700 font-medium">{check.waiterName}</strong></span>
                      <span>·</span>
                      <span>Apertura: <strong className="text-stone-700 font-medium">{hhmm(check.openedAt)} h ({elapsed(check.openedAt)} transcurrido)</strong></span>
                    </div>
                  </div>
                  <button onClick={() => window.print()} className="px-3 py-1.5 rounded-lg border border-arena bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-xs">
                    <span className="material-symbols-outlined text-sm text-stone-600">receipt</span>
                    <span>Pre-cuenta</span>
                  </button>
                </div>
                <div className="mt-4 pt-3 border-t border-arena/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 font-headline">Modo de cobro</span>
                    <div className="inline-flex p-0.5 rounded-lg bg-stone-100 border border-arena">
                      <button className="px-2.5 py-1 text-xs font-semibold bg-stone-900 text-amber-200 rounded-md shadow-xs transition-all">Cuenta completa</button>
                      <button onClick={splitEqual} className="px-2.5 py-1 text-xs text-stone-600 hover:text-stone-900 rounded-md transition-all">Partes iguales</button>
                      <button onClick={splitByGuest} className="px-2.5 py-1 text-xs text-stone-600 hover:text-stone-900 rounded-md transition-all">Por comensal</button>
                    </div>
                  </div>
                  {guests.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 mt-3">
                      {guests.map((g) => {
                        const n = priced.filter((i) => i.guest === g).length;
                        return g === guestSel ? (
                          <div key={g} onClick={() => setGuestSel(null)} className="p-2 rounded-lg border-2 border-stone-800 bg-white shadow-xs cursor-pointer transition-all relative">
                            <div className="flex justify-between items-center text-xs"><span className="font-bold text-stone-900">C{g}</span><span className="font-mono font-bold text-stone-900 text-[11px]">{money(guestTotal(g))}</span></div>
                            <span className="text-[10px] text-terracota font-medium block truncate mt-0.5">Seleccionado</span>
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border-2 border-white" />
                          </div>
                        ) : (
                          <div key={g} onClick={() => setGuestSel(g)} className="p-2 rounded-lg border border-arena bg-marfil/50 hover:bg-marfil cursor-pointer transition-all">
                            <div className="flex justify-between items-center text-xs"><span className="font-bold text-stone-700">C{g}</span><span className="font-mono text-stone-800 text-[11px]">{money(guestTotal(g))}</span></div>
                            <span className="text-[10px] text-stone-400 block truncate mt-0.5">{n} {n === 1 ? "producto" : "productos"}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-stone-400 pb-1 border-b border-arena/40 uppercase tracking-wider font-semibold">
                  <span>Detalle de productos registrados</span>
                  <span>Subtotal</span>
                </div>
                {priced.map((i) => {
                  const hl = guestSel !== null && i.guest === guestSel;
                  const off = i.state === "cancelado" || i.state === "devuelto";
                  return (
                    <div key={i.id} className={hl ? "flex items-start justify-between py-2.5 px-2 -mx-2 rounded-lg bg-amber-50/60 border border-amber-200/50" : `flex items-start justify-between py-2 border-b border-arena/30 ${off ? "opacity-50 line-through" : ""}`}>
                      <div className="flex items-start gap-2.5">
                        <span className={`text-xs font-mono w-5 pt-0.5 ${hl ? "font-bold text-stone-800" : "font-semibold text-stone-500"}`}>{i.quantity}x</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className={`text-xs ${hl ? "font-bold text-stone-900" : "font-semibold text-stone-800"}`}>{i.productName}</p>
                            {i.guest && <span className={hl ? "text-[10px] px-1.5 rounded bg-stone-900 text-amber-200 font-mono font-bold" : "text-[10px] px-1.5 rounded bg-stone-100 text-stone-500 font-mono"}>C{i.guest}</span>}
                          </div>
                          {(i.modifiers.length > 0 || i.note) && <p className="text-[11px] text-stone-500 italic">{[...i.modifiers, i.note].filter(Boolean).join(" · ")}</p>}
                          <span className="text-[10px] text-stone-400 font-mono">Comanda {hhmm(i.sentAt)} h</span>
                        </div>
                      </div>
                      {i.promoDiscount > 0 ? (
                        <span className="text-right leading-tight">
                          <span className="block font-mono text-[10px] text-stone-400 line-through">{money(i.unitPrice * i.quantity)}</span>
                          <span className={`block font-mono text-xs ${hl ? "font-bold text-stone-900" : "font-semibold text-emerald-800"}`}>{money(i.unitPrice * i.quantity - i.promoDiscount)}</span>
                          <span className="block text-[9px] text-emerald-700 font-semibold uppercase tracking-wide">{i.promotionName}</span>
                        </span>
                      ) : (
                        <span className={`font-mono text-xs ${hl ? "font-bold text-stone-900" : "font-semibold text-stone-800"}`}>{money(i.unitPrice * i.quantity)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="p-4 bg-marfil-light border-t border-arena space-y-2">
                <div className="flex justify-between text-xs text-stone-600"><span>Subtotal sin impuestos</span><span className="font-mono">{money(taxes!.base + taxes!.ieps)} MXN</span></div>
                <div className="flex justify-between text-xs text-stone-600"><span>IVA (16% Incluido en precios)</span><span className="font-mono text-stone-500">{money(taxes!.iva)} MXN</span></div>
                {check.discounts > 0 && (
                  <div className="flex justify-between items-center text-xs py-1 px-2 rounded bg-terracota-light/70 border border-terracota/20 text-terracota">
                    <div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-xs">local_offer</span><span>Descuentos y cortesías autorizados</span></div>
                    <span className="font-mono font-semibold">-{money(check.discounts)} MXN</span>
                  </div>
                )}
                <div className="pt-2 border-t border-arena/70 flex justify-between items-baseline">
                  <div>
                    <span className="font-serif-cormorant text-base font-bold text-stone-900 block leading-tight">Total Cuenta</span>
                    <span className="text-[10px] text-stone-400">Total a liquidar{check.guests ? ` (${check.guests} Comensales)` : ""}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-2xl font-bold text-stone-900 tracking-tight">{money(check.total)}</span>
                    <span className="text-xs font-medium text-stone-500 block">MXN</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Liquidación y cobro */}
        <section className="col-span-4 flex flex-col h-full bg-white overflow-y-auto">
          <div className="p-5 flex flex-col h-full justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-arena">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-stone-700">payments</span>
                  <h2 className="font-serif-cormorant text-lg font-bold text-stone-900">Liquidación &amp; Cobro</h2>
                </div>
                {check && <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Listo para cobrar</span>}
              </div>
              {msg && <div className={`text-xs font-medium px-3 py-2 rounded-lg ${msg.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-terracota-light text-terracota border border-terracota/30"}`}>{msg.text}</div>}
              {check && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider font-headline">Propina Sugerida</label>
                      <span className="text-xs text-stone-500 font-mono">+{money(tip)} ({tipPct}%)</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[10, 15, 20, 0].map((p) =>
                        p === tipPct ? (
                          <button key={p} className="py-2 px-1 rounded-lg border-2 border-stone-800 bg-stone-900 text-amber-200 text-center shadow-xs">
                            <span className="block text-xs font-bold">{p ? `${p}%` : "Sin"}</span>
                            <span className="block text-[10px] font-mono opacity-90">{money(Math.round((check.total * p) / 100))}</span>
                          </button>
                        ) : (
                          <button key={p} onClick={() => setTipPct(p)} className="py-2 px-1 rounded-lg border border-arena bg-white hover:bg-stone-50 text-center transition-colors">
                            <span className="block text-xs font-semibold text-stone-700">{p ? `${p}%` : "Sin"}</span>
                            <span className="block text-[10px] font-mono text-stone-400">{money(Math.round((check.total * p) / 100))}</span>
                          </button>
                        ),
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider font-headline">Métodos de Pago Combinado</label>
                      <span className="text-[11px] text-stone-500">Asignar montos</span>
                    </div>
                    <PayBox icon="local_atm" title="Efectivo MXN" tag="Billetes / Monedas" value={amounts.efectivo_mxn} onChange={(v) => setAmounts((a) => ({ ...a, efectivo_mxn: v }))} unit="MXN" />
                    <div className="p-3 rounded-xl border-2 border-stone-800 bg-white space-y-2.5 shadow-xs">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-stone-900 text-lg">credit_card</span>
                        <span className="text-xs font-bold text-stone-900">Tarjeta Bancaria</span>
                      </div>
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-6 relative">
                          <input value={amounts.tarjeta} onChange={(e) => setAmounts((a) => ({ ...a, tarjeta: e.target.value }))} inputMode="decimal" placeholder="0.00" className="w-full pl-3 pr-10 py-1.5 rounded-lg border border-arena bg-stone-50 font-mono text-xs font-bold text-stone-900 text-right focus:outline-none focus:ring-1 focus:ring-stone-400" type="text" />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-stone-400">MXN</span>
                        </div>
                        <div className="col-span-6">
                          <input value={cardRef} onChange={(e) => setCardRef(e.target.value)} placeholder="No. autorización" className="w-full px-2.5 py-1.5 rounded-lg border border-arena bg-white font-mono text-xs text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400" type="text" />
                        </div>
                      </div>
                    </div>
                    <PayBox icon="currency_exchange" title="Dólares USD (Efectivo)" tag={`T.C. ${money(USD_RATE)} MXN`} value={amounts.efectivo_usd} onChange={(v) => setAmounts((a) => ({ ...a, efectivo_usd: v }))} unit="USD" />
                  </div>

                  <div className="p-3.5 rounded-xl bg-stone-100 border border-arena/80 space-y-2">
                    <div className="flex justify-between text-xs text-stone-600"><span>Cuenta + Propina ({tipPct}%):</span><span className="font-mono font-semibold text-stone-800">{money(due)} MXN</span></div>
                    <div className="flex justify-between text-xs text-stone-600"><span>Total Ingresado:</span><span className="font-mono font-semibold text-stone-800">{money(entered)} MXN</span></div>
                    <div className="pt-2 border-t border-arena flex items-center justify-between bg-stone-900 -mx-3.5 -mb-3.5 p-3 rounded-b-xl text-amber-200">
                      <div>
                        <span className="text-[11px] uppercase tracking-wider font-semibold text-amber-200/80 block">Cambio a Entregar</span>
                        <span className="text-[10px] text-stone-400">Efectivo en caja</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-2xl font-bold tracking-tight text-amber-200">{money(change)}</span>
                        <span className="text-[10px] font-mono text-amber-300/80 block">MXN</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            {check && (
              <div className="space-y-2.5 pt-2">
                <button disabled={entered < due} onClick={pay} className="w-full py-3.5 px-4 bg-stone-900 hover:bg-stone-800 text-amber-200 rounded-xl font-headline font-semibold text-sm tracking-wide uppercase flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed">
                  <span className="material-symbols-outlined text-lg">print</span>
                  <span>Registrar cobro y emitir ticket</span>
                </button>
                <p className="text-[10px] text-stone-500 text-center leading-relaxed pt-1">
                  <span className="material-symbols-outlined text-xs align-text-top text-stone-400 mr-0.5">info</span>
                  El cobro con tarjeta se realiza en la terminal externa y se valida con el número de autorización.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}

function PayBox(props: { icon: string; title: string; tag: string; value: string; onChange: (v: string) => void; unit: string }) {
  return (
    <div className="p-3 rounded-xl border border-arena bg-marfil-card/80 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-stone-600 text-lg">{props.icon}</span>
          <span className="text-xs font-semibold text-stone-800">{props.title}</span>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-200 text-stone-600 font-mono">{props.tag}</span>
      </div>
      <div className="relative">
        <input value={props.value} onChange={(e) => props.onChange(e.target.value)} inputMode="decimal" placeholder="0.00" className="w-full pl-3 pr-12 py-2 rounded-lg border border-arena bg-white font-mono text-sm font-bold text-stone-900 text-right focus:outline-none focus:ring-1 focus:ring-stone-400" type="text" />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-stone-400">{props.unit}</span>
      </div>
    </div>
  );
}
