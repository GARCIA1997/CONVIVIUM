/* Pedidos para llevar (E3-11). Clases y componentes del diseño Stitch de caja (caja-tpv). */
import { useRealtime, useSession } from "@convivium/app-shell";
import { useCallback, useEffect, useState } from "react";
import { NewTakeout } from "./NewTakeout";

interface Takeout {
  id: string; folio: number; label: string; customerName: string | null; customerPhone: string | null; channel: string | null;
  pickupAt: string | null; openedAt: string; handedOverAt: string | null; disposables: boolean | null; note: string | null;
  stage: "preparacion" | "listo" | "entregado"; paid: boolean; total: number; summary: string; itemCount: number;
}
const money = (c: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(c / 100);
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
const CHANNEL: Record<string, { label: string; icon: string }> = { mostrador: { label: "Mostrador", icon: "storefront" }, telefono: { label: "Teléfono", icon: "call" }, whatsapp: { label: "WhatsApp", icon: "chat" } };
const COLS: { stage: Takeout["stage"]; title: string; dot: string }[] = [
  { stage: "preparacion", title: "En preparación", dot: "bg-amber-500" },
  { stage: "listo", title: "Listo para entregar", dot: "bg-emerald-500 animate-pulse" },
  { stage: "entregado", title: "Entregado hoy", dot: "bg-stone-400" },
];

export function TakeoutView({ onCharge, onCount }: { onCharge: (checkId: string) => void; onCount: (n: number) => void }) {
  const { client } = useSession();
  const [list, setList] = useState<Takeout[]>([]);
  const [now, setNow] = useState(Date.now());
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const load = useCallback(() => client.request<Takeout[]>("GET", "/orders/takeout").then((l) => { setList(l); onCount(l.filter((t) => t.stage !== "entregado").length); }), [client, onCount]);
  useEffect(() => { load(); const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, [load]);
  useRealtime(["floor"], () => load());

  const handOver = async (t: Takeout) => {
    setErr(null);
    try { await client.request("POST", `/orders/checks/${t.id}/hand-over`); await load(); }
    catch (e) { setErr((e as Error).message); }
  };
  const notify = (t: Takeout) => {
    const msg = `Hola ${t.customerName ?? ""}, tu pedido ${t.label} de CONVIVIUM ya está listo para recoger. Total ${money(t.total)}.`;
    window.open(`https://wa.me/52${(t.customerPhone ?? "").replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(msg)}`, "_blank");
  };
  const active = list.filter((t) => t.stage !== "entregado");
  const delivered = list.filter((t) => t.stage === "entregado" && t.handedOverAt);
  const avgMin = delivered.length ? Math.round(delivered.reduce((n, t) => n + (Date.parse(t.handedOverAt!) - Date.parse(t.openedAt)), 0) / delivered.length / 60000) : null;

  const Card = ({ t }: { t: Takeout }) => {
    const due = t.pickupAt ? Date.parse(t.pickupAt) : null;
    const late = t.stage !== "entregado" && due !== null && due < now;
    const mins = due !== null ? Math.round((due - now) / 60000) : null;
    const ch = CHANNEL[t.channel ?? "mostrador"] ?? CHANNEL.mostrador!;
    return (
      <article className={`bg-white rounded-xl border p-4 shadow-sm space-y-3 ${late ? "border-terracota/60 ring-1 ring-terracota/30" : "border-arena/60"} ${t.stage === "entregado" ? "opacity-70" : ""}`}>
        <div className="flex items-start justify-between">
          <div>
            <span className="font-headline text-xl font-bold text-olivo">{t.label}</span>
            <p className="text-xs font-medium text-stone-800">{t.customerName}</p>
          </div>
          <div className="text-right">
            <span className="font-mono text-sm font-bold text-stone-900">{money(t.total)}</span>
            <span className={`block text-[10px] font-semibold mt-0.5 px-1.5 py-0.5 rounded border ${t.paid ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-amber-50 text-amber-800 border-amber-200"}`}>{t.paid ? "Pagado" : "Por cobrar"}</span>
          </div>
        </div>
        <p className="text-[11px] text-stone-600 leading-snug">{t.summary || "Sin productos capturados"}</p>
        {t.note && <p className="text-[11px] italic text-stone-500">“{t.note}”</p>}
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200"><span className="material-symbols-outlined text-[12px]">{ch.icon}</span>{ch.label}</span>
          {t.disposables && <span className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200">Desechables</span>}
          <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${late ? "bg-terracota/10 text-terracota border-terracota/30 font-semibold" : "bg-stone-50 text-stone-600 border-stone-200"}`}>
            <span className="material-symbols-outlined text-[12px]">schedule</span>
            {t.stage === "entregado" && t.handedOverAt ? `Entregado ${hhmm(t.handedOverAt)}` : due ? `Recoge ${hhmm(t.pickupAt!)}${mins !== null ? (late ? ` · ${-mins} min tarde` : ` · en ${mins} min`) : ""}` : "Lo antes posible"}
          </span>
        </div>
        {t.stage !== "entregado" && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            {t.customerPhone && t.stage === "listo" && <button onClick={() => notify(t)} className="col-span-2 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5"><span className="material-symbols-outlined text-sm">chat</span>Avisar que está listo</button>}
            {!t.paid && <button onClick={() => onCharge(t.id)} className="py-2 rounded-lg bg-olivo text-amber-100 text-xs font-semibold flex items-center justify-center gap-1"><span className="material-symbols-outlined text-sm">payments</span>Cobrar</button>}
            <button disabled={!t.paid} title={t.paid ? "" : "Cobra antes de entregar"} onClick={() => handOver(t)} className={`py-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-40 ${t.paid ? "col-span-2 bg-white border-olivo text-olivo" : "bg-white border-arena text-stone-700"}`}><span className="material-symbols-outlined text-sm">check_circle</span>Marcar entregado</button>
          </div>
        )}
      </article>
    );
  };

  return (
    <main className="flex-1 p-6 space-y-5 bg-marfil min-h-screen">
      <div className="flex items-end justify-between">
        <div><span className="text-[11px] font-bold uppercase tracking-[0.2em] text-terracota">Caja</span><h1 className="font-headline text-2xl font-bold text-olivo">Pedidos para llevar</h1><p className="text-xs text-stone-500">Se capturan aquí en el mostrador o desde el comandero. Se cobran, se avisa al cliente y se entregan.</p></div>
        <button onClick={() => setCreating(true)} className="px-4 py-2.5 rounded-lg bg-olivo text-amber-100 text-sm font-semibold flex items-center gap-1.5 shadow-sm"><span className="material-symbols-outlined text-base">add</span>Nuevo pedido para llevar</button>
      </div>
      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[["Activos", String(active.length), "takeout_dining"], ["Listos por entregar", String(list.filter((t) => t.stage === "listo").length), "notifications_active"], ["Tiempo promedio", avgMin !== null ? `${avgMin} min` : "—", "timer"], ["Venta para llevar hoy", money(list.reduce((n, t) => n + t.total, 0)), "payments"]].map(([t, v, i]) => (
          <div key={t} className="bg-white rounded-xl border border-arena/60 p-4 shadow-sm"><div className="flex items-center justify-between text-[11px] text-stone-500 uppercase tracking-wider font-semibold"><span>{t}</span><span className="material-symbols-outlined text-base text-olivo">{i}</span></div><span className="font-headline text-2xl font-bold text-stone-900">{v}</span></div>
        ))}
      </section>
      {err && <p className="text-xs text-terracota">{err}</p>}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {COLS.map((c) => {
          const items = list.filter((t) => t.stage === c.stage);
          return (
            <div key={c.stage} className="bg-stone-100/70 rounded-xl p-3 space-y-3 min-h-[200px]">
              <div className="flex items-center justify-between px-1"><span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-700"><span className={`w-2 h-2 rounded-full ${c.dot}`} />{c.title}</span><span className="text-xs font-mono text-stone-500">{items.length}</span></div>
              {items.map((t) => <Card key={t.id} t={t} />)}
              {!items.length && <p className="text-[11px] text-stone-400 italic px-1">Sin pedidos.</p>}
            </div>
          );
        })}
      </section>
      {creating && <NewTakeout onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }} />}
    </main>
  );
}
