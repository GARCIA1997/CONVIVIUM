import type { FloorPlan } from "@convivium/api-client";
import { useRealtime, useSession } from "@convivium/app-shell";
import { Button, tableStatusStyle } from "@convivium/ui";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

/** E3-01 · Plano de mesas con estado por color; E3-10 · cuentas de barra. */
export function FloorPage() {
  const { client } = useSession();
  const nav = useNavigate();
  const [plan, setPlan] = useState<FloorPlan | null>(null);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ kind: "mesa"; table: FloorPlan["tables"][number] } | { kind: "barra" } | null>(null);
  const load = useCallback(() => client.floor.get().then((p) => { setPlan(p); setAreaId((a) => a ?? p.areas[0]?.id ?? null); }), [client]);
  useEffect(() => { load(); }, [load]);
  useRealtime(["floor"], () => load());

  if (!plan) return <p style={{ padding: 16 }}>Cargando plano…</p>;

  const openTable = (t: FloorPlan["tables"][number]) => (t.openCheckId ? nav(`/cuenta/${t.openCheckId}`) : setSheet({ kind: "mesa", table: t }));
  const confirmTable = async (tableId: string, guests: number) => nav(`/cuenta/${(await client.orders.open({ kind: "mesa", tableId, guests })).id}`);
  const confirmBar = async (name: string) => nav(`/cuenta/${(await client.orders.open({ kind: "barra", name })).id}`);

  return (
    <main style={{ padding: 16 }}>
      <nav style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {plan.areas.map((a) => (
          <button key={a.id} className={`cv-btn ${a.id === areaId ? "cv-btn--primary" : "cv-btn--ghost"}`} onClick={() => setAreaId(a.id)}>{a.name}</button>
        ))}
      </nav>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16, fontSize: 12 }}>
        {Object.values(tableStatusStyle).map((s) => (
          <span key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <i style={{ width: 12, height: 12, borderRadius: 3, background: s.bg, border: "1px solid var(--border)" }} />{s.label}
          </span>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))", gap: 12 }}>
        {plan.tables.filter((t) => t.areaId === areaId).map((t) => {
          const s = tableStatusStyle[t.status]!;
          return (
            <button key={t.id} onClick={() => openTable(t)}
              style={{ aspectRatio: "1", borderRadius: t.shape === "redonda" ? "50%" : "var(--radius)", background: s.bg, color: s.fg, border: "1px solid var(--border)", fontWeight: 700, fontSize: 18, cursor: "pointer" }}>
              {t.label}
              <div style={{ fontSize: 11, fontWeight: 400 }}>{t.capacity} pax</div>
            </button>
          );
        })}
      </div>
      <button className="cv-btn cv-btn--primary" style={{ position: "fixed", right: 16, bottom: 16 }} onClick={() => setSheet({ kind: "barra" })}>+ Cuenta de barra</button>
      {sheet?.kind === "mesa" && <GuestsSheet label={sheet.table.label} max={sheet.table.capacity + 4} onCancel={() => setSheet(null)} onConfirm={(g) => confirmTable(sheet.table.id, g)} />}
      {sheet?.kind === "barra" && <BarSheet onCancel={() => setSheet(null)} onConfirm={confirmBar} />}
    </main>
  );
}

function Sheet({ title, children, onCancel }: { title: string; children: React.ReactNode; onCancel: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "flex-end", zIndex: 20 }} onClick={onCancel}>
      <div className="cv-card" style={{ width: "100%", borderRadius: "16px 16px 0 0" }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: 12 }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

function GuestsSheet({ label, max, onCancel, onConfirm }: { label: string; max: number; onCancel: () => void; onConfirm: (guests: number) => void }) {
  return (
    <Sheet title={`Abrir ${label} · comensales`} onCancel={onCancel}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <Button key={n} variant="ghost" style={{ minHeight: 56, fontSize: 20 }} onClick={() => onConfirm(n)}>{n}</Button>
        ))}
      </div>
    </Sheet>
  );
}

function BarSheet({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <Sheet title="Nueva cuenta de barra" onCancel={onCancel}>
      <input autoFocus placeholder="Nombre o pulsera" value={name} onChange={(e) => setName(e.target.value)}
        style={{ width: "100%", height: 48, padding: "0 12px", borderRadius: 8, border: "1px solid var(--border)" }} />
      <Button style={{ width: "100%", marginTop: 12 }} disabled={!name.trim()} onClick={() => onConfirm(name.trim())}>Abrir cuenta</Button>
    </Sheet>
  );
}
