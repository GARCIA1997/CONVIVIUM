/* Diseño: design/stitch/admin-editor-plano.html (Stitch). Marcado y clases originales; datos reales. E3-10. */
import { client } from "@convivium/app-shell";
import { useCallback, useEffect, useRef, useState, type DragEvent, type PointerEvent as RPointerEvent } from "react";

type Shape = "redonda" | "cuadrada" | "rectangular" | "periquera";
type FixtureKind = "muro" | "barra" | "puerta" | "estacion_servicio" | "ventanal" | "cocina";
interface Area { id: string; name: string; sortOrder: number }
interface Table {
  id?: string; key: string; areaId: string; label: string; capacity: number; shape: Shape; x: number; y: number;
  rotation: number; merge: string[]; assignedUserId: string | null; status?: string;
}
interface Fixture { key: string; areaId: string; kind: FixtureKind; label: string; x: number; y: number; w: number; h: number; rotation: number }
interface Staff { id: string; name: string; active: boolean; roles: string[] }
interface Snapshot { tables: Table[]; fixtures: Fixture[] }

const W = 1140, H = 680, PAD = 40, GRID = 20;
const PRESETS: { shape: Shape; capacity: number; label: string; size: string }[] = [
  { shape: "redonda", capacity: 2, label: "Redonda 2p", size: "Ø 70cm" },
  { shape: "redonda", capacity: 4, label: "Redonda 4p", size: "Ø 100cm" },
  { shape: "cuadrada", capacity: 4, label: "Cuadrada 4p", size: "80x80cm" },
  { shape: "rectangular", capacity: 6, label: "Rectangular", size: "160x90cm" },
  { shape: "periquera", capacity: 2, label: "Periquera Alta (2p)", size: "Coctelería · Ø 60cm" },
];
const FIXTURES: { kind: FixtureKind; label: string; hint: string; icon: string; w: number; h: number }[] = [
  { kind: "muro", label: "Muro o División", hint: "Tabique arquitectónico", icon: "view_week", w: 200, h: 12 },
  { kind: "barra", label: "Barra / Contrabarra", hint: "Módulo de coctelería", icon: "local_bar", w: 220, h: 40 },
  { kind: "puerta", label: "Puerta de Acceso", hint: "Radio de giro y entrada", icon: "door_front", w: 64, h: 64 },
  { kind: "estacion_servicio", label: "Estación de Servicio", hint: "Pase meseros y loza", icon: "coffee_maker", w: 140, h: 44 },
  { kind: "cocina", label: "Pase de Cocina", hint: "Ventanilla de servicio", icon: "skillet", w: 240, h: 36 },
  { kind: "ventanal", label: "Ventanal", hint: "Fachada o vista", icon: "window", w: 260, h: 10 },
];
const FIX_META = Object.fromEntries(FIXTURES.map((f) => [f.kind, f])) as Record<FixtureKind, (typeof FIXTURES)[number]>;
/** Tamaño en px de cada mesa en el plano. */
const dims = (t: Pick<Table, "shape" | "capacity">): [number, number] =>
  t.shape === "periquera" ? [32, 32] : t.shape === "redonda" ? (t.capacity <= 2 ? [44, 44] : [60, 60]) : t.shape === "rectangular" ? [t.capacity >= 8 ? 128 : 104, 56] : [56, 56];
/** Caja que ocupa en pantalla tomando en cuenta la rotación. */
const box = (w: number, h: number, rot: number): [number, number] => (rot % 180 === 0 ? [w, h] : [h, w]);
const center = (t: Table) => { const [w, h] = dims(t); return { x: t.x + w / 2, y: t.y + h / 2 }; };
let seq = 0;
const newKey = () => `n${++seq}`;

type Sel = { type: "table" | "fixture"; key: string } | null;

