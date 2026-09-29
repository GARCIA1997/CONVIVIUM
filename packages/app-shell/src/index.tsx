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
export function DeviceGate({ kind, deviceLabel, children, idleMinutes = 5 }: { kind: DeviceKind; deviceLabel: string; children: ReactNode; idleMinutes?: number }) {
  const [paired, setPaired] = useState(!!client.deviceToken);
  const [session, setSession] = useState<Session | null>(client.session);
  const logout = () => { client.logout(); setSession(null); };

  useEffect(() => {
    if (!session) return;
    let t = setTimeout(logout, idleMinutes * 60_000);
    const reset = () => { clearTimeout(t); t = setTimeout(logout, idleMinutes * 60_000); };
    window.addEventListener("pointerdown", reset);
    return () => { clearTimeout(t); window.removeEventListener("pointerdown", reset); };
  }, [session, idleMinutes]);

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
