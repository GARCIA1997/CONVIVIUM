import type { OrderItem } from "@convivium/api-client";
import { useRealtime, useSession } from "@convivium/app-shell";
import { semaforo } from "@convivium/domain";
import { Monogram, semaforoColor } from "@convivium/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

type QItem = OrderItem & { targetPrepSec?: number };

/**
 * E4-01 tarjetas por llegada · E4-02 semáforo · E4-03 tocar = listo, deshacer 10 s
 * E4-04 REHACER arriba y cancelados tachados · E4-06 consolidado.
 */
export function KdsBoard({ station, mode, onChangeStation }: { station: { id: string; name: string }; mode: "tv" | "tactil"; onChangeStation: () => void }) {
  const { client } = useSession();
  const [items, setItems] = useState<QItem[]>([]);
  const [undo, setUndo] = useState<{ id: string; until: number } | null>(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(() => client.stations.queue(station.id).then(setItems), [client, station.id]);
  useEffect(() => { load(); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [load]);
  useRealtime([`station:${station.id}`], (e) => {
    if (e.type === "item.sent") setItems((xs) => [...xs, e.item]);
    if (e.type === "item.updated") setItems((xs) => xs.map((x) => (x.id === e.item.id ? { ...x, ...e.item } : x)));
  });

  // Agrupa por cuenta; REHACER primero, luego por hora de envío.
  const cards = useMemo(() => {
    const visible = items.filter((i) => i.state !== "entregado" && (i.state !== "listo" || undo?.id === i.id || mode === "tv"));
    const byCheck = new Map<string, QItem[]>();
    for (const i of visible) byCheck.set(i.checkId, [...(byCheck.get(i.checkId) ?? []), i]);
    return [...byCheck.values()]
      .filter((g) => g.some((i) => i.state !== "cancelado" && i.state !== "listo") || g.some((i) => i.id === undo?.id))
      .sort((a, b) => {
        const ra = a.some((i) => i.priority === "rehacer") ? 0 : 1;
        const rb = b.some((i) => i.priority === "rehacer") ? 0 : 1;
        return ra - rb || Date.parse(a[0]!.sentAt ?? "") - Date.parse(b[0]!.sentAt ?? "");
      });
  }, [items, undo, mode]);

  const consolidated = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) if (i.state === "enviado" || i.state === "en_preparacion") m.set(i.productName, (m.get(i.productName) ?? 0) + i.quantity);
    return [...m];
  }, [items]);

  const markReady = async (ids: string[]) => {
    if (mode === "tv") return;
    for (const id of ids) await client.orders.transition(id, "listo");
    setUndo({ id: ids[0]!, until: Date.now() + 10_000 });
    load();
  };
  const doUndo = async () => {
    if (!undo) return;
    await client.orders.transition(undo.id, "enviado");
    setUndo(null);
    load();
  };
  useEffect(() => { if (undo && now > undo.until) setUndo(null); }, [now, undo]);

  const big = mode === "tv";
  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 20px", borderBottom: "1px solid var(--border)" }}>
        <Monogram size={32} color="var(--c-dorado)" />
        <h1 style={{ fontSize: big ? 36 : 24, letterSpacing: ".1em", textTransform: "uppercase" }}>{station.name}</h1>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: big ? 32 : 20, fontVariantNumeric: "tabular-nums" }}>{new Date(now).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</span>
        {mode === "tactil" && <button className="cv-btn cv-btn--ghost" onClick={onChangeStation}>Cambiar estación</button>}
      </header>

      <main style={{ flex: 1, display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${big ? 340 : 280}px, 1fr))`, gap: 16, padding: 16, alignContent: "start" }}>
        {cards.map((group) => {
          const first = group[0]!;
          const elapsed = Math.max(0, (now - Date.parse(first.sentAt ?? new Date().toISOString())) / 1000);
          const target = Math.max(...group.map((i) => i.targetPrepSec ?? 900));
          const color = semaforoColor[semaforo(elapsed, target)];
          const rehacer = group.some((i) => i.priority === "rehacer");
          const pending = group.filter((i) => i.state === "enviado" || i.state === "en_preparacion");
          return (
            <article key={first.checkId} style={{ background: "var(--surface)", borderRadius: 8, overflow: "hidden", border: `3px solid ${rehacer ? "var(--c-terracota)" : color}` }}>
              <div style={{ background: rehacer ? "var(--c-terracota)" : color, color: "var(--c-marfil)", padding: "8px 12px", display: "flex", justifyContent: "space-between", fontSize: big ? 24 : 18, fontWeight: 700 }}>
                <span>{rehacer ? "REHACER · " : ""}#{first.checkId.slice(0, 4).toUpperCase()}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{Math.floor(elapsed / 60)}:{String(Math.floor(elapsed % 60)).padStart(2, "0")}</span>
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {group.map((i) => (
                  <li key={i.id}>
                    <button disabled={mode === "tv" || i.state === "cancelado" || i.state === "listo"} onClick={() => markReady([i.id])}
                      style={{ width: "100%", textAlign: "left", background: "transparent", color: "inherit", border: 0, borderBottom: "1px solid var(--border)", padding: "12px", minHeight: 56, cursor: mode === "tv" ? "default" : "pointer", fontSize: big ? 26 : 20, textDecoration: i.state === "cancelado" ? "line-through" : undefined, opacity: i.state === "listo" ? 0.4 : 1 }}>
                      <strong>{i.quantity}×</strong> {i.productName}
                      {i.state === "cancelado" && <span style={{ color: "var(--c-terracota)", fontSize: 14 }}> CANCELADO</span>}
                      {(i.modifiers.length > 0 || i.note) && (
                        <div style={{ color: "var(--c-dorado)", fontSize: big ? 20 : 15 }}>★ {[...i.modifiers, i.note].filter(Boolean).join(" · ")}</div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              {mode === "tactil" && pending.length > 1 && (
                <button className="cv-btn cv-btn--primary" style={{ width: "100%", borderRadius: 0, minHeight: 56 }} onClick={() => markReady(pending.map((i) => i.id))}>Toda lista</button>
              )}
            </article>
          );
        })}
        {cards.length === 0 && <p style={{ opacity: 0.6, fontSize: 24 }}>Sin comandas pendientes.</p>}
      </main>

      <footer style={{ padding: "10px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 24, alignItems: "center", fontSize: big ? 22 : 16 }}>
        <span className="cv-label">En preparación</span>
        {consolidated.map(([name, qty]) => <span key={name}><strong>{qty}</strong> {name}</span>)}
        <span style={{ flex: 1 }} />
        {undo && <button className="cv-btn cv-btn--primary" onClick={doUndo}>Deshacer ({Math.ceil((undo.until - now) / 1000)} s)</button>}
      </footer>
    </div>
  );
}
