import { createClient, type Client, type Session } from "@convivium/api-client";
import { AccessScreen } from "./AccessScreen";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export const client = createClient();
const SessionCtx = createContext<{ session: Session; client: Client; logout: () => void } | null>(null);

export { AccessScreen };

export function useSession() {
  const ctx = useContext(SessionCtx);
  if (!ctx) throw new Error("useSession fuera de <DeviceGate>");
  return ctx;
}

type DeviceKind = "mesero" | "kds_tv" | "estacion_tactil" | "caja" | "admin";

/**
 * Puerta de entrada de las apps de sucursal:
 *  1. Si el dispositivo no está vinculado → código de 6 dígitos (E1-04).
 *  2. Si no hay sesión → selector de usuario + PIN (E1-03).
 *  3. Con sesión → renderiza la app. Cierra sesión por inactividad.
 */
export function DeviceGate({ kind, deviceLabel, children, idleMinutes: fallback = 5 }: { kind: DeviceKind; deviceLabel: string; children: ReactNode; idleMinutes?: number }) {
  const [paired, setPaired] = useState(!!client.deviceToken);
  const [session, setSession] = useState<Session | null>(client.session);
  const [idleMinutes, setIdleMinutes] = useState(fallback);
  useEffect(() => client.onSessionChange(setSession), []);
  const logout = () => { client.logout(); setSession(null); };

  // Minutos configurados en la sucursal (E1-03); si falla la consulta se queda el valor por omisión de la app.
  useEffect(() => {
    if (!session) return;
    const key = kind === "mesero" ? "mesero" : kind === "caja" ? "caja" : "estacion";
    client.request<{ idleMinutes?: Record<"mesero" | "caja" | "estacion", number> }>("GET", "/branch")
      .then((b) => b.idleMinutes?.[key] && setIdleMinutes(b.idleMinutes[key]))
      .catch(() => {});
  }, [session, kind]);

  // Se compara contra la hora de la última actividad y no con un setTimeout: el navegador congela los
  // temporizadores con el teléfono bloqueado o la app en segundo plano, y al volver la sesión seguiría abierta.
  useEffect(() => {
    if (!session) return;
    let last = Date.now();
    const touch = () => { last = Date.now(); };
    const check = () => { if (Date.now() - last >= idleMinutes * 60_000) logout(); };
    const onVisible = () => document.visibilityState === "visible" && check();
    const events = ["pointerdown", "keydown"] as const;
    for (const e of events) window.addEventListener(e, touch);
    document.addEventListener("visibilitychange", onVisible);
    const t = setInterval(check, 15_000);
    return () => {
      clearInterval(t);
      for (const e of events) window.removeEventListener(e, touch);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [session, idleMinutes]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!paired) return <PairScreen kind={kind} deviceLabel={deviceLabel} onDone={() => setPaired(true)} />;
  if (!session) return <PinScreen deviceLabel={deviceLabel} onLogin={setSession} />;
  return <SessionCtx.Provider value={{ session, client, logout }}>{children}</SessionCtx.Provider>;
}

function PairScreen({ kind, deviceLabel, onDone }: { kind: DeviceKind; deviceLabel: string; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <AccessScreen mode="pair" deviceLabel={deviceLabel} error={error}
      onSubmit={(code) => client.auth.pair({ code, name: deviceLabel, kind }).then(onDone, (e) => setError((e as Error).message))} />
  );
}

function PinScreen({ deviceLabel, onLogin }: { deviceLabel: string; onLogin: (s: Session) => void }) {
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { client.auth.deviceUsers().then(setUsers).catch((e) => setError(e.message)); }, []);
  return (
    <AccessScreen mode="pin" deviceLabel={deviceLabel} users={users} error={error}
      onSubmit={(pin, userId) => {
        if (!userId) return setError("Elige tu nombre");
        client.auth.pin(userId, pin).then(onLogin, (e) => setError((e as Error).message));
      }} />
  );
}

/** Suscripción a eventos en tiempo real dentro de un componente. */
export function useRealtime(channels: string[], onEvent: Parameters<Client["subscribe"]>[1]) {
  const key = channels.join(",");
  useEffect(() => client.subscribe(channels, onEvent), [key]); // eslint-disable-line react-hooks/exhaustive-deps
}
