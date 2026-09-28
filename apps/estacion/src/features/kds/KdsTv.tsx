/* Diseño: design/stitch/estacion-kds-tv.html (Stitch). Marcado y clases originales; datos reales. E4-01, E4-02, E4-04, E4-06. */
import { clock, hhmm, useStationQueue, type Ticket } from "./useStationQueue";

const HEAD = {
  rojo: { border: "border-terracota shadow-[0_12px_36px_rgba(178,76,61,0.35)]", bar: "bg-terracota", strip: "bg-[#291714] border-terracota/40", timer: "bg-terracota/30 border-terracota", timerLabel: "text-red-300", timerText: "text-white", label: "TIEMPO EXCEDIDO", icon: "warning" },
  amarillo: { border: "border-ambar shadow-[0_8px_30px_rgba(217,130,43,0.25)]", bar: "bg-ambar", strip: "bg-[#2B2317] border-ambar/40", timer: "bg-ambar/25 border-ambar", timerLabel: "text-amber-200", timerText: "text-amber-300", label: "TIEMPO ELEVADO · ATENCIÓN", icon: "timer" },
  verde: { border: "border-verdeKds shadow-[0_8px_24px_rgba(46,125,79,0.25)]", bar: "bg-verdeKds", strip: "bg-[#1A2C22] border-verdeKds/40", timer: "bg-verdeKds/25 border-verdeKds", timerLabel: "text-emerald-200", timerText: "text-emerald-300", label: "A TIEMPO · NORMAL", icon: "check_circle" },
} as const;

