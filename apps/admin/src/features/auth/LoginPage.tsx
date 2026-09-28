import type { Session } from "@convivium/api-client";
import { client } from "@convivium/app-shell";
import { Button, Wordmark } from "@convivium/ui";
import { useState } from "react";

/** Login remoto de dueño/gerente (web y PWA instalable). */
export function LoginPage({ onLogin }: { onLogin: (s: Session) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const input = { width: "100%", height: 48, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(212,175,124,.4)", background: "rgba(234,230,221,.08)", color: "var(--c-marfil)", marginTop: 12 };
  return (
    <div style={{ minHeight: "100%", background: "var(--c-olivo)", display: "grid", placeItems: "center" }}>
      <form style={{ width: 340 }} onSubmit={(e) => { e.preventDefault(); client.auth.login(email, password).then(onLogin).catch((err) => setError(err.message)); }}>
        <Wordmark color="var(--c-marfil)" />
        <input style={input} type="email" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input style={input} type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p style={{ color: "var(--c-terracota)" }}>{error}</p>}
        <Button type="submit" style={{ width: "100%", marginTop: 16, background: "var(--c-dorado)", color: "var(--c-carbon)" }}>Entrar</Button>
      </form>
    </div>
  );
}
