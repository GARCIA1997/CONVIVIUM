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
  const chip = (t: Table, on: boolean) => (
    <button key={t.id} onClick={() => onChange(on ? value.filter((x) => x !== t.id) : [...value, t.id])} className={`px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-1 transition-colors ${on ? "bg-[#1E2F28] text-[#D4AF7C] border-[#1E2F28]" : "bg-white text-[#1E2F28] border-[#C9B89F]"}`}>
      <span className="material-symbols-outlined text-[14px]">{on ? "link" : "add_link"}</span>{t.label} · {t.capacity}p
    </button>
  );
  if (!chosen.length && !suggested.length && !others.length) return <p className="text-[11px] text-[#1A1A1A]/60">No hay otras mesas libres en esta área.</p>;
  return (
    <div className="space-y-2">
      {chosen.length > 0 && <div className="flex flex-wrap gap-1.5">{chosen.map((t) => chip(t, true))}</div>}
      {suggested.length > 0 && (
        <div>
          <span className="block text-[10px] uppercase tracking-wider font-semibold text-[#1E2F28]/60 mb-1">Junto a la mesa</span>
          <div className="flex flex-wrap gap-1.5">{suggested.map((t) => chip(t, false))}</div>
        </div>
      )}
      {others.length > 0 && (more || !suggested.length ? (
        <div>
          <span className="block text-[10px] uppercase tracking-wider font-semibold text-[#1E2F28]/60 mb-1">Otras mesas libres del área</span>
          <div className="flex flex-wrap gap-1.5">{others.map((t) => chip(t, false))}</div>
        </div>
      ) : (
        <button onClick={() => setMore(true)} className="text-[11px] font-semibold text-[#1E2F28] underline">Ver otras {others.length} mesas libres del área</button>
      ))}
    </div>
  );
}
