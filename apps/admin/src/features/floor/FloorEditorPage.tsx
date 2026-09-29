/* Diseño: design/stitch/admin-editor-plano.html (Stitch). Marcado y clases originales; datos reales. E3-10. */
import { client } from "@convivium/app-shell";
import { useCallback, useEffect, useRef, useState, type DragEvent, type PointerEvent as RPointerEvent } from "react";

type Shape = "redonda" | "cuadrada" | "rectangular" | "periquera";
interface Area { id: string; name: string; sortOrder: number }
interface Table { id?: string; key: string; areaId: string; label: string; capacity: number; shape: Shape; x: number; y: number; status?: string }

const W = 1140, H = 680, PAD = 40, GRID = 20;
const PRESETS: { shape: Shape; capacity: number; label: string; size: string }[] = [
  { shape: "redonda", capacity: 2, label: "Redonda 2p", size: "Ø 70cm" },
  { shape: "redonda", capacity: 4, label: "Redonda 4p", size: "Ø 100cm" },
  { shape: "cuadrada", capacity: 4, label: "Cuadrada 4p", size: "80x80cm" },
  { shape: "rectangular", capacity: 6, label: "Rectangular", size: "160x90cm" },
  { shape: "periquera", capacity: 2, label: "Periquera Alta (2p)", size: "Coctelería · Ø 60cm" },
];
/** Tamaño en px de cada mesa en el plano. */
const dims = (t: Pick<Table, "shape" | "capacity">): [number, number] =>
  t.shape === "periquera" ? [32, 32] : t.shape === "redonda" ? (t.capacity <= 2 ? [44, 44] : [60, 60]) : t.shape === "rectangular" ? [t.capacity >= 8 ? 128 : 104, 56] : [56, 56];
let seq = 0;
const newKey = () => `n${++seq}`;