export function KdsTv({ station }: { station: { id: string; name: string; kind: string } }) {
  const { tickets, consolidated, now } = useStationQueue(station.id);
  const products = tickets.reduce((s, t) => s + t.pending.reduce((a, i) => a + i.quantity, 0), 0);
  const d = new Date(now);

  return (
    <div className="h-full bg-[#121212] text-marfil flex flex-col font-sans select-none overflow-hidden antialiased">
      <header className="bg-[#18231E] border-b-2 border-[#D4AF7C]/30 px-8 py-3.5 flex items-center justify-between shrink-0 shadow-2xl z-20">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3.5 pr-6 border-r border-[#D4AF7C]/25">
            <div className="w-12 h-12 rounded-xl bg-[#253931] border border-[#D4AF7C]/50 flex items-center justify-center shadow-inner">
              <span className="font-display font-bold text-2xl text-dorado tracking-wider">C</span>
            </div>
            <div>
              <span className="font-display text-xl tracking-[0.25em] font-bold text-marfil block leading-none">CONVIVIUM</span>
              <span className="text-[11px] tracking-widest text-dorado/90 uppercase font-semibold mt-1 block">KDS Display</span>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-[#24352D] px-5 py-2 rounded-xl border border-[#D4AF7C]/20 shadow-sm">
            <span className="material-symbols-outlined text-amber-400 text-2xl">{station.kind === "barra" ? "local_bar" : "local_fire_department"}</span>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-wider text-dorado/80 leading-none">{station.kind === "barra" ? "Estación de Barra" : "Estación de Cocina"}</span>
              <h1 className="text-2xl font-black tracking-wide text-marfil uppercase font-display leading-tight">Estación {station.name}</h1>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="bg-[#121A16] px-6 py-2 rounded-xl border border-white/10 flex items-center gap-6 shadow-inner">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-dorado font-mono">{tickets.length}</span>
              <span className="text-sm font-semibold tracking-wider uppercase text-marfil-muted">comandas</span>
            </div>
            <div className="h-6 w-px bg-white/20" />
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-marfil font-mono">{products}</span>
              <span className="text-sm font-semibold tracking-wider uppercase text-marfil-muted">productos</span>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-[#253830]/80 px-4 py-2 rounded-xl border border-[#D4AF7C]/25">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-bold tracking-wider text-marfil">Red local</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-4xl font-extrabold font-mono tracking-tight text-marfil drop-shadow-sm flex items-baseline justify-end gap-1">
              <span>{hhmm(now)}</span>
              <span className="text-lg font-bold text-dorado">:{String(d.getSeconds()).padStart(2, "0")}</span>
            </div>
          </div>
          <button onClick={() => document.documentElement.requestFullscreen?.()} className="w-12 h-12 rounded-xl bg-[#24352D] border border-white/10 flex items-center justify-center text-marfil-muted hover:text-white cursor-pointer">
            <span className="material-symbols-outlined text-2xl">fullscreen</span>
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 overflow-hidden grid grid-cols-4 gap-6 bg-gradient-to-b from-[#141414] to-[#0E0E0E] content-start">
        {tickets.map((t) => <TvCard key={t.checkId} t={t} />)}
        {tickets.length === 0 && <p className="col-span-4 text-center text-2xl text-marfil-muted font-display mt-24">Sin comandas pendientes</p>}
      </main>

      <footer className="bg-[#18231E] border-t-2 border-[#D4AF7C]/30 px-8 py-3.5 flex items-center justify-between shrink-0 shadow-[0_-8px_24px_rgba(0,0,0,0.5)] z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5 bg-[#D4AF7C]/20 border border-[#D4AF7C]/50 px-3.5 py-1.5 rounded-lg text-dorado">
            <span className="material-symbols-outlined text-2xl animate-pulse">skillet</span>
            <span className="text-sm font-extrabold uppercase tracking-widest">Consolidado en preparación:</span>
          </div>
          <div className="flex items-center gap-3 font-sans">
            {consolidated.map(([name, qty]) => (
              <div key={name} className="bg-[#24352D] border border-white/15 px-4 py-2 rounded-xl flex items-center gap-2.5 shadow-sm">
                <span className="text-2xl font-black font-mono text-dorado">{qty}</span>
                <span className="text-lg font-bold text-marfil">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

function TvCard({ t }: { t: Ticket }) {
  const h = HEAD[t.semaforo];
  const active = t.items.filter((i) => i.state !== "cancelado").length;
  const cancelled = t.items.length - active;
  const guests = [...new Set(t.items.map((i) => i.guest).filter(Boolean))].map((g) => `C${g}`).join(", ");

  return (
    <div className={`flex flex-col bg-olivo rounded-2xl border-4 overflow-hidden relative ${t.rehacer ? "border-terracota shadow-[0_12px_36px_rgba(178,76,61,0.35)] animate-alert-border" : h.border}`}>
      {t.rehacer ? (
        <div className="bg-terracota text-white px-5 py-2.5 flex items-center justify-between font-black tracking-widest text-base uppercase shadow-md">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-2xl animate-spin" style={{ animationDuration: "4s" }}>priority_high</span>
            <span>REHACER · DEVOLUCIÓN</span>
          </div>
          <span className="bg-black/30 text-white text-xs px-2.5 py-1 rounded font-mono font-bold tracking-wider">PRIORIDAD MÁX</span>
        </div>
      ) : (
        <div className={`${h.bar} text-white px-5 py-1.5 flex items-center justify-between font-bold text-sm tracking-wider uppercase`}>
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">{h.icon}</span>
            <span>{h.label}</span>
          </span>
          <span className="font-mono text-xs bg-black/25 px-2 py-0.5 rounded">OBJ: {Math.round(t.targetSec / 60)} MIN</span>
        </div>
      )}

      <div className={`${t.rehacer ? HEAD.rojo.strip : h.strip} p-4 border-b-2 flex items-center justify-between`}>
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-display font-extrabold text-white">{t.tableLabel}</span>
            <span className="text-base font-bold text-dorado font-mono">#{t.folio}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-marfil-muted font-semibold mt-0.5">
            <span className="material-symbols-outlined text-sm">person</span>
            <span>Mesero: {t.waiterName}</span>
            <span>·</span>
            <span className="font-mono">{hhmm(t.sentAt)}</span>
          </div>
        </div>
        <div className={`${t.rehacer ? HEAD.rojo.timer : h.timer} border-2 px-4 py-1.5 rounded-xl text-right`}>
          <span className={`text-[10px] uppercase font-bold tracking-widest ${t.rehacer ? HEAD.rojo.timerLabel : h.timerLabel} block leading-none`}>Tiempo</span>
          <span className={`text-3xl font-extrabold font-mono ${t.rehacer ? HEAD.rojo.timerText : h.timerText} tracking-tight`}>{clock(t.elapsedSec)}</span>
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col gap-4 overflow-y-auto">
        {t.items.map((i) =>
          i.state === "cancelado" ? (
            <div key={i.id} className="bg-[#171A18]/80 p-4 rounded-xl border border-red-500/30 opacity-75 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-neutral-800 text-neutral-500 font-mono font-bold text-xl flex items-center justify-center line-through shrink-0">{i.quantity}x</span>
                  <span className="text-2xl font-bold text-neutral-400 line-through tracking-wide">{i.productName}</span>
                </div>
                <span className="bg-red-900/80 text-rose-200 text-xs font-black px-2.5 py-1 rounded uppercase tracking-wider border border-red-500/50">CANCELADO</span>
              </div>
            </div>
          ) : (
            <div key={i.id} className={`bg-[#1A2520] p-4 rounded-xl border shadow-sm relative ${i.priority === "rehacer" ? "border-terracota/60" : "border-white/10"} ${i.state === "listo" ? "opacity-40" : ""}`}>
              <div className="flex items-center gap-3">
                <span className={`w-8 h-8 rounded-lg font-mono font-bold text-xl flex items-center justify-center shrink-0 ${i.priority === "rehacer" ? "bg-terracota text-white" : "bg-[#2B4037] text-dorado"}`}>{i.quantity}x</span>
                <span className="text-2xl font-bold text-white tracking-wide">{i.productName}</span>
              </div>
              {(i.modifiers.length > 0 || i.note) && (
                <div className="mt-3 pl-11 flex flex-wrap gap-2">
                  {[...i.modifiers, ...(i.note ? [i.note] : [])].map((m) => (
                    <span key={m} className="bg-[#3D2C1A] text-dorado-light px-3 py-1 rounded-lg text-sm font-extrabold tracking-wide border border-dorado/40 uppercase">★ {m}</span>
                  ))}
                </div>
              )}
            </div>
          ),
        )}
      </div>

      <div className="p-3 bg-[#15211B] border-t border-white/10 flex justify-between items-center text-xs text-marfil-muted font-mono">
        <span>{guests ? `Comensales ${guests}` : ""}</span>
        <span className="text-dorado font-semibold uppercase">{active} {active === 1 ? "Artículo" : "Artículos"}{cancelled ? ` · ${cancelled} Canc` : ""}</span>
      </div>
    </div>
  );
}
