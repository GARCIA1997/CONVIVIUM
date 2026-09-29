/* Diseño: design/stitch/mesero-plano-mesas.html (Stitch) — banner "platillo listo". E3-04. */
import type { RealtimeEvent } from "@convivium/api-client";
import { useRealtime, useSession } from "@convivium/app-shell";
import { useState } from "react";

type Ready = Extract<RealtimeEvent, { type: "item.ready" }>;

export function ReadyNotifications() {
  const { session, client } = useSession();
  const [queue, setQueue] = useState<Ready[]>([]);
  useRealtime([`waiter:${session.user.id}`], (e) => {
    if (e.type !== "item.ready") return;
    setQueue((q) => [...q, e]);
    navigator.vibrate?.([200, 100, 200]);
  });
  const current = queue[0];
  if (!current) return null;
  const done = () => setQueue((q) => q.slice(1));

  return (
    <div role="alert" className="mx-3 mt-2.5 mb-1 bg-white border border-[#D4AF7C] rounded-lg p-2.5 shadow-md flex items-center justify-between gap-2.5 relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#D4AF7C]" />
      <div className="flex items-center gap-2 pl-1.5" onClick={done}>
        <div className="w-8 h-8 rounded-full bg-[#D4AF7C]/20 text-[#1E2F28] flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-[18px] text-[#B45A3C]">soup_kitchen</span>
        </div>
        <div className="leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-[#1E2F28] bg-[#EAE6DD] px-1.5 py-0.5 rounded">{current.tableLabel ?? "Barra"}</span>
            {queue.length > 1 && <span className="text-[10px] text-[#B45A3C] font-semibold uppercase tracking-wider">+{queue.length - 1} más</span>}
          </div>
          <p className="text-[12px] font-medium text-[#1A1A1A] mt-0.5">
            {current.item.quantity} {current.item.productName} {current.item.quantity > 1 ? "listos" : "listo"} para servir
          </p>
        </div>
      </div>
      <button
        onClick={() => client.orders.transition(current.item.id, "entregado").then(done)}
        className="bg-[#1E2F28] hover:bg-[#14201B] active:scale-95 text-[#D4AF7C] text-[11px] font-semibold px-2.5 py-1.5 rounded flex items-center gap-1 transition-transform flex-shrink-0 shadow-xs"
      >
        <span className="material-symbols-outlined text-[14px]">done_all</span>
        <span>Entregado</span>
      </button>
    </div>
  );
}
