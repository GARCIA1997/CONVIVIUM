import { createClient, type Client, type Session } from "@convivium/api-client";
import { Button, PinPad, Wordmark } from "@convivium/ui";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export const client = createClient();
const SessionCtx = createContext<{ session: Session; client: Client; logout: () => void } | null>(null);

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

const darkScreen = { minHeight: "100%", background: "var(--c-olivo)", color: "var(--c-marfil)", padding: 24, display: "flex", flexDirection: "column" as const, justifyContent: "center", gap: 24 };

function PairScreen({ kind, deviceLabel, onDone }: { kind: DeviceKind; deviceLabel: string; onDone: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    try { await client.auth.pair({ code, name: deviceLabel, kind }); onDone(); }
    catch (e) { setError((e as Error).message); setCode(""); }
  };
  return (
    <div style={darkScreen}>
      <Wordmark color="var(--c-marfil)" />
      <div style={{ textAlign: "center" }}>
        <h2>Vincular dispositivo</h2>
        <p style={{ opacity: .7 }}>Ingresa el código de 6 dígitos que muestra Administración → Dispositivos.</p>
        {error && <p style={{ color: "var(--c-terracota)" }}>{error}</p>}
      </div>
      <PinPad length={6} value={code} onChange={setCode} onSubmit={submit} />
    </div>
  );
}

function PinScreen({ deviceLabel, onLogin }: { deviceLabel: string; onLogin: (s: Session) => void }) {
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { client.auth.deviceUsers().then(setUsers).catch((e) => setError(e.message)); }, []);
  const submit = async () => {
    if (!userId) return setError("Elige tu nombre");
    try { onLogin(await client.auth.pin(userId, pin)); }
    catch (e) { setError((e as Error).message); setPin(""); }
  };
  return (
    <div style={darkScreen}>
      <Wordmark color="var(--c-marfil)" />
      <div className="cv-label" style={{ textAlign: "center", color: "var(--c-marfil)", opacity: .7 }}>{deviceLabel}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {users.map((u) => (
          <Button key={u.id} variant={u.id === userId ? "primary" : "ghost"} onClick={() => { setUserId(u.id); setError(null); }}
            style={u.id === userId ? { background: "var(--c-dorado)", color: "var(--c-carbon)" } : { color: "var(--c-marfil)", borderColor: "rgba(212,175,124,.4)" }}>
            {u.name}
          </Button>
        ))}
      </div>
      <div style={{ textAlign: "center" }}>
        <h2>Ingresa tu PIN</h2>
        {error && <p style={{ color: "var(--c-terracota)" }}>{error}</p>}
      </div>
      <PinPad value={pin} onChange={setPin} onSubmit={submit} />
    </div>
  );
}

/** Suscripción a eventos en tiempo real dentro de un componente. */
export function useRealtime(channels: string[], onEvent: Parameters<Client["subscribe"]>[1]) {
  const key = channels.join(",");
  useEffect(() => client.subscribe(channels, onEvent), [key]); // eslint-disable-line react-hooks/exhaustive-deps
}
