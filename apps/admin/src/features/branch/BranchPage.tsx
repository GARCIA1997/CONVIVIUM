/* Configuración de la sucursal. Clases del sistema de diseño Stitch (admin). */
import { client } from "@convivium/app-shell";
import { useEffect, useState } from "react";

interface Branch { name: string; timezone: string; ivaPct: 16 | 8; usdRate: number | null }
const ZONES: [string, string][] = [
  ["America/Mexico_City", "Centro (CDMX, Guadalajara, Monterrey)"],
  ["America/Cancun", "Sureste (Quintana Roo)"],
  ["America/Chihuahua", "Pacífico–Chihuahua"],
  ["America/Mazatlan", "Pacífico (Sinaloa, Nayarit, BCS)"],
  ["America/Hermosillo", "Sonora (sin horario de verano)"],
  ["America/Tijuana", "Noroeste (Baja California)"],
];

export function BranchPage() {
  const [b, setB] = useState<Branch | null>(null);
  const [saved, setSaved] = useState<Branch | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { client.request<Branch>("GET", "/branch").then((x) => { setB(x); setSaved(x); }); }, []);
  if (!b) return <main className="flex-1 p-8 text-sm text-stone-500">Cargando…</main>;
  const dirty = JSON.stringify(b) !== JSON.stringify(saved);
  const save = async () => {
    setMsg(null);
    try { await client.request("PUT", "/branch", b); setSaved(b); setMsg({ ok: true, text: "Configuración guardada. Caja y menú la usan de inmediato." }); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  };
  return (
    <main className="flex-1 p-8 bg-marfil min-h-screen">
      <div className="max-w-2xl space-y-6">
        <div><span className="text-[11px] font-bold uppercase tracking-[0.2em] text-terracota">Configuración</span><h1 className="font-serif-brand text-2xl font-bold text-stone-900">Sucursal</h1></div>
        <div className="bg-white rounded-xl border border-arena-border p-6 shadow-xs space-y-5 text-xs">
          <label className="block"><span className="block font-semibold text-stone-700 mb-1.5">Nombre de la sucursal</span><input value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} className="w-full bg-marfil-canvas/40 border border-arena-border rounded-lg px-3 py-2" /></label>
          <label className="block"><span className="block font-semibold text-stone-700 mb-1.5">Zona horaria</span>
            <select value={b.timezone} onChange={(e) => setB({ ...b, timezone: e.target.value })} className="w-full bg-marfil-canvas/40 border border-arena-border rounded-lg px-3 py-2">{ZONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <span className="block text-[11px] text-stone-500 mt-1">Define horarios de promociones, reportes por hora y el corte del día.</span>
          </label>
          <div><span className="block font-semibold text-stone-700 mb-1.5">Tasa de IVA</span>
            <div className="grid grid-cols-2 gap-2">{([[16, "16 % · Tasa general"], [8, "8 % · Región fronteriza"]] as const).map(([v, l]) => <button key={v} onClick={() => setB({ ...b, ivaPct: v })} className={b.ivaPct === v ? "py-2 rounded-lg border-2 border-olivo bg-olivo/5 text-olivo font-semibold" : "py-2 rounded-lg border border-arena-border text-stone-600"}>{l}</button>)}</div>
            <span className="block text-[11px] text-stone-500 mt-1">Los precios del menú incluyen impuestos; esta tasa define el desglose en caja, menú y reportes.</span>
          </div>
          <div><span className="block font-semibold text-stone-700 mb-1.5">Pago en dólares (efectivo)</span>
            <label className="flex items-center gap-2 mb-2 cursor-pointer"><input type="checkbox" checked={b.usdRate !== null} onChange={(e) => setB({ ...b, usdRate: e.target.checked ? 1800 : null })} className="rounded text-olivo border-arena-border" /><span>Aceptar dólares</span></label>
            {b.usdRate !== null && (
              <div className="flex items-center gap-2"><span className="text-stone-600">1 USD =</span><input type="number" min={1} step="0.01" value={b.usdRate / 100} onChange={(e) => setB({ ...b, usdRate: Math.round(Number(e.target.value) * 100) })} className="w-28 font-mono border border-arena-border rounded-lg px-3 py-2 text-right" /><span className="text-stone-600">MXN</span></div>
            )}
            <span className="block text-[11px] text-stone-500 mt-1">La caja siempre usa este tipo de cambio; el cambio se entrega en pesos.</span>
          </div>
        </div>
        {msg && <p className={`text-xs ${msg.ok ? "text-emerald-700" : "text-terracota"}`}>{msg.text}</p>}
        <div className="flex justify-end gap-2">
          <button disabled={!dirty} onClick={() => setB(saved)} className="px-4 py-2 rounded-lg border border-arena-border text-xs disabled:opacity-40">Descartar</button>
          <button disabled={!dirty || b.name.trim().length < 2} onClick={save} className="px-5 py-2 rounded-lg bg-olivo text-white text-xs font-semibold disabled:opacity-40">Guardar</button>
        </div>
      </div>
    </main>
  );
}
