import { useSession } from "@convivium/app-shell";
import { useEffect, useState } from "react";
import { KdsTactil } from "./features/kds/KdsTactil";
import { KdsTv } from "./features/kds/KdsTv";

const KEY = "cv.stationId";
type Station = { id: string; name: string; kind: string };

/** Primer uso: elegir la estación de este dispositivo (se recuerda). */
export function App({ mode }: { mode: "tv" | "tactil" }) {
  const { client } = useSession();
  const [stations, setStations] = useState<Station[]>([]);
  const [stationId, setStationId] = useState<string | null>(() => localStorage.getItem(KEY));
  useEffect(() => { client.catalog.stations().then(setStations); }, [client]);

  const station = stations.find((s) => s.id === stationId);
  if (!station)
    return (
      <div className="h-full bg-[#141715] text-[#EAE6DD] font-body flex flex-col items-center justify-center gap-8 p-10">
        <h1 className="font-headline text-3xl font-bold tracking-wide">¿Qué estación es este dispositivo?</h1>
        <div className="flex flex-wrap gap-5 justify-center">
          {stations.map((s) => (
            <button key={s.id} onClick={() => { localStorage.setItem(KEY, s.id); setStationId(s.id); }}
              className="w-56 h-32 rounded-2xl bg-[#1E2F28] border-2 border-[#D4AF7C]/40 hover:border-[#D4AF7C] flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-xl">
              <span className="material-symbols-outlined fill-1 text-4xl text-[#D4AF7C]">{s.kind === "barra" ? "local_bar" : "skillet"}</span>
              <span className="font-headline text-2xl font-bold">{s.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  const change = () => { localStorage.removeItem(KEY); setStationId(null); };
  return mode === "tv" ? <KdsTv station={station} /> : <KdsTactil station={station} onChangeStation={change} />;
}
