import { useSession } from "@convivium/app-shell";
import { Monogram } from "@convivium/ui";
import { useEffect, useState } from "react";
import { ChecksView } from "./features/checks/ChecksView";
import { OpenSession } from "./features/session/OpenSession";

export function App() {
  const { client, session, logout } = useSession();
  const [cash, setCash] = useState<{ id: string } | null | undefined>(undefined);
  const refresh = () => client.cash.current().then(setCash);
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", minHeight: "100%" }}>
      <aside style={{ background: "var(--c-olivo)", color: "var(--c-marfil)", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}><Monogram size={28} color="var(--c-dorado)" /><span style={{ fontFamily: "var(--font-display)", letterSpacing: ".2em" }}>CAJA</span></div>
        <div style={{ opacity: 0.8 }}>{session.user.name}</div>
        <span style={{ flex: 1 }} />
        <button className="cv-btn cv-btn--ghost" style={{ color: "var(--c-marfil)" }} onClick={logout}>Salir</button>
      </aside>
      <main style={{ padding: 24 }}>
        {cash === undefined ? <p>Cargando…</p> : cash === null ? <OpenSession onOpened={refresh} /> : <ChecksView />}
      </main>
    </div>
  );
}
