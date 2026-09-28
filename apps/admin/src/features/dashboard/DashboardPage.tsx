import { client } from "@convivium/app-shell";
import { Card, Money } from "@convivium/ui";
import { useEffect, useState } from "react";

/** E9-01 · Dashboard en vivo (refresco cada 15 s). */
export function DashboardPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof client.reports.live>> | null>(null);
  useEffect(() => {
    const load = () => client.reports.live().then(setData);
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, []);
  if (!data) return <p>Cargando…</p>;
  const kpis: [string, React.ReactNode][] = [
    ["Ventas hoy", <Money cents={data.salesToday} />],
    ["Ticket promedio", <Money cents={data.avgTicket} />],
    ["Cuentas cobradas", data.tickets],
    ["Mesas abiertas", data.openChecks],
    ["Comensales en sala", data.guests],
  ];
  return (
    <>
      <h1>Inicio <span className="cv-label" style={{ marginLeft: 12 }}>● En vivo</span></h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginTop: 24 }}>
        {kpis.map(([label, value]) => (
          <Card key={label}><div className="cv-label">{label}</div><div style={{ fontSize: 32, fontFamily: "var(--font-display)", marginTop: 8 }}>{value}</div></Card>
        ))}
      </div>
    </>
  );
}
