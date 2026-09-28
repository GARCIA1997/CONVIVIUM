import type { Check } from "@convivium/api-client";
import { useRealtime, useSession } from "@convivium/app-shell";
import { breakdownIncludedTaxes } from "@convivium/domain";
import { Badge, Button, Card, Money } from "@convivium/ui";
import { useCallback, useEffect, useState } from "react";

type Method = "efectivo_mxn" | "efectivo_usd" | "tarjeta" | "transferencia";
const METHODS: [Method, string][] = [["efectivo_mxn", "Efectivo MXN"], ["tarjeta", "Tarjeta (terminal)"], ["transferencia", "Transferencia"], ["efectivo_usd", "Efectivo USD"]];

/** E6-02 cuentas abiertas · E6-04 pagos mixtos · E6-05 propina. */
export function ChecksView() {
  const { client } = useSession();
  const [list, setList] = useState<Awaited<ReturnType<typeof client.orders.openChecks>>>([]);
  const [check, setCheck] = useState<Check | null>(null);
  const [tipPct, setTipPct] = useState(10);
  const [lines, setLines] = useState<{ method: Method; amount: string }[]>([{ method: "efectivo_mxn", amount: "" }]);
  const [result, setResult] = useState<string | null>(null);
  const usdRate = 1720; // TODO: tipo de cambio de la sucursal

  const load = useCallback(() => client.orders.openChecks().then(setList), [client]);
  useEffect(() => { load(); }, [load]);
  useRealtime(["floor"], () => load());

  const select = async (id: string) => { setResult(null); setCheck(await client.orders.get(id)); setLines([{ method: "efectivo_mxn", amount: "" }]); };
  const tip = check ? Math.round((check.total * tipPct) / 100) : 0;
  const toCents = (l: { method: Method; amount: string }) => Math.round(Number(l.amount || 0) * 100);
  const paidMxn = lines.reduce((s, l) => s + (l.method === "efectivo_usd" ? Math.round((toCents(l) * usdRate) / 100) : toCents(l)), 0);

  const pay = async () => {
    if (!check) return;
    const r = await client.cash.pay(check.id, {
      payments: lines.filter((l) => toCents(l) > 0).map((l) => ({ method: l.method, amount: toCents(l), ...(l.method === "efectivo_usd" ? { exchangeRate: usdRate } : {}) })),
      ...(tip ? { tip: { amount: tip, method: "tarjeta" } } : {}),
    });
    setResult(`Cobrado. Cambio: $${(r.change / 100).toFixed(2)}`);
    setCheck(null);
    load();
  };

  const taxes = check ? breakdownIncludedTaxes(check.total, { ivaPct: 16, iepsPct: 0 }) : null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 340px", gap: 16 }}>
      <section>
        <h2>Cuentas abiertas</h2>
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {list.map((c) => (
            <Card key={c.id} onClick={() => select(c.id)} style={{ cursor: "pointer", borderColor: check?.id === c.id ? "var(--primary)" : undefined }}>
              {c.kind === "barra" ? `Barra · ${c.name}` : `Mesa ${c.id.slice(0, 4)}`}{" "}
              {c.status === "pidio_cuenta" && <Badge color="var(--c-terracota)" text="var(--c-marfil)">Pidió cuenta</Badge>}
            </Card>
          ))}
        </div>
        {result && <p style={{ color: "var(--c-verde-ok)", fontWeight: 600 }}>{result}</p>}
      </section>

      <section>
        {check ? (
          <Card>
            <h2>Detalle</h2>
            {check.items.filter((i) => i.unitPrice > 0 || i.state === "cancelado").map((i) => (
              <div key={i.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", textDecoration: i.state === "cancelado" || i.state === "devuelto" ? "line-through" : undefined }}>
                <span>{i.quantity}× {i.productName}</span><Money cents={i.unitPrice * i.quantity} />
              </div>
            ))}
            <hr style={{ borderColor: "var(--border)" }} />
            <Row label="Subtotal" cents={check.subtotal} />
            {check.discounts > 0 && <Row label="Descuentos" cents={-check.discounts} />}
            {taxes && <Row label="IVA incluido" cents={taxes.iva} muted />}
            <Row label="Total" cents={check.total} bold />
            <Button variant="ghost" style={{ marginTop: 12 }} onClick={() => window.print()}>Imprimir pre-cuenta</Button>
          </Card>
        ) : <p style={{ color: "var(--text-muted)" }}>Selecciona una cuenta.</p>}
      </section>

      <section>
        {check && (
          <Card>
            <h2>Cobro</h2>
            <div className="cv-label" style={{ marginTop: 12 }}>Propina sugerida</div>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              {[0, 10, 15, 20].map((p) => <Button key={p} variant={tipPct === p ? "primary" : "ghost"} onClick={() => setTipPct(p)}>{p}%</Button>)}
            </div>
            <div className="cv-label" style={{ marginTop: 16 }}>Formas de pago</div>
            {lines.map((l, idx) => (
              <div key={idx} style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <select value={l.method} onChange={(e) => setLines((ls) => ls.map((x, i) => (i === idx ? { ...x, method: e.target.value as Method } : x)))} style={{ flex: 1, height: 44 }}>
                  {METHODS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </select>
                <input value={l.amount} placeholder="0.00" inputMode="decimal" onChange={(e) => setLines((ls) => ls.map((x, i) => (i === idx ? { ...x, amount: e.target.value } : x)))} style={{ width: 110, height: 44, padding: "0 8px" }} />
              </div>
            ))}
            <Button variant="ghost" style={{ marginTop: 8 }} onClick={() => setLines((ls) => [...ls, { method: "tarjeta", amount: "" }])}>+ Otra forma de pago</Button>
            <Row label="Total + propina" cents={check.total + tip} bold />
            <Row label="Recibido" cents={paidMxn} />
            <Row label="Cambio" cents={Math.max(0, paidMxn - check.total)} bold />
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>El cobro con tarjeta se realiza en la terminal externa; aquí solo se registra.</p>
            <Button style={{ width: "100%" }} disabled={paidMxn < check.total} onClick={pay}>Registrar cobro</Button>
          </Card>
        )}
      </section>
    </div>
  );
}

function Row({ label, cents, bold, muted }: { label: string; cents: number; bold?: boolean; muted?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontWeight: bold ? 700 : 400, color: muted ? "var(--text-muted)" : undefined }}>
      <span>{label}</span><Money cents={cents} />
    </div>
  );
}
