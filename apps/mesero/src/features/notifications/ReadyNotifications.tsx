import type { RealtimeEvent } from "@convivium/api-client";
import { useRealtime, useSession } from "@convivium/app-shell";
import { Button } from "@convivium/ui";
import { useState } from "react";

type Ready = Extract<RealtimeEvent, { type: "item.ready" }>;

/** E3-04 · Aviso con vibración + sonido cuando un producto del mesero está listo. */
export function ReadyNotifications() {
  const { session, client } = useSession();
  const [queue, setQueue] = useState<Ready[]>([]);
  useRealtime([`waiter:${session.user.id}`], (e) => {
    if (e.type !== "item.ready") return;
    setQueue((q) => [...q, e]);
    navigator.vibrate?.([200, 100, 200]);
    try { new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=").play(); } catch { /* sin audio */ }
  });
  const current = queue[0];
  if (!current) return null;
  const done = () => setQueue((q) => q.slice(1));
  return (
    <div role="alert" style={{ position: "sticky", top: 52, zIndex: 9, margin: 12, padding: 12, borderRadius: 8, background: "var(--c-dorado)", color: "var(--c-carbon)", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ flex: 1 }}>
        <strong>{current.tableLabel ?? "Barra"}</strong> · {current.item.quantity}× {current.item.productName} listo
        {queue.length > 1 && <span> (+{queue.length - 1})</span>}
      </div>
      <Button style={{ minHeight: 36 }} onClick={() => client.orders.transition(current.item.id, "entregado").then(done)}>Entregado</Button>
      <Button variant="ghost" style={{ minHeight: 36 }} onClick={done}>OK</Button>
    </div>
  );
}
