import type { Approval } from "@convivium/api-client";
import { client } from "@convivium/app-shell";
import { Button, Card, Money } from "@convivium/ui";
import { useEffect, useState } from "react";

const kindLabel: Record<string, string> = { cancelacion: "Cancelación", devolucion_retiro: "Retirar de cuenta · Devolución", cortesia: "Cortesía", descuento: "Descuento", reapertura: "Reabrir cuenta" };

/** E5-01 · Aprobaciones remotas. */
export function ApprovalsPage() {
  const [items, setItems] = useState<Approval[]>([]);
  const load = () => client.approvals.list().then(setItems);
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);
  return (
    <>
      <h1>Aprobaciones · {items.length} pendientes</h1>
      <div style={{ display: "grid", gap: 12, marginTop: 24, maxWidth: 640 }}>
        {items.map((a) => (
          <Card key={a.id}>
            <div className="cv-label">{kindLabel[a.kind]}</div>
            <div style={{ fontSize: 18, margin: "8px 0" }}>{a.pct ? `${a.pct}%` : <Money cents={a.amount} />} · {new Date(a.createdAt).toLocaleTimeString("es-MX")}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="danger" onClick={() => client.approvals.resolve(a.id, "rechazar").then(load)}>Rechazar</Button>
              <Button onClick={() => client.approvals.resolve(a.id, "aprobar").then(load)}>Aprobar</Button>
            </div>
          </Card>
        ))}
        {items.length === 0 && <p style={{ color: "var(--text-muted)" }}>Nada pendiente.</p>}
      </div>
    </>
  );
}
