import { useSession } from "@convivium/app-shell";
import { Button, Card } from "@convivium/ui";
import { useState } from "react";

// Identificador fijo de la caja física; en producción viene de la configuración del dispositivo.
const REGISTER_ID = "00000000-0000-4000-8000-000000000001";

/** E6-01 · Apertura de caja con fondo inicial. */
export function OpenSession({ onOpened }: { onOpened: () => void }) {
  const { client } = useSession();
  const [amount, setAmount] = useState("1500");
  const [error, setError] = useState<string | null>(null);
  return (
    <Card style={{ maxWidth: 420 }}>
      <h2>Abrir caja</h2>
      <label className="cv-label" style={{ display: "block", marginTop: 16 }}>Fondo inicial (MXN)</label>
      <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal"
        style={{ width: "100%", height: 48, fontSize: 24, padding: "0 12px", borderRadius: 8, border: "1px solid var(--border)", marginTop: 6 }} />
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      <Button style={{ width: "100%", marginTop: 16 }} onClick={() => client.cash.open(REGISTER_ID, Math.round(Number(amount) * 100)).then(onOpened).catch((e) => setError(e.message))}>
        Abrir caja
      </Button>
    </Card>
  );
}
