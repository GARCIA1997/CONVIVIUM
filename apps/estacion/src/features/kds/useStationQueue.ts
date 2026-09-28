import type { Client } from "@convivium/api-client";
import { useRealtime, useSession } from "@convivium/app-shell";
import { semaforo, type Semaforo } from "@convivium/domain";
import { useCallback, useEffect, useMemo, useState } from "react";

export type QItem = Awaited<ReturnType<Client["stations"]["queue"]>>[number];

export interface Ticket {
  checkId: string;
  items: QItem[];
  tableLabel: string;
  waiterName: string;
  folio: string;
  sentAt: number;
  elapsedSec: number;
  targetSec: number;
  semaforo: Semaforo;
  rehacer: boolean;
  pending: QItem[];
}

/** Cola de una estación agrupada por cuenta (tarjeta), con reloj y tiempo real. */
export function useStationQueue(stationId: string) {
  const { client } = useSession();
  const [items, setItems] = useState<QItem[]>([]);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(() => client.stations.queue(stationId).then(setItems), [client, stationId]);
  useEffect(() => {
    load();
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [load]);
  // Cualquier cambio en la estación recarga la cola (trae mesa y mesero ya resueltos).
  useRealtime([`station:${stationId}`], () => load());

  const tickets = useMemo<Ticket[]>(() => {
    const groups = new Map<string, QItem[]>();
    for (const i of items) groups.set(i.checkId, [...(groups.get(i.checkId) ?? []), i]);
    return [...groups.values()]
      .map((g) => {
        const first = g[0]!;
        const sentAt = Math.min(...g.map((i) => Date.parse(i.sentAt ?? new Date().toISOString())));
        const elapsedSec = Math.max(0, (now - sentAt) / 1000);
        const targetSec = Math.max(...g.map((i) => i.targetPrepSec));
        return {
          checkId: first.checkId,
          items: g,
          tableLabel: first.tableLabel ?? "Barra",
          waiterName: first.waiterName ?? "",
          folio: first.folio,
          sentAt,
          elapsedSec,
          targetSec,
          semaforo: semaforo(elapsedSec, targetSec),
          rehacer: g.some((i) => i.priority === "rehacer"),
          pending: g.filter((i) => i.state === "enviado" || i.state === "en_preparacion"),
        };
      })
      .filter((t) => t.pending.length > 0)
      .sort((a, b) => Number(b.rehacer) - Number(a.rehacer) || a.sentAt - b.sentAt);
  }, [items, now]);

  const consolidated = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) if (i.state === "enviado" || i.state === "en_preparacion") m.set(i.productName, (m.get(i.productName) ?? 0) + i.quantity);
    return [...m];
  }, [items]);

  return { tickets, consolidated, now, reload: load };
}

export const clock = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
export const hhmm = (ms: number) => new Date(ms).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
