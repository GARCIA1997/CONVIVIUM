import { useSession } from "@convivium/app-shell";
import { Button } from "@convivium/ui";
import { useEffect, useState } from "react";
import { KdsBoard } from "./features/kds/KdsBoard";

const KEY = "cv.stationId";

/** Primer uso: elegir la estación de este dispositivo (se recuerda). */
export function App({ mode }: { mode: "tv" | "tactil" }) {
  const { client } = useSession();
  const [stations, setStations] = useState<{ id: string; name: string; kind: string }[]>([]);
  const [stationId, setStationId] = useState<string | null>(() => localStorage.getItem(KEY));
  useEffect(() => { client.catalog.stations().then(setStations); }, [client]);

  const station = stations.find((s) => s.id === stationId);
  if (!station)
    return (
      <main style={{ padding: 32 }}>
        <h1>¿Qué estación es este dispositivo?</h1>
        <div style={{ display: "flex", gap: 16, marginTop: 24, flexWrap: "wrap" }}>
          {stations.map((s) => (
            <Button key={s.id} style={{ minHeight: 96, minWidth: 200, fontSize: 24 }} onClick={() => { localStorage.setItem(KEY, s.id); setStationId(s.id); }}>
              {s.name}
            </Button>
          ))}
        </div>
      </main>
    );
  return <KdsBoard station={station} mode={mode} onChangeStation={() => { localStorage.removeItem(KEY); setStationId(null); }} />;
}
