import { useSession } from "@convivium/app-shell";
import { useCallback, useEffect, useState } from "react";
import { ChecksView } from "./features/checks/ChecksView";
import { CortePage } from "./features/corte/CortePage";
import { CajaLayout, type CajaView } from "./features/layout/CajaLayout";
import { OpenSession } from "./features/session/OpenSession";
import { TakeoutView } from "./features/takeout/TakeoutView";

export function App() {
  const { client } = useSession();
  const [cash, setCash] = useState<{ id: string } | null | undefined>(undefined);
  const [view, setView] = useState<CajaView>("cuentas");
  const [openCount, setOpenCount] = useState(0);
  const [takeoutCount, setTakeoutCount] = useState(0);
  const [charge, setCharge] = useState<string | null>(null);
  const refresh = useCallback(() => client.cash.current().then(setCash), [client]);
  useEffect(() => { refresh(); }, [refresh]);

  return (
    <CajaLayout view={view} onView={setView} openCount={openCount} takeoutCount={takeoutCount} sessionOpen={!!cash}>
      {cash === undefined ? null : cash === null ? (
        <OpenSession onOpened={() => { setView("cuentas"); refresh(); }} />
      ) : view === "corte" ? (
        <CortePage onClosed={() => { setView("cuentas"); refresh(); }} />
      ) : view === "llevar" ? (
        <TakeoutView onCount={setTakeoutCount} onCharge={(id) => { setCharge(id); setView("cuentas"); }} />
      ) : (
        <ChecksView onCount={setOpenCount} initialCheckId={charge} />
      )}
    </CajaLayout>
  );
}
