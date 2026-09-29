/* Sin pantalla propia en Stitch: usa la identidad de design/stitch/shell-login-pin.html. Acceso remoto de dueño/gerente. */
import type { Session } from "@convivium/api-client";
import { client } from "@convivium/app-shell";
import { useState } from "react";

export function LoginPage({ onLogin }: { onLogin: (s: Session) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const input = "w-full h-12 rounded-lg bg-[#EAE6DD]/[0.05] border border-[#C9B89F]/30 text-[#EAE6DD] placeholder:text-[#C9B89F]/60 px-4 text-sm focus:ring-1 focus:ring-[#D4AF7C] focus:border-[#D4AF7C]";
  return (
    <div className="min-h-screen bg-[#1E2F28] text-[#EAE6DD] font-body flex items-center justify-center px-5 selection:bg-[#D4AF7C]/30">
      <form className="w-full max-w-sm space-y-4" onSubmit={(e) => { e.preventDefault(); client.auth.login(email, password).then(onLogin, (err) => setError(err.message)); }}>
        <section className="flex flex-col items-center text-center mb-6">
          <div className="relative w-14 h-14 mb-3 flex items-center justify-center rounded-full border border-[#D4AF7C]/40 bg-[#1E2F28] shadow-[0_0_20px_rgba(212,175,124,0.12)]">
            <span className="font-display text-2xl font-bold text-[#D4AF7C]">C</span>
          </div>
          <h1 className="font-display tracking-[0.25em] text-2xl font-bold uppercase leading-none mb-1">CONVIVIUM</h1>
          <p className="font-label tracking-[0.2em] text-[9px] uppercase text-[#D4AF7C] font-medium opacity-90">Donde todo sucede en la mesa.</p>
          <p className="text-xs text-[#C9B89F]/80 mt-4">Administración y dashboard</p>
        </section>
        <input className={input} type="email" placeholder="Correo" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={input} type="password" placeholder="Contraseña" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-xs text-[#B45A3C] font-medium">{error}</p>}
        <button type="submit" className="w-full h-12 rounded-lg bg-[#D4AF7C] text-[#1E2F28] font-semibold tracking-wide shadow-[0_2px_12px_rgba(212,175,124,0.35)] active:scale-[0.99] transition-transform flex items-center justify-center gap-2">
          Entrar <span className="material-symbols-outlined text-xl">arrow_forward</span>
        </button>
      </form>
    </div>
  );
}
