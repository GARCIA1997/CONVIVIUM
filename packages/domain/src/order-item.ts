/**
 * Máquina de estados de un producto en comanda (doc 02 §3.3 y §4.3).
 */
export const ITEM_STATES = ["pendiente", "enviado", "en_preparacion", "listo", "entregado", "cancelado", "devuelto"] as const;
export type ItemState = (typeof ITEM_STATES)[number];

const TRANSITIONS: Record<ItemState, ItemState[]> = {
  pendiente: ["enviado", "cancelado"],
  enviado: ["en_preparacion", "listo", "cancelado"],
  en_preparacion: ["listo", "cancelado"],
  listo: ["entregado", "enviado" /* deshacer 10 s */, "cancelado"],
  entregado: ["devuelto"],
  cancelado: [],
  devuelto: [],
};

export function canTransition(from: ItemState, to: ItemState): boolean {
  return TRANSITIONS[from].includes(to);
}

export type CancelRequirement = "libre" | "motivo" | "autorizacion";

/** Qué se requiere para cancelar según el estado (doc 02 §4.3). */
export function cancelRequirement(state: ItemState): CancelRequirement {
  if (state === "pendiente") return "libre";
  if (state === "enviado" || state === "en_preparacion") return "motivo";
  return "autorizacion"; // listo o entregado: genera merma
}

/** Semáforo del KDS: verde < 80 % del objetivo, amarillo hasta el objetivo, rojo excedido. */
export type Semaforo = "verde" | "amarillo" | "rojo";
export function semaforo(elapsedSec: number, targetSec: number): Semaforo {
  if (elapsedSec > targetSec) return "rojo";
  if (elapsedSec >= targetSec * 0.8) return "amarillo";
  return "verde";
}
