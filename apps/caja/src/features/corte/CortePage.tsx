import { useSession } from "@convivium/app-shell";
import { Button, Card, Money } from "@convivium/ui";
import { useState } from "react";

const METHODS: [string, string][] = [["efectivo_mxn", "Efectivo MXN"], ["efectivo_usd", "Efectivo USD (dólares)"], ["tarjeta", "Tarjeta"], ["transferencia", "Transferencia"]];
type Result = Awaited<ReturnType<ReturnType<typeof useSession>["client"]["cash"]["count"]>>;

/** E6-07 · Corte X / Z con conteo ciego: el esperado solo se muestra después de capturar lo contado. */
export function CortePage({ onClosed }: { onClosed: () => void }) {
  const { client } = useSession();
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canZ = client.can("caja.corte_z");

  const run = async (kind: "X" | "Z") => {
    setError(null);
    try {
      const r = await client.cash.count(kind, Object.fromEntries(Object.entries(counted).map(([k, v]) => [k, Math.round(Number(v || 0) * 100)])));
      setResult(r);
      if (r.closed) setTimeout(onClosed, 4000);
    } catch (e) { setError((e as Error).message); }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 24 }}>
      <Card>
        <h2>Conteo</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Cuenta el dinero sin ver lo esperado.</p>
        {METHODS.map(([k, label]) => (
          <label key={k} style={{ display: "block", marginTop: 12 }}>
            <span className="cv-label">{label}</span>
            <input inputMode="decimal" value={counted[k] ?? ""} onChange={(e) => setCounted((c) => ({ ...c, [k]: e.target.value }))}
              style={{ width: "100%", height: 44, padding: "0 12px", marginTop: 4, borderRadius: 8, border: "1px solid var(--border)" }} />
          </label>
        ))}
        {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <Button variant="ghost" onClick={() => run("X")}>Corte X (parcial)</Button>
          <Button disabled={!canZ} title={canZ ? "" : "Requiere gerente"} onClick={() => run("Z")}>Corte Z (cerrar caja)</Button>
        </div>
      </Card>
      {result && (
        <Card>
          <h2>Corte {result.kind}{result.closed ? " · caja cerrada" : ""}</h2>
          <table style={{ width: "100%", marginTop: 16, borderCollapse: "collapse" }}>
            <thead><tr className="cv-label"><th align="left">Forma de pago</th><th align="right">Esperado</th><th align="right">Contado</th><th align="right">Diferencia</th></tr></thead>
            <tbody>
              {METHODS.map(([k, label]) => {
                const d = result.differences[k] ?? 0;
                return (
                  <tr key={k} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 0" }}>{label}</td>
                    <td align="right"><Money cents={result.expected[k] ?? 0} /></td>
                    <td align="right"><Money cents={result.counted[k] ?? 0} /></td>
                    <td align="right" style={{ color: d === 0 ? "var(--c-verde-ok)" : "var(--danger)", fontWeight: 700 }}><Money cents={d} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p style={{ marginTop: 16 }}>Ventas <Money cents={result.sales} /> · Propinas <Money cents={result.tips} /></p>
          <Button variant="ghost" onClick={() => window.print()}>Imprimir corte</Button>
        </Card>
      )}
    </div>
  );
}