export function FloorEditorPage() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [areaId, setAreaId] = useState("");
  const [tables, setTables] = useState<Table[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [sel, setSel] = useState<Sel>(null);
  const [zoom, setZoom] = useState(1);
  const [snap, setSnap] = useState(true);
  const [preview, setPreview] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const canvas = useRef<HTMLDivElement>(null);
  const drag = useRef<{ type: "table" | "fixture"; key: string; dx: number; dy: number; moved: boolean } | null>(null);

  const load = useCallback(async () => {
    const plan = await client.request<{ areas: Area[]; tables: (Omit<Table, "key" | "merge"> & { id: string; mergeableWith: string[] })[]; fixtures: (Omit<Fixture, "key"> & { id: string })[] }>("GET", "/floor");
    const as = [...plan.areas].sort((a, b) => a.sortOrder - b.sortOrder);
    setAreas(as);
    setAreaId((cur) => cur || as[0]?.id || "");
    setTables(plan.tables.map((t) => ({ id: t.id, key: t.id, areaId: t.areaId, label: t.label, capacity: t.capacity, shape: t.shape, x: t.x, y: t.y, rotation: t.rotation, merge: t.mergeableWith, assignedUserId: t.assignedUserId, status: t.status })));
    setFixtures(plan.fixtures.map(({ id, ...f }) => ({ ...f, key: id })));
    setRemoved([]); setHistory([]);
  }, []);
  useEffect(() => { load(); client.request<Staff[]>("GET", "/users").then(setStaff).catch(() => setStaff([])); }, [load]);

  const changes = history.length + removed.length;
  const snapshot = (): Snapshot => ({ tables, fixtures });
  const commit = (next: Partial<Snapshot>) => {
    setHistory((h) => [...h.slice(-49), snapshot()]);
    if (next.tables) setTables(next.tables);
    if (next.fixtures) setFixtures(next.fixtures);
  };
  const undo = () => { const prev = history.at(-1); if (prev) { setTables(prev.tables); setFixtures(prev.fixtures); setHistory((h) => h.slice(0, -1)); } };
  const patchT = (key: string, p: Partial<Table>) => commit({ tables: tables.map((t) => (t.key === key ? { ...t, ...p } : t)) });
  const patchF = (key: string, p: Partial<Fixture>) => commit({ fixtures: fixtures.map((f) => (f.key === key ? { ...f, ...p } : f)) });
  const q = (v: number) => (snap ? Math.round(v / GRID) * GRID : Math.round(v));
  const clampBox = (w: number, h: number, x: number, y: number) => ({ x: Math.max(0, Math.min(W - PAD * 2 - w, q(x))), y: Math.max(0, Math.min(H - PAD * 2 - h, q(y))) });
  const clampT = (t: Table, x: number, y: number) => { const [w, h] = box(...dims(t), t.rotation); return clampBox(w, h, x, y); };
  const clampF = (f: Fixture, x: number, y: number) => { const [w, h] = box(f.w, f.h, f.rotation); return clampBox(w, h, x, y); };
  const nextLabel = (prefix = "M") => { let n = tables.length + 1; const used = new Set(tables.map((t) => t.label.toUpperCase())); while (used.has(`${prefix}${n}`)) n++; return `${prefix}${n}`; };

  /** Primer hueco de la cuadrícula donde el elemento no se encima con otro del área. */
  const freeSpot = (w: number, h: number) => {
    const others = [
      ...tables.filter((o) => o.areaId === areaId).map((o) => { const [ow, oh] = box(...dims(o), o.rotation); return { x: o.x, y: o.y, w: ow, h: oh }; }),
      ...fixtures.filter((o) => o.areaId === areaId).map((o) => { const [ow, oh] = box(o.w, o.h, o.rotation); return { x: o.x, y: o.y, w: ow, h: oh }; }),
    ];
    for (let y = 0; y <= H - PAD * 2 - h; y += GRID) for (let x = 0; x <= W - PAD * 2 - w; x += GRID)
      if (others.every((o) => x + w + GRID <= o.x || o.x + o.w + GRID <= x || y + h + GRID <= o.y || o.y + o.h + GRID <= y)) return { x, y };
    return { x: 0, y: 0 };
  };
  const addTable = (p: (typeof PRESETS)[number], at?: { x: number; y: number }) => {
    const base: Table = { key: newKey(), areaId, label: nextLabel(p.shape === "periquera" ? "P" : "M"), capacity: p.capacity, shape: p.shape, x: 0, y: 0, rotation: 0, merge: [], assignedUserId: null };
    const [w, h] = dims(base);
    const pos = at ?? freeSpot(w, h);
    const t = { ...base, ...clampT(base, pos.x, pos.y) };
    commit({ tables: [...tables, t] }); setSel({ type: "table", key: t.key });
  };
  const addFixture = (m: (typeof FIXTURES)[number], at?: { x: number; y: number }) => {
    const base: Fixture = { key: newKey(), areaId, kind: m.kind, label: m.kind === "muro" || m.kind === "ventanal" ? "" : m.label, x: 0, y: 0, w: m.w, h: m.h, rotation: 0 };
    const pos = at ?? freeSpot(m.w, m.h);
    const f = { ...base, ...clampF(base, pos.x, pos.y) };
    commit({ fixtures: [...fixtures, f] }); setSel({ type: "fixture", key: f.key });
  };
  const toCanvas = (clientX: number, clientY: number) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: (clientX - r.left) / zoom - PAD, y: (clientY - r.top) / zoom - PAD };
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const c = toCanvas(e.clientX, e.clientY);
    const [kind, idx] = e.dataTransfer.getData("text/item").split(":");
    if (kind === "t") { const p = PRESETS[Number(idx)]; if (p) { const [w, h] = dims(p); addTable(p, { x: c.x - w / 2, y: c.y - h / 2 }); } }
    if (kind === "f") { const m = FIXTURES[Number(idx)]; if (m) addFixture(m, { x: c.x - m.w / 2, y: c.y - m.h / 2 }); }
  };
  const onDown = (e: RPointerEvent, type: "table" | "fixture", item: { key: string; x: number; y: number }) => {
    e.stopPropagation(); setSel({ type, key: item.key });
    const c = toCanvas(e.clientX, e.clientY);
    drag.current = { type, key: item.key, dx: c.x - item.x, dy: c.y - item.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: RPointerEvent) => {
    const d = drag.current; if (!d) return;
    const c = toCanvas(e.clientX, e.clientY);
    if (!d.moved) { setHistory((h) => [...h.slice(-49), snapshot()]); d.moved = true; }
    if (d.type === "table") setTables((ts) => ts.map((t) => (t.key === d.key ? { ...t, ...clampT(t, c.x - d.dx, c.y - d.dy) } : t)));
    else setFixtures((fs) => fs.map((f) => (f.key === d.key ? { ...f, ...clampF(f, c.x - d.dx, c.y - d.dy) } : f)));
  };
  const onUp = () => { drag.current = null; };

  const removeTable = (t: Table) => {
    if (t.status && t.status !== "libre") return setMsg({ ok: false, text: `${t.label} tiene una cuenta abierta; no puede retirarse ahora.` });
    commit({ tables: tables.filter((x) => x.key !== t.key).map((x) => ({ ...x, merge: x.merge.filter((k) => k !== t.key) })) });
    if (t.id) setRemoved((r) => [...r, t.id!]);
    setSel(null);
  };
  const duplicate = (t: Table) => {
    const c: Table = { ...t, id: undefined, key: newKey(), label: nextLabel(t.shape === "periquera" ? "P" : "M"), status: undefined, merge: [], ...clampT(t, t.x + 20, t.y + 20) };
    commit({ tables: [...tables, c] }); setSel({ type: "table", key: c.key });
  };
  /** Activa/desactiva la fusión entre dos mesas (se guarda en ambas). */
  const toggleMerge = (a: Table, b: Table) => {
    const on = a.merge.includes(b.key);
    commit({ tables: tables.map((t) => t.key === a.key ? { ...t, merge: on ? t.merge.filter((k) => k !== b.key) : [...t.merge, b.key] } : t.key === b.key ? { ...t, merge: on ? t.merge.filter((k) => k !== a.key) : [...t.merge, a.key] } : t) });
  };

  const save = async () => {
    setSaving(true); setMsg(null);
    const ref = (key: string) => { const t = tables.find((x) => x.key === key); return t?.id ?? t?.label ?? key; };
    try {
      await client.request("PUT", "/floor/layout", {
        tables: tables.map(({ id, areaId, label, capacity, shape, x, y, rotation, merge, assignedUserId }) => ({ id, areaId, label, capacity, shape, x, y, rotation, mergeableWith: merge.map(ref), assignedUserId })),
        removed,
        fixtures: fixtures.map(({ areaId, kind, label, x, y, w, h, rotation }) => ({ areaId, kind, label, x, y, w, h, rotation })),
      });
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

  const selT = sel?.type === "table" ? tables.find((t) => t.key === sel.key) : undefined;
  const selF = sel?.type === "fixture" ? fixtures.find((f) => f.key === sel.key) : undefined;
  const area = areas.find((a) => a.id === areaId);
  const inArea = tables.filter((t) => t.areaId === areaId);
  const fixInArea = fixtures.filter((f) => f.areaId === areaId);
  const waiters = staff.filter((u) => u.active && u.roles.some((r) => r === "mesero" || r === "capitan"));
  const nameOf = (id: string | null) => staff.find((u) => u.id === id)?.name ?? null;
  // Pares de fusión visibles en el área (sin duplicar A-B / B-A).
  const pairs = inArea.flatMap((a) => a.merge.map((k) => inArea.find((b) => b.key === k)).filter((b): b is Table => !!b && a.key < b.key).map((b) => [a, b] as const));

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
          <button onClick={() => setPreview(true)} className="px-3 py-1.5 bg-white text-carbon border border-arena hover:bg-marfil-cream text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"><span className="material-symbols-outlined text-sm text-carbon-muted">visibility</span><span>Vista Previa Comandero</span></button>
          <button onClick={save} disabled={saving || changes === 0} className="px-4 py-1.5 bg-olivo hover:bg-olivo-hover text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-all shadow hover:shadow-md border border-dorado/30 disabled:opacity-50"><span className="material-symbols-outlined text-sm text-dorado">check_circle</span><span>{saving ? "Guardando…" : "Guardar Plano"}</span></button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <aside className="w-56 bg-marfil-light border-r border-arena/30 flex flex-col shrink-0 z-20 overflow-y-auto">
          <div className="p-3.5 border-b border-arena/20 bg-white/40">
            <h2 className="font-headline font-semibold text-xs tracking-wider uppercase text-olivo">Mobiliario &amp; Estructura</h2>
            <p className="text-[10px] text-carbon-muted mt-0.5">Arrastra al plano o haz clic para agregar</p>
          </div>
          <div className="p-3 space-y-4">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-carbon-muted px-1 block mb-2">Mesas de Comensales</span>
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map((p, i) => (
                  <div key={p.label} draggable onDragStart={(e) => e.dataTransfer.setData("text/item", `t:${i}`)} onClick={() => addTable(p)} className="group bg-white hover:bg-marfil-cream border border-arena/40 hover:border-dorado rounded-lg p-2.5 flex flex-col items-center justify-center text-center cursor-grab active:cursor-grabbing transition-all shadow-2xs hover:shadow-xs">
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
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-carbon-muted px-1 block mb-2">Estructura &amp; Flujo</span>
              <div className="space-y-1.5">
                {FIXTURES.map((m, i) => (
                  <div key={m.kind} draggable onDragStart={(e) => e.dataTransfer.setData("text/item", `f:${i}`)} onClick={() => addFixture(m)} className="group bg-white hover:bg-marfil-cream border border-arena/40 hover:border-dorado rounded-lg p-2 flex items-center gap-2.5 cursor-grab active:cursor-grabbing transition-all shadow-2xs">
                    <div className="w-8 h-8 rounded bg-marfil-cream border border-arena/50 flex items-center justify-center text-olivo shrink-0"><span className="material-symbols-outlined text-base">{m.icon}</span></div>
                    <div className="min-w-0"><span className="text-[11px] font-medium text-carbon block leading-tight">{m.label}</span><span className="text-[9px] text-carbon-muted">{m.hint}</span></div>
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
              {inArea.length === 0 && fixInArea.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-xs text-carbon-muted pointer-events-none">Arrastra mesas y estructura desde el panel izquierdo para armar {area?.name ?? "el área"}.</div>}

              {fixInArea.map((f) => <FixtureView key={f.key} f={f} selected={sel?.key === f.key} onPointerDown={(e) => onDown(e, "fixture", f)} />)}

              <svg className="absolute pointer-events-none" style={{ left: PAD, top: PAD }} width={W - PAD * 2} height={H - PAD * 2}>
                {pairs.map(([a, b]) => { const ca = center(a), cb = center(b); return <line key={a.key + b.key} x1={ca.x} y1={ca.y} x2={cb.x} y2={cb.y} className="stroke-dorado-dark" strokeWidth={2} strokeDasharray="5 4" />; })}
              </svg>
              {pairs.map(([a, b]) => { const ca = center(a), cb = center(b); return (
                <span key={`l${a.key}${b.key}`} className="absolute -translate-x-1/2 -translate-y-1/2 bg-dorado-soft text-olivo border border-dorado text-[8px] font-mono font-bold px-1.5 py-0.2 rounded-full shadow-2xs whitespace-nowrap pointer-events-none z-10" style={{ left: PAD + (ca.x + cb.x) / 2, top: PAD + Math.min(a.y, b.y) - 10 }}>Fusión {a.capacity + b.capacity}p</span>
              ); })}

              {inArea.map((t) => {
                const [w, h] = dims(t);
                const [bw, bh] = box(w, h, t.rotation);
                const isSel = sel?.key === t.key;
                const round = t.shape === "redonda" || t.shape === "periquera";
                const busy = t.status && t.status !== "libre";
                const seat = isSel ? "bg-dorado" : "bg-arena/80";
                return (
                  <div key={t.key} onPointerDown={(e) => onDown(e, "table", t)} className={`absolute group cursor-grab active:cursor-grabbing ${isSel ? "z-20" : "z-10"}`} style={{ left: t.x + PAD, top: t.y + PAD, width: bw, height: bh }}>
                    {isSel && <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-olivo text-amber-100 text-[10px] font-medium px-2.5 py-1 rounded-full shadow-lg border border-dorado flex items-center gap-1.5 whitespace-nowrap pointer-events-none"><span className="w-1.5 h-1.5 rounded-full bg-dorado" /><span>{t.label} · {t.capacity} personas{t.assignedUserId ? ` · ${nameOf(t.assignedUserId)}` : ""}</span></div>}
                    <div className={isSel ? "absolute -inset-1 border-2 border-dorado rounded-lg bg-dorado/5 shadow-md" : "hidden"} />
                    <div style={{ width: w, height: h, left: (bw - w) / 2, top: (bh - h) / 2, transform: `rotate(${t.rotation}deg)` }} className={`absolute bg-white border-2 flex flex-col items-center justify-center shadow-xs transition-colors ${round ? "rounded-full" : "rounded-md"} ${t.merge.length ? "border-dashed" : ""} ${isSel ? "border-olivo" : "border-olivo/80 group-hover:border-dorado"}`}>
                      <div className="flex items-center gap-1" style={{ transform: `rotate(${-t.rotation}deg)` }}>
                        <span className={`font-bold font-mono ${isSel ? "text-olivo text-sm" : "text-carbon"} ${w < 40 ? "text-[9px]" : "text-xs"}`}>{t.label}</span>
                        {busy && <span className="w-1.5 h-1.5 rounded-full bg-terracota" title="Con cuenta abierta" />}
                      </div>
                      {w >= 40 && <span className="text-[9px] font-mono text-carbon-muted" style={{ transform: `rotate(${-t.rotation}deg)` }}>{t.capacity}p{t.merge.length ? " · Unible" : ""}</span>}
                      <span className={`absolute -top-1.5 w-6 h-1 rounded-full ${seat}`} />
                      <span className={`absolute -bottom-1.5 w-6 h-1 rounded-full ${seat}`} />
                      {t.capacity > 2 && <><span className={`absolute -left-1.5 h-6 w-1 rounded-full ${seat}`} /><span className={`absolute -right-1.5 h-6 w-1 rounded-full ${seat}`} /></>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {msg && <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-xs font-medium shadow-lg z-50 ${msg.ok ? "bg-olivo text-amber-100" : "bg-terracota text-white"}`} onClick={() => setMsg(null)}>{msg.text}</div>}
        </main>

        <aside className="w-80 bg-white border-l border-arena/40 flex flex-col shrink-0 z-20 shadow-lg overflow-y-auto">
          {selT ? (
            <>
              <div className="p-4 border-b border-arena/30 flex items-center justify-between bg-marfil-cream/50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${selT.status && selT.status !== "libre" ? "bg-terracota" : "bg-emerald-600"}`} />
                    <h3 className="font-headline font-semibold text-sm tracking-wide text-carbon">Propiedades de Mesa</h3>
                  </div>
                  <span className="inline-block text-[11px] font-mono text-dorado-dark font-medium mt-0.5">{selT.label} Seleccionada · {areas.find((a) => a.id === selT.areaId)?.name}</span>
                </div>
                <button onClick={() => removeTable(selT)} className="p-1.5 text-carbon-muted hover:text-terracota hover:bg-terracota/10 rounded transition-colors" title="Retirar mesa del plano"><span className="material-symbols-outlined text-lg">delete</span></button>
              </div>
              <div className="p-4 space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-carbon-muted uppercase tracking-wider mb-1.5">Identificador / Clave</label>
                  <input value={selT.label} onChange={(e) => patchT(selT.key, { label: e.target.value.toUpperCase().slice(0, 12) })} className="block w-full px-3 py-1.5 rounded-md border border-arena text-xs font-mono font-semibold focus:ring-1 focus:ring-olivo focus:border-olivo bg-white" type="text" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-carbon-muted uppercase tracking-wider mb-1.5">Capacidad de Comensales</label>
                  <div className="flex items-center justify-between border border-arena rounded-md p-1 bg-white">
                    <button onClick={() => patchT(selT.key, { capacity: Math.max(1, selT.capacity - 1) })} className="w-8 h-8 rounded bg-marfil-cream text-carbon hover:bg-arena/30 flex items-center justify-center font-bold text-sm transition-colors">-</button>
                    <div className="text-center"><span className="text-sm font-bold text-olivo font-mono">{selT.capacity}</span><span className="text-[10px] text-carbon-muted block -mt-0.5">personas</span></div>
                    <button onClick={() => patchT(selT.key, { capacity: Math.min(30, selT.capacity + 1) })} className="w-8 h-8 rounded bg-marfil-cream text-carbon hover:bg-arena/30 flex items-center justify-center font-bold text-sm transition-colors">+</button>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-carbon-muted uppercase tracking-wider mb-1.5">Forma Geométrica</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {([["cuadrada", "Cuadrada", "w-4 h-4 rounded-xs"], ["redonda", "Redonda", "w-4 h-4 rounded-full"], ["rectangular", "Rectangular", "w-6 h-3 rounded-xs"], ["periquera", "Periquera", "w-3 h-3 rounded-full"]] as const).map(([s, l, icon]) => selT.shape === s ? (
                      <button key={s} className="py-2 px-1 text-center rounded border-2 border-olivo bg-olivo/5 text-olivo font-medium flex flex-col items-center gap-1 shadow-2xs"><span className={`${icon} border border-olivo`} /><span className="text-[10px]">{l}</span></button>
                    ) : (
                      <button key={s} onClick={() => patchT(selT.key, { shape: s })} className="py-2 px-1 text-center rounded border border-arena hover:border-dorado bg-white text-carbon-muted hover:text-carbon flex flex-col items-center gap-1 transition-colors"><span className={`${icon} border border-carbon-muted`} /><span className="text-[10px]">{l}</span></button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-carbon-muted uppercase tracking-wider mb-1.5">Área Asignada</label>
                  <select value={selT.areaId} onChange={(e) => patchT(selT.key, { areaId: e.target.value })} className="w-full border border-arena rounded-md py-1.5 px-3 text-xs bg-white focus:ring-1 focus:ring-olivo focus:border-olivo">
                    {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-carbon-muted uppercase tracking-wider mb-1.5">Mesero Asignado</label>
                  <div className="border border-arena rounded-md p-2 bg-marfil-light/40 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-olivo text-dorado font-headline font-bold text-[10px] flex items-center justify-center border border-dorado shrink-0">{(nameOf(selT.assignedUserId) ?? "—").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}</div>
                    <select value={selT.assignedUserId ?? ""} onChange={(e) => patchT(selT.key, { assignedUserId: e.target.value || null })} className="flex-1 border-0 bg-transparent text-xs font-semibold text-carbon focus:ring-0 p-0">
                      <option value="">Sin asignar (cualquiera)</option>
                      {waiters.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <p className="text-[10px] text-carbon-muted mt-1">El comandero de ese mesero destaca sus mesas.</p>
                </div>
                <div className="p-3 rounded-lg border border-dorado/50 bg-dorado-soft/20">
                  <span className="text-xs font-semibold text-carbon block mb-1">Permitir Fusión</span>
                  <p className="text-[10px] text-carbon-muted leading-relaxed mb-2">Habilita la unión rápida en comandero para grupos, con una sola comanda y cuenta.</p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {inArea.filter((o) => o.key !== selT.key).sort((a, b) => Math.hypot(center(a).x - center(selT).x, center(a).y - center(selT).y) - Math.hypot(center(b).x - center(selT).x, center(b).y - center(selT).y)).slice(0, 6).map((o) => (
                      <label key={o.key} className="flex items-center justify-between cursor-pointer">
                        <span className="text-[11px] text-carbon">Con {o.label} <span className="text-carbon-muted">({o.capacity}p → {selT.capacity + o.capacity}p)</span></span>
                        <span className="relative inline-flex items-center">
                          <input checked={selT.merge.includes(o.key)} onChange={() => toggleMerge(selT, o)} className="sr-only peer" type="checkbox" />
                          <div className="w-8 h-4 bg-arena rounded-full peer peer-checked:bg-olivo peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all" />
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <Geometry x={selT.x} y={selT.y} rotation={selT.rotation} onRotate={() => { const r = (selT.rotation + 90) % 360; patchT(selT.key, { rotation: r, ...clampT({ ...selT, rotation: r }, selT.x, selT.y) }); }} />
                {selT.status && selT.status !== "libre" && <p className="text-[11px] text-terracota">Esta mesa tiene una cuenta abierta: puedes moverla o editarla, pero no retirarla.</p>}
              </div>
              <div className="mt-auto p-4 border-t border-arena/30 bg-marfil-cream/30 space-y-2">
                <button onClick={() => duplicate(selT)} className="w-full py-2 bg-white hover:bg-marfil-cream border border-arena rounded-md text-xs font-semibold text-carbon flex items-center justify-center gap-1.5 transition-colors shadow-2xs"><span className="material-symbols-outlined text-sm text-carbon-muted">content_copy</span>Duplicar Mesa ({nextLabel(selT.shape === "periquera" ? "P" : "M")})</button>
              </div>
            </>
          ) : selF ? (
            <>
              <div className="p-4 border-b border-arena/30 flex items-center justify-between bg-marfil-cream/50">
                <div>
                  <div className="flex items-center gap-2"><span className="material-symbols-outlined text-base text-dorado-dark">{FIX_META[selF.kind].icon}</span><h3 className="font-headline font-semibold text-sm tracking-wide text-carbon">{FIX_META[selF.kind].label}</h3></div>
                  <span className="inline-block text-[11px] font-mono text-dorado-dark font-medium mt-0.5">Estructura · {areas.find((a) => a.id === selF.areaId)?.name}</span>
                </div>
                <button onClick={() => { commit({ fixtures: fixtures.filter((f) => f.key !== selF.key) }); setSel(null); }} className="p-1.5 text-carbon-muted hover:text-terracota hover:bg-terracota/10 rounded transition-colors" title="Quitar del plano"><span className="material-symbols-outlined text-lg">delete</span></button>
              </div>
              <div className="p-4 space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-carbon-muted uppercase tracking-wider mb-1.5">Etiqueta</label>
                  <input value={selF.label} onChange={(e) => patchF(selF.key, { label: e.target.value.slice(0, 40) })} placeholder="Opcional" className="block w-full px-3 py-1.5 rounded-md border border-arena text-xs focus:ring-1 focus:ring-olivo focus:border-olivo bg-white" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(["w", "h"] as const).map((k) => (
                    <label key={k}><span className="block text-[11px] font-medium text-carbon-muted uppercase tracking-wider mb-1.5">{k === "w" ? "Largo" : "Ancho"} (px)</span>
                      <input type="number" min={8} max={1000} step={GRID / 2} value={selF[k]} onChange={(e) => { const v = Math.max(8, Math.min(1000, Number(e.target.value) || 8)); const n = { ...selF, [k]: v }; patchF(selF.key, { [k]: v, ...clampF(n, selF.x, selF.y) }); }} className="block w-full px-3 py-1.5 rounded-md border border-arena text-xs font-mono focus:ring-1 focus:ring-olivo focus:border-olivo bg-white" />
                    </label>
                  ))}
                </div>
                <Geometry x={selF.x} y={selF.y} rotation={selF.rotation} onRotate={() => { const r = (selF.rotation + 90) % 360; patchF(selF.key, { rotation: r, ...clampF({ ...selF, rotation: r }, selF.x, selF.y) }); }} />
              </div>
            </>
          ) : (
            <div className="p-6 text-xs text-carbon-muted space-y-2">
              <h3 className="font-headline font-semibold text-sm text-carbon">Propiedades</h3>
              <p>Selecciona una mesa o un elemento de estructura del plano para editarlo.</p>
              <p>Los cambios se aplican al presionar <b>Guardar Plano</b>.</p>
            </div>
          )}
        </aside>
      </div>

      {preview && <ComanderoPreview area={area?.name ?? ""} tables={inArea} nameOf={nameOf} onClose={() => setPreview(false)} />}
    </div>
  );
}

function Geometry({ x, y, rotation, onRotate }: { x: number; y: number; rotation: number; onRotate: () => void }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-carbon-muted uppercase tracking-wider mb-1.5">Geometría &amp; Orientación</label>
      <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
        <div className="bg-marfil-cream border border-arena/60 rounded px-2 py-1"><span className="text-[9px] text-carbon-muted block">POS X</span><span className="font-semibold text-carbon">{x} px</span></div>
        <div className="bg-marfil-cream border border-arena/60 rounded px-2 py-1"><span className="text-[9px] text-carbon-muted block">POS Y</span><span className="font-semibold text-carbon">{y} px</span></div>
        <button onClick={onRotate} className="bg-marfil-cream border border-arena/60 rounded px-2 py-1 text-left hover:border-dorado transition-colors" title="Girar 90°">
          <span className="text-[9px] text-carbon-muted flex items-center justify-between">ROTACIÓN <span className="material-symbols-outlined text-[12px] text-dorado-dark">rotate_right</span></span>
          <span className="font-semibold text-carbon">{rotation}°</span>
        </button>
      </div>
    </div>
  );
}

function FixtureView({ f, selected, onPointerDown }: { f: Fixture; selected: boolean; onPointerDown: (e: RPointerEvent) => void }) {
  const [bw, bh] = box(f.w, f.h, f.rotation);
  const body: Record<FixtureKind, string> = {
    muro: "bg-carbon-soft/80 rounded-xs",
    ventanal: "bg-sky-100 border border-sky-300/80 rounded-xs",
    barra: "bg-olivo/90 rounded border border-dorado/40 flex items-center justify-center text-dorado text-[10px] font-headline tracking-widest uppercase",
    cocina: "bg-carbon-soft/80 rounded-xs flex items-center justify-center text-[8px] text-white tracking-widest font-mono uppercase",
    estacion_servicio: "bg-white border border-arena rounded-lg shadow-xs flex items-center gap-2 px-2",
    puerta: "border-l-2 border-b-2 border-dashed border-dorado-dark/80 rounded-bl-full flex items-end justify-start pl-1 pb-1",
  };
  return (
    <div onPointerDown={onPointerDown} className={`absolute cursor-grab active:cursor-grabbing ${selected ? "z-20" : "z-0"}`} style={{ left: f.x + PAD, top: f.y + PAD, width: bw, height: bh }}>
      {selected && <div className="absolute -inset-1 border-2 border-dorado rounded-lg bg-dorado/5 pointer-events-none" />}
      <div className={`absolute overflow-hidden ${body[f.kind]}`} style={{ width: f.w, height: f.h, left: (bw - f.w) / 2, top: (bh - f.h) / 2, transform: `rotate(${f.rotation}deg)` }}>
        {f.kind === "estacion_servicio" && <span className="material-symbols-outlined text-base text-olivo">coffee_maker</span>}
        {f.kind === "puerta" ? <span className="text-[9px] uppercase tracking-widest text-carbon-muted font-headline font-bold">{f.label || "Puerta"}</span>
          : f.kind === "estacion_servicio" ? <span className="text-[10px] font-semibold text-carbon truncate">{f.label}</span>
          : f.h >= 14 && f.label ? <span className="truncate px-1">{f.label}</span> : null}
      </div>
    </div>
  );
}

/** Así verá el mesero el área en su comandero (estado libre). */
function ComanderoPreview({ area, tables, nameOf, onClose }: { area: string; tables: Table[]; nameOf: (id: string | null) => string | null; onClose: () => void }) {
  const sorted = [...tables].sort((a, b) => a.y - b.y || a.x - b.x);
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="w-[390px] h-[760px] bg-[#1E2F28] rounded-[2.5rem] p-3 shadow-2xl border-4 border-carbon" onClick={(e) => e.stopPropagation()}>
        <div className="w-full h-full bg-[#EAE6DD] rounded-[2rem] overflow-hidden flex flex-col">
          <div className="bg-[#1E2F28] px-4 pt-6 pb-3 text-center">
            <span className="text-[10px] uppercase tracking-widest text-[#C9B89F]">Vista previa · Comandero</span>
            <div className="font-headline text-lg text-[#D4AF7C] font-semibold">{area}</div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2.5 content-start">
            {sorted.map((t) => (
              <article key={t.key} className="bg-[#F5F3EF] text-[#1A1A1A] rounded-lg p-3 border border-[#C9B89F] shadow-2xs flex flex-col justify-between h-[122px] relative">
                <div className="flex items-start justify-between">
                  <span className="font-display text-2xl font-bold text-[#1E2F28]">{t.label}</span>
                  <span className="text-[10px] font-medium text-[#1E2F28]/70 bg-white px-1.5 py-0.5 rounded border border-[#C9B89F]/60">{t.capacity}p</span>
                </div>
                <div className="space-y-0.5">
                  {t.merge.length > 0 && <span className="text-[10px] text-[#8A6A2F] font-semibold flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">link</span>Unible</span>}
                  {t.assignedUserId && <span className="text-[10px] text-[#1A1A1A]/60 block truncate">Sección: {nameOf(t.assignedUserId)}</span>}
                  <span className="text-[11px] uppercase tracking-wider text-emerald-800 font-semibold">Libre</span>
                </div>
              </article>
            ))}
          </div>
          <button onClick={onClose} className="m-3 py-2.5 rounded-lg bg-[#1E2F28] text-[#D4AF7C] text-xs font-semibold">Cerrar vista previa</button>
        </div>
      </div>
    </div>
  );
}
