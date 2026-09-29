/* Diseño: design/stitch/admin-cxp.html (Stitch). Marcado y clases originales; datos reales. E8-05, E8-06, E8-07. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { PurchasingApi, type Payable } from "./api";

const money = (c: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(c / 100);
const date = (iso: string | null) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const initials = (s: string) => s.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
type Filter = "todas" | "vencidas" | "semana" | "pagadas";
const STATE: Record<Payable["state"], { label: string; cls: string }> = {
  vencida: { label: "Vencida", cls: "bg-[#B45A3C]/10 text-[#B45A3C] border-[#B45A3C]/30" },
  por_vencer: { label: "Por vencer", cls: "bg-[#D4AF7C]/20 text-[#8C6D37] border-[#D4AF7C]/50" },
  parcial: { label: "Pago parcial", cls: "bg-sky-50 text-sky-900 border-sky-200" },
  al_corriente: { label: "Al corriente", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  pagada: { label: "Pagada", cls: "bg-stone-100 text-stone-600 border-stone-200" },
};

export function PayablesPage() {
  const [rows, setRows] = useState<Payable[]>([]);
  const [filter, setFilter] = useState<Filter>("todas");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Payable | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"transferencia" | "efectivo_caja" | "cheque">("transferencia");
  const [ref, setRef] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => PurchasingApi.payables().then((r) => { setRows(r); setSel((s) => (s ? r.find((x) => x.id === s.id) ?? null : null)); }), []);
  useEffect(() => { load(); }, [load]);

  const open = rows.filter((r) => r.status !== "pagada");
  const total = open.reduce((s, r) => s + r.balance, 0);
  const overdue = open.filter((r) => r.state === "vencida");
  const week = open.filter((r) => r.daysToDue >= 0 && r.daysToDue <= 7);
  const aging = useMemo(() => {
    const b = [
      { label: "Al corriente", color: "bg-[#2A5D45]", test: (d: number) => d >= 0 },
      { label: "1 a 15 días vencido", color: "bg-[#D4AF7C]", test: (d: number) => d < 0 && d >= -15 },
      { label: "16 a 30 días vencido", color: "bg-[#B8860B]", test: (d: number) => d < -15 && d >= -30 },
      { label: "+30 días vencido (Crítico)", color: "bg-[#B45A3C]", test: (d: number) => d < -30 },
    ];
    return b.map((x) => { const amt = open.filter((r) => x.test(r.daysToDue)).reduce((s, r) => s + r.balance, 0); return { ...x, amt, pct: total ? (amt / total) * 100 : 0 }; });
  }, [open, total]);

  const shown = rows
    .filter((r) => (filter === "todas" ? r.status !== "pagada" : filter === "vencidas" ? r.state === "vencida" : filter === "semana" ? r.status !== "pagada" && r.daysToDue >= 0 && r.daysToDue <= 7 : r.status === "pagada"))
    .filter((r) => r.supplier.toLowerCase().includes(q.toLowerCase()) || (r.folio ?? "").toLowerCase().includes(q.toLowerCase()));

  const pay = async () => {
    if (!sel) return;
    try {
      const r = await PurchasingApi.pay({ payableId: sel.id, amount: Math.round(Number(amount) * 100), method, reference: ref || undefined });
      setMsg({ ok: true, text: r.status === "pagada" ? "Factura liquidada." : `Pago registrado. Saldo pendiente ${money(r.balance)}.` });
      setAmount(""); setRef(""); load();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  };

  return (
    <div className="flex-1 bg-[#F7F5F0] min-h-screen relative">
      <main className="flex-1 p-6 lg:p-8 2xl:pr-[420px] transition-all duration-200">
        <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#C9B89F]/40 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#B8860B] font-semibold mb-1">Tesorería &amp; Proveeduría</div>
            <h1 className="text-2xl lg:text-3xl font-display font-semibold text-[#1E2F28] tracking-tight">Cuentas por Pagar &amp; Tesorería</h1>
            <p className="text-xs text-[#1A1A1A]/70 mt-1">Control de vencimientos y liquidación de facturas de proveedores.</p>
          </div>
          <div className="flex items-center gap-1.5 p-1 bg-[#E8E2D5]/70 rounded-lg border border-[#C9B89F]/50">
            {([["todas", "Todas las facturas"], ["vencidas", "Vencidas"], ["semana", "Por vencer en 7 días"], ["pagadas", "Pagadas"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className={filter === k ? "px-3 py-1.5 text-xs font-medium bg-white text-[#1E2F28] rounded shadow-xs" : `px-3 py-1.5 text-xs font-medium hover:bg-white/60 rounded flex items-center gap-1.5 transition-colors ${k === "vencidas" ? "text-[#B45A3C]" : "text-[#1A1A1A]/80"}`}>
                {l}
                {k === "vencidas" && overdue.length > 0 && <span className="w-4 h-4 rounded-full bg-[#B45A3C] text-white text-[10px] flex items-center justify-center font-mono">{overdue.length}</span>}
              </button>
            ))}
          </div>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Kpi title="Total por Pagar" icon="account_balance_wallet" value={money(total)} note={`${open.length} facturas activas`} bar="bg-[#1E2F28]" />
          <Kpi title="Vencido (Urgente)" icon="priority_high" value={money(overdue.reduce((s, r) => s + r.balance, 0))} note={`${overdue.length} facturas vencidas`} bar="bg-[#B45A3C]" danger />
          <Kpi title="Vence esta semana" icon="event_upcoming" value={money(week.reduce((s, r) => s + r.balance, 0))} note={`${week.length} facturas prioritarias`} bar="bg-[#D4AF7C]" />
        </section>

        <section className="bg-[#FBF9F5] rounded-lg border border-[#C9B89F] p-5 mb-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#C9B89F]/30 gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#1E2F28]">bar_chart</span>
              <h3 className="font-headline font-semibold text-sm text-[#1E2F28] tracking-wide uppercase">Antigüedad de Saldos Proveedores</h3>
            </div>
            <span className="text-xs text-[#1A1A1A]/60">Corte al {date(new Date().toISOString())}</span>
          </div>
          <div className="mt-4">
            <div className="h-3 w-full rounded-full bg-[#E8E2D5] overflow-hidden flex shadow-inner">
              {aging.map((a) => <div key={a.label} className={`h-full ${a.color}`} style={{ width: `${a.pct}%` }} title={`${a.label}: ${a.pct.toFixed(1)}%`} />)}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-2">
              {aging.map((a, i) => (
                <div key={a.label} className={i === 3 ? "p-2.5 rounded bg-[#B45A3C]/5 border border-[#B45A3C]/20" : "p-2.5 rounded bg-white/70 border border-[#C9B89F]/30"}>
                  <div className="flex items-center gap-1.5 mb-1"><span className={`w-2.5 h-2.5 rounded-full ${a.color}`} /><span className={`text-xs font-medium ${i === 3 ? "text-[#B45A3C] font-semibold" : "text-[#1A1A1A]/80"}`}>{a.label}</span></div>
                  <div className={`text-base font-semibold font-display ${i === 3 ? "text-[#B45A3C]" : "text-[#1E2F28]"}`}>{money(a.amt)}</div>
                  <div className={`text-[11px] ${i === 3 ? "text-[#B45A3C]/80" : "text-[#1A1A1A]/60"}`}>{a.pct.toFixed(1)}% del pasivo total</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#FBF9F5] rounded-lg border border-[#C9B89F] shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[#C9B89F] bg-[#F6F3EC]/70 flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#1A1A1A]/50"><span className="material-symbols-outlined" style={{ fontSize: "18px" }}>search</span></span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar proveedor o folio" className="w-full pl-9 pr-3 py-1.5 text-xs bg-white rounded border border-[#C9B89F] focus:outline-none focus:border-[#1E2F28] focus:ring-1 focus:ring-[#1E2F28]" />
            </div>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#C9B89F] bg-[#EAE6DD]/60 font-medium text-[#1E2F28] uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Proveedor</th>
                  <th className="py-3.5 px-4">Folio Factura</th>
                  <th className="py-3.5 px-4">Recepción / Vencimiento</th>
                  <th className="py-3.5 px-4 text-right">Monto Factura</th>
                  <th className="py-3.5 px-4 text-right">Saldo Pendiente</th>
                  <th className="py-3.5 px-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#C9B89F]/40 font-body">
                {shown.map((r) => (
                  <tr key={r.id} onClick={() => { setSel(r); setAmount(String(r.balance / 100)); setMsg(null); }}
                    className={r.id === sel?.id ? "bg-[#FFFDF9] border-l-4 border-l-[#D4AF7C] ring-1 ring-[#D4AF7C]/60 cursor-pointer" : "hover:bg-[#FDFBF7] transition-colors cursor-pointer"}>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-[#1E2F28]/10 text-[#1E2F28] font-bold flex items-center justify-center font-display border border-[#1E2F28]/20">{initials(r.supplier)}</div>
                        <div className="font-semibold text-sm text-[#1E2F28]">{r.supplier}</div>
                      </div>
                    </td>
                    <td className="py-4 px-4"><div className="font-medium text-[#1E2F28]">{r.folio ? `Factura ${r.folio}` : "Sin folio"}</div></td>
                    <td className="py-4 px-4">
                      <div className="text-[#1A1A1A]/70">{date(r.receivedAt)}</div>
                      <div className={`font-semibold ${r.state === "vencida" ? "text-[#B45A3C]" : "text-[#1E2F28]"}`}>{date(r.dueAt)}</div>
                    </td>
                    <td className="py-4 px-4 text-right"><span className="font-mono text-xs text-[#1A1A1A]/70">{money(r.amount)}</span></td>
                    <td className="py-4 px-4 text-right"><span className={`font-mono text-sm font-bold ${r.state === "vencida" ? "text-[#B45A3C]" : "text-[#1E2F28]"}`}>{money(r.balance)}</span></td>
                    <td className="py-4 px-4 text-center"><span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-semibold ${STATE[r.state].cls}`}>{STATE[r.state].label}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length === 0 && <p className="p-5 text-xs text-[#1A1A1A]/60">Sin facturas en esta vista.</p>}
          </div>
        </section>
      </main>

      <aside className="2xl:fixed 2xl:right-0 2xl:top-0 2xl:bottom-0 2xl:w-[400px] bg-white border-l border-[#C9B89F] shadow-xl p-6 overflow-y-auto">
        <h2 className="font-display text-xl font-semibold text-[#1E2F28]">Registrar pago</h2>
        {!sel ? (
          <p className="text-xs text-[#1A1A1A]/60 mt-3">Selecciona una factura de la tabla.</p>
        ) : (
          <div className="mt-4 space-y-4 text-xs">
            <div className="p-3.5 rounded-lg bg-[#FBF9F5] border border-[#C9B89F]/60">
              <div className="font-semibold text-sm text-[#1E2F28]">{sel.supplier}</div>
              <div className="text-[#1A1A1A]/60">{sel.folio ? `Factura ${sel.folio}` : "Sin folio"} · vence {date(sel.dueAt)}</div>
              <div className="mt-2 flex justify-between"><span>Saldo pendiente</span><strong className="font-mono text-[#1E2F28]">{money(sel.balance)}</strong></div>
            </div>
            {msg && <div className={`px-3 py-2 rounded-lg border font-medium ${msg.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-[#B45A3C]/10 border-[#B45A3C]/30 text-[#B45A3C]"}`}>{msg.text}</div>}
            {sel.status !== "pagada" && (
              <>
                <label className="block"><span className="text-[11px] font-semibold uppercase tracking-wider text-[#1A1A1A]/70">Monto</span>
                  <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded border-[#C9B89F] font-mono text-sm focus:ring-[#1E2F28]" />
                </label>
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#1A1A1A]/70">Forma de pago</span>
                  <div className="mt-1 grid grid-cols-3 gap-1.5">
                    {([["transferencia", "Transferencia"], ["efectivo_caja", "Efectivo (caja)"], ["cheque", "Cheque"]] as const).map(([k, l]) => (
                      <button key={k} onClick={() => setMethod(k)} className={method === k ? "py-2 rounded border-2 border-[#1E2F28] bg-[#1E2F28] text-[#D4AF7C] font-semibold" : "py-2 rounded border border-[#C9B89F] bg-white text-[#1A1A1A]"}>{l}</button>
                    ))}
                  </div>
                  {method === "efectivo_caja" && <p className="mt-1 text-[11px] text-[#8C6D37]">Sale de tu caja abierta y aparece en tu corte.</p>}
                </div>
                <label className="block"><span className="text-[11px] font-semibold uppercase tracking-wider text-[#1A1A1A]/70">Referencia / comprobante</span>
                  <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="SPEI, folio de cheque o vale" className="mt-1 w-full rounded border-[#C9B89F] text-xs focus:ring-[#1E2F28]" />
                </label>
                <button disabled={!Number(amount)} onClick={pay} className="w-full py-3 rounded-lg bg-[#1E2F28] text-[#D4AF7C] font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  <span className="material-symbols-outlined">payments</span>Registrar pago
                </button>
              </>
            )}
            {sel.payments.length > 0 && (
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#1A1A1A]/70">Pagos registrados</span>
                <div className="mt-1 divide-y divide-[#C9B89F]/40">
                  {sel.payments.map((p, i) => (
                    <div key={i} className="py-2 flex justify-between"><span>{date(p.at)} · {p.method.replace("_", " ")}{p.reference ? ` · ${p.reference}` : ""}</span><strong className="font-mono">{money(p.amount)}</strong></div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

function Kpi({ title, icon, value, note, bar, danger }: { title: string; icon: string; value: string; note: string; bar: string; danger?: boolean }) {
  return (
    <div className={`bg-[#FBF9F5] p-5 rounded-lg border shadow-xs relative overflow-hidden flex flex-col justify-between ${danger ? "border-[#B45A3C]/40" : "border-[#C9B89F]"}`}>
      <div className="flex items-start justify-between">
        <span className={`text-xs font-medium uppercase tracking-wider ${danger ? "text-[#B45A3C]" : "text-[#1A1A1A]/70"}`}>{title}</span>
        <span className={`p-1.5 rounded ${danger ? "bg-[#B45A3C]/10 text-[#B45A3C]" : "bg-[#1E2F28]/5 text-[#1E2F28]"}`}><span className="material-symbols-outlined" style={{ fontSize: "18px" }}>{icon}</span></span>
      </div>
      <div className="mt-3">
        <div className={`text-2xl font-display font-semibold ${danger ? "text-[#B45A3C]" : "text-[#1E2F28]"}`}>{value} <span className="text-xs font-sans opacity-60">MXN</span></div>
        <div className={`text-xs mt-1 ${danger ? "text-[#B45A3C] font-medium" : "text-[#1A1A1A]/70"}`}>{note}</div>
      </div>
      <div className={`absolute bottom-0 left-0 right-0 h-1 ${bar}`} />
    </div>
  );
}
