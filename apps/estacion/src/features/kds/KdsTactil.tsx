/* Diseño: design/stitch/estacion-cocina-tactil.html (Stitch). Marcado y clases originales; datos reales. E4-03, E4-05. */
import type { OrderItem } from "@convivium/api-client";
import { useSession } from "@convivium/app-shell";
import { useEffect, useState } from "react";
import { clock, hhmm, useStationQueue, type Ticket } from "./useStationQueue";

export function KdsTactil({ station, onChangeStation }: { station: { id: string; name: string; kind: string }; onChangeStation: () => void }) {
  const { client, session } = useSession();
  const { tickets, now, reload } = useStationQueue(station.id);
  const [tab, setTab] = useState<"curso" | "despachadas">("curso");
  const [history, setHistory] = useState<OrderItem[]>([]);
  const [undo, setUndo] = useState<{ ids: string[]; until: number } | null>(null);

  useEffect(() => { if (tab === "despachadas") client.stations.history(station.id).then(setHistory); }, [tab, client, station.id, tickets]);
  useEffect(() => { if (undo && now > undo.until) setUndo(null); }, [now, undo]);

  const ready = async (ids: string[]) => {
    for (const id of ids) await client.orders.transition(id, "listo");
    setUndo({ ids, until: Date.now() + 10_000 });
    reload();
  };
  const doUndo = async () => {
    if (!undo) return;
    for (const id of undo.ids) await client.orders.transition(id, "enviado").catch(() => undefined);
    setUndo(null);
    reload();
  };
  const rehechos = tickets.filter((t) => t.rehacer).length;
  const d = new Date(now);
  const isBar = station.kind === "barra";

  return (
    <div className="h-full bg-[#141715] text-[#EAE6DD] font-body flex flex-col overflow-hidden select-none antialiased">
      <header className="h-20 bg-[#1A1A1A] border-b-2 border-[#C9B89F]/20 px-6 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-5">
          <button onClick={onChangeStation} className="w-12 h-12 rounded-xl bg-[#1E2F28] border-2 border-[#D4AF7C]/40 flex items-center justify-center text-[#D4AF7C] shadow-lg">
            <span className="material-symbols-outlined fill-1 text-2xl text-[#D4AF7C]">{isBar ? "local_bar" : "skillet"}</span>
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-headline text-xl lg:text-2xl font-bold tracking-wider text-[#EAE6DD] uppercase">{isBar ? "BARRA" : "COCINA"}</span>
              <span className="text-[#D4AF7C] text-lg font-bold">·</span>
              <span className="font-headline text-xl lg:text-2xl font-bold tracking-wide text-[#D4AF7C]">Estación {station.name}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-[#EAE6DD]/70 mt-0.5 font-medium">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Servidor local activo</span>
              </span>
              <span>•</span>
              <span className="text-[#C9B89F]">{session.user.name}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center bg-[#141715] p-1.5 rounded-xl border border-[#C9B89F]/20">
          {(["curso", "despachadas"] as const).map((k) =>
            k === tab ? (
              <button key={k} className="flex items-center gap-3 px-6 py-3 rounded-lg bg-[#1E2F28] border border-[#D4AF7C]/40 text-[#D4AF7C] font-bold text-sm tracking-wide shadow-md transition-all">
                <span className="material-symbols-outlined fill-1 text-xl">{k === "curso" ? "pending_actions" : "task_alt"}</span>
                <span className="text-base">{k === "curso" ? "En curso" : "Despachadas del turno"}</span>
                <span className="w-7 h-7 rounded-full bg-[#D4AF7C] text-[#1A1A1A] font-black text-xs flex items-center justify-center font-mono">{k === "curso" ? tickets.length : history.length}</span>
              </button>
            ) : (
              <button key={k} onClick={() => setTab(k)} className="flex items-center gap-2.5 px-6 py-3 rounded-lg text-[#EAE6DD]/70 hover:text-[#EAE6DD] hover:bg-white/5 font-semibold text-sm tracking-wide transition-all">
                <span className="material-symbols-outlined text-xl">{k === "curso" ? "pending_actions" : "task_alt"}</span>
                <span className="text-base">{k === "curso" ? "En curso" : "Despachadas del turno"}</span>
              </button>
            ),
          )}
        </div>
        <div className="flex items-center gap-3">
          {undo && (
            <button onClick={doUndo} className="flex items-center gap-2.5 px-5 py-3 rounded-xl bg-[#283E34] hover:bg-[#344E42] border-2 border-[#D4AF7C]/50 text-[#EAE6DD] font-bold text-sm tracking-wide shadow-lg active:scale-95">
              <span className="material-symbols-outlined text-xl text-[#D4AF7C]">undo</span>
              <span>Deshacer</span>
              <span className="bg-[#1A1A1A] text-[#D4AF7C] text-xs font-mono font-black px-2 py-0.5 rounded-md border border-[#D4AF7C]/30">{Math.max(0, Math.ceil((undo.until - now) / 1000))}s</span>
            </button>
          )}
          <div className="pl-2 border-l border-[#C9B89F]/20 text-right font-mono">
            <div className="text-2xl font-black text-[#EAE6DD] tracking-wider leading-none">
              {hhmm(now)}
              <span className="text-sm font-medium text-[#D4AF7C]">:{String(d.getSeconds()).padStart(2, "0")}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden bg-[#141715]">
        <section className="flex-1 overflow-y-auto p-4 lg:p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between bg-[#1A1A1A] px-4 py-2.5 rounded-xl border border-[#C9B89F]/20 text-xs shrink-0">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 font-bold text-[#EAE6DD]">
                <span className="material-symbols-outlined text-lg text-[#D4AF7C]">timer</span>
                <span>Comandas en fuego: <strong className="text-[#D4AF7C] font-mono">{tickets.length}</strong></span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              {rehechos > 0 && (
                <span className="px-2.5 py-1 rounded bg-[#B45A3C]/20 border border-[#B45A3C]/40 text-[#B45A3C] font-bold text-[11px] uppercase tracking-wider flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#B45A3C] animate-ping" />
                  {rehechos} Rehecho{rehechos > 1 ? "s" : ""} Crítico{rehechos > 1 ? "s" : ""}
                </span>
              )}
              <span className="px-2.5 py-1 rounded bg-[#1E2F28] border border-[#D4AF7C]/30 text-[#D4AF7C] font-semibold text-[11px]">{tickets.length - rehechos} Comandas Regulares</span>
            </div>
          </div>

          {tab === "curso" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-start">
              {tickets.map((t) => (t.rehacer ? <RehacerCard key={t.checkId} t={t} onReady={ready} /> : <RegularCard key={t.checkId} t={t} onReady={ready} />))}
              {tickets.length === 0 && <p className="text-[#C9B89F] text-lg font-headline">Sin comandas pendientes.</p>}
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((i) => (
                <div key={i.id} className="p-3 rounded-xl bg-[#172520] border border-[#C9B89F]/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-md bg-[#C9B89F]/20 text-[#D4AF7C] flex items-center justify-center font-bold text-xs font-mono">{i.quantity}x</div>
                    <div className="text-sm font-bold text-[#EAE6DD]">{i.productName}</div>
                  </div>
                  <span className="text-[11px] text-[#C9B89F] font-mono">{i.readyAt ? hhmm(Date.parse(i.readyAt)) : ""} · {i.state}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

type CardProps = { t: Ticket; onReady: (ids: string[]) => void };

function CardHeader({ t, alert }: { t: Ticket; alert: boolean }) {
  return (
    <div className={`p-4 ${alert ? "bg-[#231A18] border-b border-[#B45A3C]/30" : "bg-[#172520] border-b border-[#C9B89F]/20"} flex items-center justify-between`}>
      <div>
        <div className="flex items-baseline gap-2">
          <span className={`font-headline text-3xl font-black ${alert ? "text-white" : "text-[#EAE6DD]"}`}>{t.tableLabel}</span>
          <span className={`text-xs font-mono ${alert ? "text-[#C9B89F]" : "text-[#D4AF7C]"}`}>#{t.folio}</span>
        </div>
        <div className="text-xs text-[#C9B89F] mt-0.5 flex items-center gap-2">
          <span className="flex items-center gap-1 font-medium">
            <span className="material-symbols-outlined text-sm">badge</span>
            Mesero: {t.waiterName}
          </span>
        </div>
      </div>
      <div className={`text-right px-3.5 py-1.5 rounded-xl ${alert ? "bg-[#B45A3C]/30 border border-[#B45A3C]" : t.semaforo === "verde" ? "bg-[#141715] border border-[#C9B89F]/30" : "bg-[#141715] border border-[#D4AF7C]/40"}`}>
        <div className={`text-[10px] uppercase font-bold ${alert ? "text-[#EAE6DD]/80" : "text-[#C9B89F]"}`}>{alert ? "Demora Total" : "Tiempo en Fuego"}</div>
        <div className={`font-mono text-2xl font-black leading-none mt-0.5 ${alert || t.semaforo === "rojo" ? "text-white" : t.semaforo === "amarillo" ? "text-[#D4AF7C]" : "text-[#EAE6DD]"}`}>{clock(t.elapsedSec)}</div>
      </div>
    </div>
  );
}

function RehacerCard({ t, onReady }: CardProps) {
  return (
    <article className="bg-[#1A1A1A] rounded-2xl border-[3px] border-[#B45A3C] shadow-2xl flex flex-col overflow-hidden relative group">
      <div className="bg-[#B45A3C] px-4 py-2.5 flex items-center justify-between text-[#EAE6DD]">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined fill-1 text-2xl text-white animate-pulse">priority_high</span>
          <span className="font-black text-sm lg:text-base tracking-wider uppercase">¡REHACER URGENTE!</span>
        </div>
        <span className="bg-black/30 text-white font-mono text-xs px-2.5 py-1 rounded-md font-bold uppercase tracking-wider border border-white/20">Incidencia de Salón</span>
      </div>
      <CardHeader t={t} alert />
      <div className="p-4 bg-[#1A1A1A] flex-1 space-y-4">
        {t.pending.map((i) => (
          <div key={i.id} className="p-3.5 rounded-xl bg-[#281A16] border-2 border-[#B45A3C]/60 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#B45A3C] text-white flex items-center justify-center font-black text-base shrink-0 font-mono">{i.quantity}x</div>
              <div>
                <h3 className="font-headline text-xl font-bold text-white leading-tight">{i.productName}</h3>
                {i.modifiers.map((m) => (
                  <div key={m} className="inline-flex items-center gap-1.5 bg-[#B45A3C] text-white text-xs font-black px-2.5 py-1 rounded-md uppercase tracking-wider mt-1 mr-1 shadow-sm">★ {m}</div>
                ))}
              </div>
            </div>
            {i.note && (
              <div className="p-2.5 rounded-lg bg-black/40 border border-[#B45A3C]/40 text-xs text-[#EAE6DD]/90">
                <div className="flex items-center gap-1 text-[#D4AF7C] font-bold text-[11px] uppercase tracking-wide mb-1">
                  <span className="material-symbols-outlined text-sm text-[#B45A3C]">assignment_late</span>
                  <span>Nota:</span>
                </div>
                <p className="italic text-white">“{i.note}”</p>
              </div>
            )}
            <button onClick={() => onReady([i.id])} className="w-full touch-target-xl py-3.5 px-4 rounded-xl bg-[#B45A3C] hover:bg-[#c96444] text-white font-extrabold text-sm tracking-wider uppercase flex items-center justify-center gap-2.5 shadow-lg active:scale-95">
              <span className="material-symbols-outlined fill-1 text-2xl">done_all</span>
              <span>Listo {i.productName}{i.priority === "rehacer" ? " (Rehecho)" : ""}</span>
            </button>
          </div>
        ))}
      </div>
      <div className="p-4 bg-[#231A18] border-t border-[#B45A3C]/30">
        <button onClick={() => onReady(t.pending.map((i) => i.id))} className="w-full touch-target-xl py-4 rounded-xl bg-gradient-to-r from-[#B45A3C] to-[#8D3E24] hover:from-[#c56342] hover:to-[#9f4528] text-white font-black text-base tracking-widest uppercase flex items-center justify-center gap-2.5 shadow-lg active:scale-95">
          <span className="material-symbols-outlined fill-1 text-2xl">check_circle</span>
          <span>Toda la comanda lista</span>
        </button>
      </div>
    </article>
  );
}

function RegularCard({ t, onReady }: CardProps) {
  const [first, ...rest] = t.pending;
  const hot = t.semaforo !== "verde";
  return (
    <article className={hot ? "bg-[#1E2F28] rounded-2xl border-[3px] border-[#D4AF7C] shadow-2xl flex flex-col overflow-hidden relative ring-4 ring-[#D4AF7C]/20" : "bg-[#1E2F28] rounded-2xl border-2 border-[#C9B89F]/30 shadow-xl flex flex-col overflow-hidden relative"}>
      <CardHeader t={t} alert={false} />
      <div className="p-4 space-y-3.5 flex-1">
        {first && (
          <div className="p-3.5 rounded-xl bg-[#283E34] border-2 border-[#D4AF7C] shadow-md flex flex-col gap-3 relative">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#D4AF7C] text-[#1E2F28] flex items-center justify-center font-black text-lg shrink-0 font-mono">{first.quantity}x</div>
              <div>
                <h3 className="font-headline text-xl font-bold text-[#EAE6DD] leading-tight">{first.productName}</h3>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {first.modifiers.map((m) => (
                    <span key={m} className="bg-[#1E2F28] border border-[#D4AF7C]/50 text-[#D4AF7C] text-xs font-bold px-2 py-0.5 rounded">★ {m}</span>
                  ))}
                  {first.note && <span className="bg-[#B45A3C]/20 border border-[#B45A3C] text-[#fca5a5] text-xs font-bold px-2 py-0.5 rounded">✕ {first.note.toUpperCase()}</span>}
                </div>
              </div>
            </div>
            {first.guest && (
              <div className="text-[11px] text-[#C9B89F] bg-[#141715]/40 p-2 rounded-lg flex items-center justify-between">
                <span>Comensal: C{first.guest}</span>
              </div>
            )}
            <button onClick={() => onReady([first.id])} className="w-full touch-target-xl py-3.5 px-4 rounded-xl bg-[#D4AF7C] hover:bg-[#e4be8c] text-[#1E2F28] font-black text-sm tracking-wider uppercase flex items-center justify-center gap-2.5 shadow-lg active:scale-95">
              <span className="material-symbols-outlined fill-1 text-2xl text-[#1E2F28]">done_all</span>
              <span>Listo {first.quantity}x {first.productName}</span>
            </button>
          </div>
        )}
        {rest.map((i) => (
          <div key={i.id} className="p-3 rounded-xl bg-[#172520] border border-[#C9B89F]/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-md bg-[#C9B89F]/20 text-[#D4AF7C] flex items-center justify-center font-bold text-xs font-mono">{i.quantity}x</div>
              <div>
                <div className="text-sm font-bold text-[#EAE6DD]">{i.productName}</div>
                {(i.modifiers.length > 0 || i.note) && <div className="text-[11px] text-[#C9B89F]">{[...i.modifiers, i.note].filter(Boolean).join(" · ")}</div>}
              </div>
            </div>
            <button onClick={() => onReady([i.id])} className="px-3 py-2 rounded-lg bg-[#283E34] hover:bg-[#324f42] text-[#D4AF7C] text-xs font-bold uppercase tracking-wider flex items-center gap-1 active:scale-95">
              <span className="material-symbols-outlined text-base">check</span>
              <span>Listo</span>
            </button>
          </div>
        ))}
      </div>
      {t.pending.length > 1 && (
        <div className="p-4 bg-[#172520] border-t border-[#C9B89F]/20">
          <button onClick={() => onReady(t.pending.map((i) => i.id))} className="w-full touch-target-xl py-4 rounded-xl bg-gradient-to-r from-[#D4AF7C] to-[#C9B89F] hover:from-[#e0bc87] hover:to-[#d8c8b0] text-[#1E2F28] font-black text-base tracking-widest uppercase flex items-center justify-center gap-2.5 shadow-lg active:scale-95">
            <span className="material-symbols-outlined fill-1 text-2xl text-[#1E2F28]">check_circle</span>
            <span>Toda la comanda lista</span>
          </button>
        </div>
      )}
    </article>
  );
}
