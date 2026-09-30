/* Selector de mesas a unir para un grupo grande. Paleta y chips del plano del comandero (Stitch). */
import type { FloorPlan } from "@convivium/api-client";
import { useState } from "react";
import { joinCandidates } from "./join";

type Table = FloorPlan["tables"][number];

export function JoinPicker({ tables, main, already = [], value, onChange }: { tables: Table[]; main: Table; already?: string[]; value: string[]; onChange: (ids: string[]) => void }) {
  const [more, setMore] = useState(false);
  // Al elegir una mesa, sus vecinas unibles también pasan a sugeridas (cadena).
  const { suggested, others } = joinCandidates(tables, main, [...already, ...value]);
  const chosen = value.map((id) => tables.find((t) => t.id === id)!).filter(Boolean);
  // Renglón con casilla, como la hoja "Unir mesas" de Stitch (mesero-unir-mesas).
  const chip = (t: Table, on: boolean) => (
    <label key={t.id} className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer ${on ? "bg-white border-[#1E2F28]/50" : "bg-white border-[#C9B89F]/40"}`}>
      <span className="flex items-center gap-2.5">
        <input type="checkbox" checked={on} onChange={() => onChange(on ? value.filter((x) => x !== t.id) : [...value, t.id])} className="rounded text-[#1E2F28] focus:ring-[#D4AF7C] border-stone-300" />
        <span className="text-xs font-semibold text-[#1E2F28]">{t.label}</span>
      </span>
      <span className="text-xs font-medium text-stone-700">{t.capacity} personas</span>
    </label>
  );
  const total = main.capacity + [...already, ...value].reduce((n, id) => n + (tables.find((t) => t.id === id)?.capacity ?? 0), 0);
  if (!chosen.length && !suggested.length && !others.length) return <p className="text-[11px] text-[#1A1A1A]/60">No hay otras mesas libres en esta área.</p>;
  return (
    <div className="space-y-3">
      {chosen.length > 0 && <div className="space-y-2">{chosen.map((t) => chip(t, true))}</div>}
      {suggested.length > 0 && (
        <div>
          <p className="text-xs text-stone-600 mb-1.5 font-medium">Junto a la mesa</p>
          <div className="space-y-2">{suggested.map((t) => chip(t, false))}</div>
        </div>
      )}
      {others.length > 0 && (more || !suggested.length ? (
        <div>
          <p className="text-xs text-stone-600 mb-1.5 font-medium">Otras mesas libres del área</p>
          <div className="space-y-2">{others.map((t) => chip(t, false))}</div>
        </div>
      ) : (
        <button onClick={() => setMore(true)} className="text-[11px] font-semibold text-[#1E2F28] underline">Ver otras {others.length} mesas libres del área</button>
      ))}
      {value.length > 0 && (
        <div className="bg-[#EAE6DD] p-2.5 rounded-lg flex items-center justify-between border border-[#C9B89F]/50">
          <span className="text-xs font-medium text-[#1E2F28]">Capacidad total</span>
          <span className="text-xs font-bold text-[#1E2F28] bg-[#D4AF7C] px-2 py-0.5 rounded">{total} personas</span>
        </div>
      )}
    </div>
  );
}