export function FloorEditorPage() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [areaId, setAreaId] = useState("");
  const [tables, setTables] = useState<Table[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [history, setHistory] = useState<Table[][]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [snap, setSnap] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const canvas = useRef<HTMLDivElement>(null);
  const drag = useRef<{ key: string; dx: number; dy: number; moved: boolean } | null>(null);

  const load = useCallback(async () => {
    const plan = await client.request<{ areas: Area[]; tables: (Omit<Table, "key"> & { id: string })[] }>("GET", "/floor");
    const as = [...plan.areas].sort((a, b) => a.sortOrder - b.sortOrder);
    setAreas(as);
    setAreaId((cur) => cur || as[0]?.id || "");
    setTables(plan.tables.map((t) => ({ id: t.id, key: t.id, areaId: t.areaId, label: t.label, capacity: t.capacity, shape: t.shape, x: t.x, y: t.y, status: t.status })));
    setRemoved([]); setHistory([]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const changes = history.length + removed.length;
  const commit = (next: Table[]) => { setHistory((h) => [...h.slice(-49), tables]); setTables(next); };
  const undo = () => { const prev = history.at(-1); if (prev) { setTables(prev); setHistory((h) => h.slice(0, -1)); } };
  const patch = (key: string, p: Partial<Table>) => commit(tables.map((t) => (t.key === key ? { ...t, ...p } : t)));
  const q = (v: number) => (snap ? Math.round(v / GRID) * GRID : Math.round(v));
  const clamp = (t: Table, x: number, y: number) => { const [w, h] = dims(t); return { x: Math.max(0, Math.min(W - PAD * 2 - w, q(x))), y: Math.max(0, Math.min(H - PAD * 2 - h, q(y))) }; };
  const nextLabel = () => { let n = tables.length + 1; const used = new Set(tables.map((t) => t.label.toUpperCase())); while (used.has(`M${n}`)) n++; return `M${n}`; };

  /** Primer hueco de la cuadrícula donde la mesa no se encima con otra del área. */
  const freeSpot = (t: Table) => {
    const [w, h] = dims(t);
    const others = tables.filter((o) => o.areaId === areaId).map((o) => { const [ow, oh] = dims(o); return { x: o.x, y: o.y, w: ow, h: oh }; });
    for (let y = 0; y <= H - PAD * 2 - h; y += GRID) for (let x = 0; x <= W - PAD * 2 - w; x += GRID)
      if (others.every((o) => x + w + GRID <= o.x || o.x + o.w + GRID <= x || y + h + GRID <= o.y || o.y + o.h + GRID <= y)) return { x, y };
    return { x: 0, y: 0 };
  };
  const add = (p: (typeof PRESETS)[number], at?: { x: number; y: number }) => {
    const base: Table = { key: newKey(), areaId, label: p.shape === "periquera" ? nextLabel().replace("M", "P") : nextLabel(), capacity: p.capacity, shape: p.shape, x: 0, y: 0 };
    const pos = at ?? freeSpot(base);
    const t = { ...base, ...clamp(base, pos.x, pos.y) };
    commit([...tables, t]); setSel(t.key);
  };
  const toCanvas = (clientX: number, clientY: number) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: (clientX - r.left) / zoom - PAD, y: (clientY - r.top) / zoom - PAD };
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const p = PRESETS[Number(e.dataTransfer.getData("text/preset"))];
    if (!p) return;
    const [w, h] = dims(p); const c = toCanvas(e.clientX, e.clientY);
    add(p, { x: c.x - w / 2, y: c.y - h / 2 });
  };
  const onDown = (e: RPointerEvent, t: Table) => {
    e.stopPropagation(); setSel(t.key);
    const c = toCanvas(e.clientX, e.clientY);
    drag.current = { key: t.key, dx: c.x - t.x, dy: c.y - t.y, moved: false };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: RPointerEvent) => {
    const d = drag.current; if (!d) return;
    const c = toCanvas(e.clientX, e.clientY);
    if (!d.moved) { setHistory((h) => [...h.slice(-49), tables]); d.moved = true; }
    setTables((ts) => ts.map((t) => (t.key === d.key ? { ...t, ...clamp(t, c.x - d.dx, c.y - d.dy) } : t)));
  };
  const onUp = () => { drag.current = null; };

  const remove = (t: Table) => {
    if (t.status && t.status !== "libre") return setMsg({ ok: false, text: `${t.label} tiene una cuenta abierta; no puede retirarse ahora.` });
    commit(tables.filter((x) => x.key !== t.key));
    if (t.id) setRemoved((r) => [...r, t.id!]);
    setSel(null);
  };
  const duplicate = (t: Table) => { const c = { ...t, id: undefined, key: newKey(), label: nextLabel(), status: undefined, ...clamp(t, t.x + 20, t.y + 20) }; commit([...tables, c]); setSel(c.key); };

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      await client.request("PUT", "/floor/layout", { tables: tables.map(({ id, areaId, label, capacity, shape, x, y }) => ({ id, areaId, label, capacity, shape, x, y })), removed });
      await load();
      setMsg({ ok: true, text: "Plano guardado. Los comanderos lo verán al actualizar." });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setSaving(false); }
  };
  const newArea = async () => {
    const name = prompt("Nombre de la nueva área (ej. Terraza, Mezzanine)");
    if (!name?.trim()) return;
    const a = await client.request<Area>("POST", "/floor/areas", { name: name.trim() });
    setAreas((as) => [...as, a]); setAreaId(a.id);
  };

  const selected = tables.find((t) => t.key === sel);
  const area = areas.find((a) => a.id === areaId);
  const inArea = tables.filter((t) => t.areaId === areaId);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-marfil-light">
      <header className="h-16 bg-white/80 backdrop-blur border-b border-arena/30 px-6 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center">
          <div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="font-headline font-semibold text-base text-carbon tracking-tight">Distribución de Sala</span>
              {changes > 0 && <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200/80 px-2 py-0.5 rounded-full ml-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Cambios sin guardar ({changes} {changes === 1 ? "modificación" : "modificaciones"})</span>}
            </div>
          </div>
          <div className="flex items-center bg-marfil-cream p-1 rounded-lg border border-arena/40 ml-4">
            {areas.map((a) => a.id === areaId ? (
              <button key={a.id} className="px-3.5 py-1 text-xs font-semibold rounded-md bg-white text-olivo shadow-xs border border-arena/30 flex items-center gap-1.5"><span className="material-symbols-outlined text-sm text-dorado-dark">deck</span>{a.name}</button>
            ) : (
              <button key={a.id} onClick={() => { setAreaId(a.id); setSel(null); }} className="px-3.5 py-1 text-xs font-medium text-carbon-muted hover:text-carbon rounded-md hover:bg-white/60 transition-colors">{a.name}</button>
            ))}
            <button onClick={newArea} className="px-2.5 py-1 text-xs font-medium text-carbon-muted hover:text-olivo rounded-md hover:bg-white/60 transition-colors flex items-center gap-1 border-l border-arena/30 ml-0.5"><span className="material-symbols-outlined text-xs">add</span>Nueva Área</button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-marfil-cream border border-arena/40 rounded-lg p-0.5">
            <button onClick={undo} disabled={!history.length} className="p-1.5 text-carbon-soft hover:text-olivo hover:bg-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Deshacer"><span className="material-symbols-outlined text-base">undo</span></button>
          </div>
          <div className="flex items-center bg-marfil-cream border border-arena/40 rounded-lg p-0.5 text-xs text-carbon">
            <button onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(1)))} className="p-1.5 text-carbon-soft hover:text-olivo hover:bg-white rounded transition-colors" title="Alejar"><span className="material-symbols-outlined text-base">zoom_out</span></button>
            <span className="px-2 font-mono font-medium text-[11px]">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(1)))} className="p-1.5 text-carbon-soft hover:text-olivo hover:bg-white rounded transition-colors" title="Acercar"><span className="material-symbols-outlined text-base">zoom_in</span></button>
            <div className="w-px h-4 bg-arena/50 mx-0.5" />
            <button onClick={() => setZoom(1)} className="p-1.5 text-carbon-soft hover:text-olivo hover:bg-white rounded transition-colors" title="Tamaño real"><span className="material-symbols-outlined text-base">filter_center_focus</span></button>
          </div>
          <button onClick={() => setSnap(!snap)} className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border ${snap ? "bg-olivo/5 text-olivo border-olivo/20 hover:bg-olivo/10" : "bg-white text-carbon-muted border-arena"}`}><span className="material-symbols-outlined text-sm text-dorado-dark">grid_on</span><span>Ajustar a cuadrícula</span></button>
          <div className="w-px h-6 bg-arena/40 mx-1" />
          <button onClick={save} disabled={saving || changes === 0} className="px-4 py-1.5 bg-olivo hover:bg-olivo-hover text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-all shadow hover:shadow-md border border-dorado/30 disabled:opacity-50"><span className="material-symbols-outlined text-sm text-dorado">check_circle</span><span>{saving ? "Guardando…" : "Guardar Plano"}</span></button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <aside className="w-56 bg-marfil-light border-r border-arena/30 flex flex-col shrink-0 z-20 overflow-y-auto">
          <div className="p-3.5 border-b border-arena/20 bg-white/40">
            <h2 className="font-headline font-semibold text-xs tracking-wider uppercase text-olivo">Mobiliario</h2>
            <p className="text-[10px] text-carbon-muted mt-0.5">Arrastra al plano o haz clic para agregar</p>
          </div>
          <div className="p-3 space-y-4">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-carbon-muted px-1 block mb-2">Mesas de Comensales</span>
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map((p, i) => (
                  <div key={p.label} draggable onDragStart={(e) => e.dataTransfer.setData("text/preset", String(i))} onClick={() => add(p)} className="group bg-white hover:bg-marfil-cream border border-arena/40 hover:border-dorado rounded-lg p-2.5 flex flex-col items-center justify-center text-center cursor-grab active:cursor-grabbing transition-all shadow-2xs hover:shadow-xs">
                    <div className={`border-2 border-olivo/70 group-hover:border-olivo group-hover:bg-dorado/10 flex items-center justify-center relative mb-1.5 transition-colors ${p.shape === "rectangular" ? "w-14 h-8 rounded" : p.shape === "cuadrada" ? "w-9 h-9 rounded" : p.shape === "periquera" ? "w-7 h-7 rounded-full" : p.capacity <= 2 ? "w-9 h-9 rounded-full" : "w-10 h-10 rounded-full"}`}>
                      {p.capacity > 2 ? <span className="text-[10px] font-semibold text-olivo font-mono">{p.capacity}</span> : <div className="w-2.5 h-2.5 rounded-full bg-olivo/30" />}
                      <div className="absolute -top-1 w-3 h-1 bg-arena/80 rounded-full" /><div className="absolute -bottom-1 w-3 h-1 bg-arena/80 rounded-full" />
                    </div>
                    <span className="text-[11px] font-medium text-carbon">{p.label}</span>
                    <span className="text-[9px] text-carbon-muted font-mono">{p.size}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-carbon-muted px-1 leading-relaxed">{inArea.length} mesas en {area?.name ?? "esta área"} · {inArea.reduce((n, t) => n + t.capacity, 0)} lugares</p>
          </div>
        </aside>

        <main className="flex-1 bg-marfil-light bg-grid-dots relative overflow-auto p-8 flex items-start justify-center" onPointerDown={() => setSel(null)}>
          <div style={{ width: W * zoom, height: H * zoom }} className="shrink-0">
            <div ref={canvas} onDragOver={(e) => e.preventDefault()} onDrop={onDrop} onPointerMove={onMove} onPointerUp={onUp}
              style={{ width: W, height: H, transform: `scale(${zoom})`, transformOrigin: "0 0" }} className="relative bg-white/95 rounded-xl border border-arena/60 shadow-xl overflow-hidden select-none">
              <div className="absolute top-0 left-0 right-0 h-4 bg-marfil-cream/80 border-b border-arena/40 flex items-center justify-between px-6 text-[8px] font-mono text-carbon-muted select-none">{["0.00m", "2.50m", "5.00m", "7.50m", "10.00m", "12.50m", "15.00m"].map((m) => <span key={m}>{m}</span>)}</div>
              <div className="absolute top-4 left-0 bottom-0 w-4 bg-marfil-cream/80 border-r border-arena/40 flex flex-col justify-between py-6 text-[8px] font-mono text-carbon-muted select-none text-center">{["0m", "2m", "4m", "6m", "8m"].map((m) => <span key={m}>{m}</span>)}</div>
              <div className="absolute inset-4 top-6 border-2 border-carbon-soft/30 rounded pointer-events-none" />
              {inArea.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-xs text-carbon-muted pointer-events-none">Arrastra mesas desde el panel izquierdo para armar {area?.name ?? "el área"}.</div>}
              {inArea.map((t) => {
                const [w, h] = dims(t);
                const isSel = t.key === sel;
                const round = t.shape === "redonda" || t.shape === "periquera";
                const busy = t.status && t.status !== "libre";
                return (
                  <div key={t.key} onPointerDown={(e) => onDown(e, t)} className={`absolute group cursor-grab active:cursor-grabbing ${isSel ? "z-20" : ""}`} style={{ left: t.x + PAD, top: t.y + PAD }}>
                    {isSel && <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-olivo text-amber-100 text-[10px] font-medium px-2.5 py-1 rounded-full shadow-lg border border-dorado flex items-center gap-1.5 whitespace-nowrap pointer-events-none"><span className="w-1.5 h-1.5 rounded-full bg-dorado" /><span>{t.label} · {t.capacity} personas</span></div>}
                    <div className={isSel ? "relative p-1 -m-1 border-2 border-dorado rounded-lg bg-dorado/5 shadow-md" : ""}>
                      <div style={{ width: w, height: h }} className={`relative bg-white border-2 flex flex-col items-center justify-center shadow-xs transition-colors ${round ? "rounded-full" : "rounded-md"} ${isSel ? "border-olivo" : "border-olivo/80 group-hover:border-dorado"}`}>
                        <div className="flex items-center gap-1">
                          <span className={`font-bold font-mono ${isSel ? "text-olivo text-sm" : "text-carbon"} ${w < 40 ? "text-[9px]" : "text-xs"}`}>{t.label}</span>
                          {busy && <span className="w-1.5 h-1.5 rounded-full bg-terracota" title="Con cuenta abierta" />}
                        </div>
                        {w >= 40 && <span className="text-[9px] font-mono text-carbon-muted">{t.capacity}p</span>}
                        <span className={`absolute -top-1.5 w-6 h-1 rounded-full ${isSel ? "bg-dorado" : "bg-arena/80"}`} />
                        <span className={`absolute -bottom-1.5 w-6 h-1 rounded-full ${isSel ? "bg-dorado" : "bg-arena/80"}`} />
                        {t.capacity > 2 && <><span className={`absolute -left-1.5 h-6 w-1 rounded-full ${isSel ? "bg-dorado" : "bg-arena/80"}`} /><span className={`absolute -right-1.5 h-6 w-1 rounded-full ${isSel ? "bg-dorado" : "bg-arena/80"}`} /></>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {msg && <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-xs font-medium shadow-lg z-50 ${msg.ok ? "bg-olivo text-amber-100" : "bg-terracota text-white"}`} onClick={() => setMsg(null)}>{msg.text}</div>}
        </main>

        <aside className="w-80 bg-white border-l border-arena/40 flex flex-col shrink-0 z-20 shadow-lg overflow-y-auto">
          {selected ? (
            <>
              <div className="p-4 border-b border-arena/30 flex items-center justify-between bg-marfil-cream/50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${selected.status && selected.status !== "libre" ? "bg-terracota" : "bg-emerald-600"}`} />
                    <h3 className="font-headline font-semibold text-sm tracking-wide text-carbon">Propiedades de Mesa</h3>
                  </div>
                  <span className="inline-block text-[11px] font-mono text-dorado-dark font-medium mt-0.5">{selected.label} Seleccionada · {areas.find((a) => a.id === selected.areaId)?.name}</span>
                </div>
                <button onClick={() => remove(selected)} className="p-1.5 text-carbon-muted hover:text-terracota hover:bg-terracota/10 rounded transition-colors" title="Retirar mesa del plano"><span className="material-symbols-outlined text-lg">delete</span></button>
              </div>
              <div className="p-4 space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-carbon-muted uppercase tracking-wider mb-1.5">Identificador / Clave</label>
                  <input value={selected.label} onChange={(e) => patch(selected.key, { label: e.target.value.toUpperCase().slice(0, 12) })} className="block w-full px-3 py-1.5 rounded-md border border-arena text-xs font-mono font-semibold focus:ring-1 focus:ring-olivo focus:border-olivo bg-white" type="text" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-carbon-muted uppercase tracking-wider mb-1.5">Capacidad de Comensales</label>
                  <div className="flex items-center justify-between border border-arena rounded-md p-1 bg-white">
                    <button onClick={() => patch(selected.key, { capacity: Math.max(1, selected.capacity - 1) })} className="w-8 h-8 rounded bg-marfil-cream text-carbon hover:bg-arena/30 flex items-center justify-center font-bold text-sm transition-colors">-</button>
                    <div className="text-center"><span className="text-sm font-bold text-olivo font-mono">{selected.capacity}</span><span className="text-[10px] text-carbon-muted block -mt-0.5">personas</span></div>
                    <button onClick={() => patch(selected.key, { capacity: Math.min(30, selected.capacity + 1) })} className="w-8 h-8 rounded bg-marfil-cream text-carbon hover:bg-arena/30 flex items-center justify-center font-bold text-sm transition-colors">+</button>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-carbon-muted uppercase tracking-wider mb-1.5">Forma Geométrica</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {([["cuadrada", "Cuadrada", "w-4 h-4 rounded-xs"], ["redonda", "Redonda", "w-4 h-4 rounded-full"], ["rectangular", "Rectangular", "w-6 h-3 rounded-xs"], ["periquera", "Periquera", "w-3 h-3 rounded-full"]] as const).map(([s, l, icon]) => selected.shape === s ? (
                      <button key={s} className="py-2 px-1 text-center rounded border-2 border-olivo bg-olivo/5 text-olivo font-medium flex flex-col items-center gap-1 shadow-2xs"><span className={`${icon} border border-olivo`} /><span className="text-[10px]">{l}</span></button>
                    ) : (
                      <button key={s} onClick={() => patch(selected.key, { shape: s })} className="py-2 px-1 text-center rounded border border-arena hover:border-dorado bg-white text-carbon-muted hover:text-carbon flex flex-col items-center gap-1 transition-colors"><span className={`${icon} border border-carbon-muted`} /><span className="text-[10px]">{l}</span></button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-carbon-muted uppercase tracking-wider mb-1.5">Área Asignada</label>
                  <select value={selected.areaId} onChange={(e) => patch(selected.key, { areaId: e.target.value })} className="w-full border border-arena rounded-md py-1.5 px-3 text-xs bg-white focus:ring-1 focus:ring-olivo focus:border-olivo">
                    {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-carbon-muted uppercase tracking-wider mb-1.5">Posición</label>
                  <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                    <div className="bg-marfil-cream border border-arena/60 rounded px-2 py-1"><span className="text-[9px] text-carbon-muted block">POS X</span><span className="font-semibold text-carbon">{selected.x} px</span></div>
                    <div className="bg-marfil-cream border border-arena/60 rounded px-2 py-1"><span className="text-[9px] text-carbon-muted block">POS Y</span><span className="font-semibold text-carbon">{selected.y} px</span></div>
                  </div>
                </div>
                {selected.status && selected.status !== "libre" && <p className="text-[11px] text-terracota">Esta mesa tiene una cuenta abierta: puedes moverla o editarla, pero no retirarla.</p>}
              </div>
              <div className="mt-auto p-4 border-t border-arena/30 bg-marfil-cream/30 space-y-2">
                <button onClick={() => duplicate(selected)} className="w-full py-2 bg-white hover:bg-marfil-cream border border-arena rounded-md text-xs font-semibold text-carbon flex items-center justify-center gap-1.5 transition-colors shadow-2xs"><span className="material-symbols-outlined text-sm text-carbon-muted">content_copy</span>Duplicar Mesa ({nextLabel()})</button>
              </div>
            </>
          ) : (
            <div className="p-6 text-xs text-carbon-muted space-y-2">
              <h3 className="font-headline font-semibold text-sm text-carbon">Propiedades de Mesa</h3>
              <p>Selecciona una mesa del plano para editar su clave, capacidad, forma y área.</p>
              <p>Los cambios se aplican al presionar <b>Guardar Plano</b>.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
