import { useSession } from "@convivium/app-shell";
import { useCallback, useEffect, useState } from "react";
import { ChecksView } from "./features/checks/ChecksView";
import { CortePage } from "./features/corte/CortePage";
import { CajaLayout, type CajaView } from "./features/layout/CajaLayout";
import { OpenSession } from "./features/session/OpenSession";

export function App() {
  const { client } = useSession();
  const [cash, setCash] = useState<{ id: string } | null | undefined>(undefined);
  const [view, setView] = useState<CajaView>("cuentas");
  const [openCount, setOpenCount] = useState(0);
  const refresh = useCallback(() => client.cash.current().then(setCash), [client]);
  useEffect(() => { refresh(); }, [refresh]);

  return (
    <CajaLayout view={view} onView={setView} openCount={openCount} sessionOpen={!!cash}>
      {cash === undefined ? null : cash === null ? (
        <OpenSession onOpened={() => { setView("cuentas"); refresh(); }} />
      ) : view === "corte" ? (
        <CortePage onClosed={() => { setView("cuentas"); refresh(); }} />
      ) : (
        <ChecksView onCount={setOpenCount} />
      )}
    </CajaLayout>
  );
}
