/* Diseño: design/stitch/mesero-plano-mesas.html (Stitch). Marcado y clases originales; datos reales. E3-01, E3-10. */
import type { FloorPlan } from "@convivium/api-client";
import { useRealtime, useSession } from "@convivium/app-shell";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MeseroLayout } from "../layout/MeseroLayout";
import { JoinPicker } from "./JoinPicker";

type Table = FloorPlan["tables"][number];

const SHAPE: Record<string, string> = { redonda: "Redonda", cuadrada: "Cuadrada", rectangular: "Rectangular", periquera: "Periquera" };
const mxn = (c: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(c / 100);
function since(iso: string | null) {
  if (!iso) return "";
  const m = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function FloorPage() {
  const { client, session } = useSession();
  const nav = useNavigate();
  const [plan, setPlan] = useState<FloorPlan | null>(null);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ kind: "mesa"; table: Table } | { kind: "barra" } | { kind: "llevar" } | null>(null);
  const [takeout, setTakeout] = useState<{ id: string; label: string; customerName: string | null; stage: string; pickupAt: string | null }[]>([]);
  const canTakeout = session.permissions.includes("pedido_llevar.abrir");
  const loadTakeout = useCallback(() => (canTakeout ? client.request<typeof takeout>("GET", "/orders/takeout").then((l) => setTakeout(l.filter((t) => t.stage !== "entregado"))) : Promise.resolve()), [client, canTakeout]);
  useEffect(() => { loadTakeout(); }, [loadTakeout]);

  const load = useCallback(() => client.floor.get().then((p) => { setPlan(p); setAreaId((a) => a ?? p.areas[0]?.id ?? null); }), [client]);
  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, [load]);
  useRealtime(["floor"], () => { load(); loadTakeout(); });

  const openTable = (t: Table) => (t.openCheckId ? nav(`/cuenta/${t.openCheckId}`) : setSheet({ kind: "mesa", table: t }));
  const confirmTable = async (tableId: string, guests: number, joinTableIds: string[]) => nav(`/cuenta/${(await client.orders.open({ kind: "mesa", tableId, guests, joinTableIds })).id}`);
  const confirmBar = async (name: string) => nav(`/cuenta/${(await client.orders.open({ kind: "barra", name })).id}`);
  const confirmTakeout = async (body: TakeoutForm) => nav(`/cuenta/${(await client.orders.open({ kind: "llevar", ...body })).id}`);

  const tables = plan?.tables.filter((t) => t.areaId === areaId) ?? [];
  const count = (s: string) => plan?.tables.filter((t) => t.status === s).length ?? 0;

  const tabs = (
    <nav aria-label="Áreas de Restaurante" className="flex items-center gap-2 mt-3 pt-2 border-t border-[#C9B89F]/20">
      {plan?.areas.map((a) =>
        a.id === areaId ? (
          <button key={a.id} className="flex-1 py-1.5 text-center text-xs font-medium tracking-wider uppercase transition-all relative text-[#D4AF7C] bg-[#14201B]/80 rounded-md border border-[#D4AF7C]/40">
            {a.name}
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-[2px] bg-[#D4AF7C] rounded-full" />
          </button>
        ) : (
          <button key={a.id} onClick={() => setAreaId(a.id)} className="flex-1 py-1.5 text-center text-xs font-normal tracking-wider uppercase text-[#C9B89F] hover:text-[#EAE6DD] transition-all rounded-md">
            {a.name}
          </button>
        ),
      )}
    </nav>
  );

  return (
    <MeseroLayout subheader={tabs}>
      <section aria-label="Estados de Mesa" className="px-3.5 py-2.5 bg-[#EAE6DD] border-b border-[#C9B89F]/30 flex items-center justify-between overflow-x-auto custom-scrollbar gap-2">
        <div className="flex items-center gap-1.5 bg-[#F5F3EF] px-2.5 py-1 rounded border border-[#C9B89F] shadow-xs flex-shrink-0">
          <span className="w-2 h-2 rounded-full bg-stone-400" />
          <span className="text-[11px] font-medium text-[#1A1A1A]">Libre ({count("libre")})</span>
        </div>
        <div className="flex items-center gap-1.5 bg-[#1E2F28] px-2.5 py-1 rounded text-[#EAE6DD] flex-shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-[11px] font-medium">Ocupada ({count("ocupada")})</span>
        </div>
        <div className="flex items-center gap-1.5 bg-[#D4AF7C] px-2.5 py-1 rounded text-[#1E2F28] flex-shrink-0">
          <span className="material-symbols-outlined text-[13px] animate-bounce">notifications_active</span>
          <span className="text-[11px] font-semibold">Listo ({count("listo_por_entregar")})</span>
        </div>
        <div className="flex items-center gap-1.5 bg-[#B45A3C] px-2.5 py-1 rounded text-white flex-shrink-0">
          <span className="material-symbols-outlined text-[13px]">receipt_long</span>
          <span className="text-[11px] font-semibold">Cuenta ({count("pidio_cuenta")})</span>
        </div>
      </section>

      <main className="flex-1 px-3 py-2 overflow-y-auto custom-scrollbar">
        {!plan && <p className="text-xs text-stone-500 p-4">Cargando plano…</p>}
        <div className="grid grid-cols-2 gap-2.5">
          {takeout.length > 0 && (
            <div className="col-span-2 -mt-1 mb-1 flex gap-2 overflow-x-auto pb-1">
              {takeout.map((t) => (
                <button key={t.id} onClick={() => nav(`/cuenta/${t.id}`)} className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium ${t.stage === "listo" ? "bg-[#D4AF7C] text-[#1E2F28] border-[#1E2F28]/30" : "bg-white text-[#1E2F28] border-[#C9B89F]"}`}>
                  <span className="material-symbols-outlined text-[16px]">takeout_dining</span>
                  <span className="font-display font-bold">{t.label}</span>
                  <span className="text-[11px] opacity-80 max-w-[90px] truncate">{t.customerName}</span>
                  {t.stage === "listo" && <span className="text-[10px] font-semibold">· Listo</span>}
                </button>
              ))}
            </div>
          )}
          {tables.map((t) => <TableCard key={t.id} t={t} me={session.user.id} onClick={() => openTable(t)} />)}
        </div>
      </main>

      <div className="fixed bottom-[74px] right-[calc(50%-195px+14px)] max-md:right-4 z-40 flex flex-col items-end gap-2">
        {canTakeout && (
          <button onClick={() => setSheet({ kind: "llevar" })} className="bg-[#D4AF7C] text-[#1E2F28] border border-[#1E2F28]/20 shadow-lg px-3.5 py-2.5 rounded-full flex items-center gap-2 active:scale-95 transition-all text-xs font-semibold tracking-wide">
            <span className="material-symbols-outlined text-[18px]">takeout_dining</span>
            <span>Para llevar</span>
          </button>
        )}
        <button onClick={() => setSheet({ kind: "barra" })} className="bg-[#1E2F28] text-[#D4AF7C] border border-[#D4AF7C]/40 shadow-lg px-3.5 py-2.5 rounded-full flex items-center gap-2 hover:bg-[#14201B] active:scale-95 transition-all text-xs font-medium tracking-wide">
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Cuenta de barra</span>
        </button>
      </div>

      {sheet?.kind === "mesa" && <GuestsSheet table={sheet.table} tables={plan?.tables ?? []} onCancel={() => setSheet(null)} onConfirm={(g, j) => confirmTable(sheet.table.id, g, j)} />}
      {sheet?.kind === "barra" && <BarSheet onCancel={() => setSheet(null)} onConfirm={confirmBar} />}
      {sheet?.kind === "llevar" && <TakeoutSheet onCancel={() => setSheet(null)} onConfirm={confirmTakeout} />}
    </MeseroLayout>
  );
}

function TableCard({ t, me, onClick }: { t: Table; me: string; onClick: () => void }) {
  const shape = SHAPE[t.shape] ?? "";
  if (t.status === "libre")
    return (
      <article onClick={onClick} className="bg-[#F5F3EF] text-[#1A1A1A] rounded-lg p-3 border border-[#C9B89F] shadow-2xs flex flex-col justify-between h-[122px] relative active:bg-[#EAE6DD] transition-all cursor-pointer">
        <div className="flex justify-between items-start">
          <div className="flex items-baseline gap-1">
            <span className="font-display text-lg font-bold tracking-tight text-[#1E2F28]">{t.label}</span>
            <span className="text-[10px] text-stone-500">· {shape}</span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] text-stone-600">
            <span className="material-symbols-outlined text-[13px]">group</span>
            {t.capacity}
          </span>
        </div>
        <div className="my-auto text-center py-1">
          <span className="inline-block px-2 py-0.5 rounded-full bg-stone-200/80 text-[11px] font-medium text-stone-700">Disponible</span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-stone-500 border-t border-[#C9B89F]/30 pt-1.5">
          <span className="truncate">{t.assignedUserId === me ? "★ Tu sección" : t.assignedName ? `Sección ${t.assignedName.split(" ")[0]}` : t.mergeableWith.length ? "Unible" : "Montada"}</span>
          <span className="font-medium text-[#1E2F28]">Abrir +</span>
        </div>
      </article>
    );

  if (t.status === "pidio_cuenta")
    return (
      <article onClick={onClick} className="bg-[#B45A3C] text-white rounded-lg p-3 border border-[#B45A3C] shadow-sm flex flex-col justify-between h-[122px] relative active:opacity-90 transition-all cursor-pointer">
        <div className="flex justify-between items-start">
          <div className="flex items-baseline gap-1">
            <span className="font-display text-lg font-bold tracking-tight text-white">{t.label}</span>
            <span className="text-[10px] text-orange-200">· {shape}</span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] text-orange-100">
            <span className="material-symbols-outlined text-[13px]">group</span>
            {t.guests}
          </span>
        </div>
        <div className="my-auto flex items-center justify-between bg-black/15 px-2 py-1 rounded">
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px] text-white">receipt</span>
            <span className="text-xs font-semibold">Pidió cuenta</span>
          </div>
          <span className="text-[11px] font-bold text-orange-200">{mxn(t.total ?? 0)}</span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-orange-100 border-t border-white/20 pt-1.5">
          <span className="flex items-center gap-0.5">
            <span className="material-symbols-outlined text-[11px]">timer</span>
            {since(t.openedAt)}
          </span>
          <span className="font-bold underline text-white">Ver cuenta</span>
        </div>
      </article>
    );

  if (t.status === "listo_por_entregar")
    return (
      <article onClick={onClick} className="bg-[#D4AF7C] text-[#1E2F28] rounded-lg p-3 border-2 border-[#1E2F28]/30 shadow-md flex flex-col justify-between h-[122px] relative pulse-ready active:scale-[0.99] transition-all cursor-pointer">
        <div className="flex justify-between items-start">
          <div className="flex items-baseline gap-1">
            <span className="font-display text-lg font-bold tracking-tight text-[#1E2F28]">{t.label}</span>
            <span className="text-[10px] text-[#1E2F28]/70">· {shape}</span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1E2F28]">
            <span className="material-symbols-outlined text-[13px]">group</span>
            {t.guests}
          </span>
        </div>
        <div className="my-auto flex items-center gap-1.5 bg-[#1E2F28]/10 px-2 py-1 rounded">
          <span className="material-symbols-outlined text-[18px] text-[#B45A3C] animate-pulse">notifications_active</span>
          <div className="leading-none">
            <span className="text-[11px] font-bold text-[#1E2F28] block">¡Platillo Listo!</span>
            <span className="text-[9px] text-[#1E2F28]/80 font-medium">{t.readyStation}</span>
          </div>
        </div>
        <div className="flex items-center justify-between text-[10px] text-[#1E2F28]/90 border-t border-[#1E2F28]/20 pt-1.5 font-medium">
          <span className="flex items-center gap-0.5">
            <span className="material-symbols-outlined text-[11px]">schedule</span>
            {since(t.openedAt)}
          </span>
          <span className="font-bold uppercase tracking-wider text-[9px] bg-[#1E2F28] text-[#D4AF7C] px-1.5 py-0.5 rounded">Llevar</span>
        </div>
      </article>
    );

  return (
    <article onClick={onClick} className="bg-[#1E2F28] text-[#EAE6DD] rounded-lg p-3 border border-[#1E2F28] shadow-sm flex flex-col justify-between h-[122px] relative active:opacity-90 transition-all cursor-pointer">
      <div className="flex justify-between items-start">
        <div className="flex items-baseline gap-1">
          <span className="font-display text-lg font-bold tracking-tight text-[#EAE6DD]">{t.label}</span>
          <span className="text-[10px] text-[#C9B89F]">· {shape}</span>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] text-[#C9B89F]">
          <span className="material-symbols-outlined text-[13px]">group</span>
          {t.guests}
        </span>
      </div>
      <div className="my-auto">
        {t.joinedTo ? (
          <span className="text-xs font-semibold text-[#D4AF7C] flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">link</span>Unida a {t.joinedTo}</span>
        ) : (
          <>
            <span className="text-xs font-semibold text-[#D4AF7C] block">{mxn(t.total ?? 0)} MXN</span>
            <p className="text-[11px] text-[#EAE6DD]/80">{t.itemCount} {t.itemCount === 1 ? "platillo" : "platillos"} en mesa</p>
          </>
        )}
      </div>
      <div className="flex items-center justify-between text-[10px] text-[#C9B89F] border-t border-[#C9B89F]/20 pt-1.5">
        <span className="flex items-center gap-0.5">
          <span className="material-symbols-outlined text-[11px]">schedule</span>
          {since(t.openedAt)}
        </span>
        <span className="font-medium text-[#D4AF7C]/90">Activa</span>
      </div>
    </article>
  );
}

/* Hojas inferiores: sin pantalla propia en Stitch; usan la paleta y componentes del plano. */
function Sheet({ title, onCancel, children }: { title: string; onCancel: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end justify-center" onClick={onCancel}>
      <div className="w-full max-w-[414px] bg-[#F5F3EF] rounded-t-2xl p-4 pb-6 border-t border-[#C9B89F]" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-[#C9B89F] mx-auto mb-3" />
        <h3 className="font-display text-lg font-bold text-[#1E2F28] mb-3">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function GuestsSheet({ table, tables, onCancel, onConfirm }: { table: Table; tables: Table[]; onCancel: () => void; onConfirm: (guests: number, join: string[]) => void }) {
  const [join, setJoin] = useState<string[]>([]);
  const joined = join.map((id) => tables.find((t) => t.id === id)!).filter(Boolean);
  const capacity = table.capacity + joined.reduce((n, p) => n + p.capacity, 0);
  const title = [table.label, ...joined.map((p) => p.label)].join(" + ");
  return (
    <Sheet title={`Abrir ${title} · comensales`} onCancel={onCancel}>
      <div className="mb-3 p-2.5 rounded-lg border border-[#D4AF7C]/60 bg-[#D4AF7C]/10">
        <span className="text-[11px] font-semibold text-[#1E2F28] block mb-1.5">¿Grupo grande? Unir con:</span>
        <JoinPicker tables={tables} main={table} value={join} onChange={setJoin} />
        {join.length > 0 && <p className="text-[10px] text-[#1A1A1A]/60 mt-1.5">Una sola comanda y cuenta para {capacity} lugares.</p>}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: capacity + 4 }, (_, i) => i + 1).map((n) => (
          <button key={n} onClick={() => onConfirm(n, join)} className="h-14 rounded-lg bg-white border border-[#C9B89F] text-[#1E2F28] font-display text-xl font-bold active:bg-[#1E2F28] active:text-[#D4AF7C] transition-colors">
            {n}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function BarSheet({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <Sheet title="Nueva cuenta de barra" onCancel={onCancel}>
      <input autoFocus placeholder="Nombre o pulsera" value={name} onChange={(e) => setName(e.target.value)} className="w-full h-12 rounded-lg border-[#C9B89F] bg-white text-sm focus:ring-[#D4AF7C] focus:border-[#D4AF7C]" />
      <button disabled={!name.trim()} onClick={() => onConfirm(name.trim())} className="mt-3 w-full h-12 rounded-lg bg-[#1E2F28] text-[#D4AF7C] font-semibold tracking-wide disabled:opacity-40">
        Abrir cuenta
      </button>
    </Sheet>
  );
}

interface TakeoutForm { customerName: string; customerPhone: string | null; pickupAt: string | null; channel: "mostrador" | "telefono" | "whatsapp"; disposables: boolean; note: string | null }

/* Alta de pedido para llevar: mismos componentes de hoja inferior del comandero. */
function TakeoutSheet({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: (b: TakeoutForm) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [when, setWhen] = useState<"asap" | 15 | 30 | "hora">("asap");
  const [time, setTime] = useState("");
  const [channel, setChannel] = useState<TakeoutForm["channel"]>("mostrador");
  const [note, setNote] = useState("");
  const [disposables, setDisposables] = useState(true);
  const chip = (on: boolean) => `px-3 py-2 rounded-lg text-xs font-medium border ${on ? "bg-[#1E2F28] text-[#D4AF7C] border-[#1E2F28]" : "bg-white text-[#1E2F28] border-[#C9B89F]"}`;
  const pickupAt = () => {
    if (when === "asap") return null;
    if (when === "hora") { if (!time) return null; const [h, m] = time.split(":").map(Number); const d = new Date(); d.setHours(h!, m!, 0, 0); return d.toISOString(); }
    return new Date(Date.now() + when * 60000).toISOString();
  };
  const digits = phone.replace(/\D/g, "");
  const valid = name.trim() && (!digits || digits.length === 10) && (when !== "hora" || time);
  return (
    <Sheet title="Nuevo pedido para llevar" onCancel={onCancel}>
      <div className="space-y-3 max-h-[70vh] overflow-y-auto">
        <input autoFocus placeholder="Nombre del cliente *" value={name} onChange={(e) => setName(e.target.value)} className="w-full h-12 rounded-lg border-[#C9B89F] bg-white text-sm focus:ring-[#D4AF7C] focus:border-[#D4AF7C]" />
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-emerald-700">chat</span>
          <input inputMode="numeric" placeholder="Teléfono (10 dígitos, opcional)" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, "").slice(0, 14))} className="w-full h-12 pl-10 rounded-lg border-[#C9B89F] bg-white text-sm focus:ring-[#D4AF7C] focus:border-[#D4AF7C]" />
        </div>
        <div>
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#1E2F28]/70 mb-1.5">¿Cuándo lo recoge?</span>
          <div className="flex flex-wrap gap-2">
            {([["asap", "Lo antes posible"], [15, "En 15 min"], [30, "En 30 min"], ["hora", "Elegir hora"]] as const).map(([k, l]) => <button key={String(k)} onClick={() => setWhen(k)} className={chip(when === k)}>{l}</button>)}
          </div>
          {when === "hora" && <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-2 h-11 rounded-lg border-[#C9B89F] bg-white text-sm" />}
        </div>
        <div>
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#1E2F28]/70 mb-1.5">Canal</span>
          <div className="flex gap-2">{([["mostrador", "Mostrador"], ["telefono", "Teléfono"], ["whatsapp", "WhatsApp"]] as const).map(([k, l]) => <button key={k} onClick={() => setChannel(k)} className={chip(channel === k)}>{l}</button>)}</div>
        </div>
        <textarea placeholder="Nota del pedido (ej. sin cubiertos)" rows={2} maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-lg border-[#C9B89F] bg-white text-sm resize-none focus:ring-[#D4AF7C] focus:border-[#D4AF7C]" />
        <label className="flex items-center justify-between text-sm text-[#1E2F28]"><span>Incluir desechables</span><input type="checkbox" checked={disposables} onChange={(e) => setDisposables(e.target.checked)} className="w-5 h-5 rounded text-[#1E2F28] border-[#C9B89F]" /></label>
      </div>
      <button disabled={!valid} onClick={() => onConfirm({ customerName: name.trim(), customerPhone: digits || null, pickupAt: pickupAt(), channel, disposables, note: note.trim() || null })} className="mt-3 w-full h-12 rounded-lg bg-[#1E2F28] text-[#D4AF7C] font-semibold tracking-wide disabled:opacity-40">
        Abrir pedido y capturar
      </button>
    </Sheet>
  );
}
