/* Diseño: design/stitch/shell-login-pin.html (Stitch). Marcado y clases originales; datos reales. */
import { useState } from "react";

export interface AccessUser {
  id: string;
  name: string;
}

const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/** Acceso de dispositivos: "pin" = colaborador + PIN (E1-03) · "pair" = código de vinculación (E1-04). */
export function AccessScreen(props: {
  mode: "pin" | "pair";
  deviceLabel: string;
  users?: AccessUser[];
  error?: string | null;
  onSubmit: (value: string, userId: string | null) => void;
}) {
  const { mode, deviceLabel, users = [], error } = props;
  const length = mode === "pair" ? 6 : 4;
  const [value, setValue] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const press = (k: string) => setValue((v) => (v.length < length ? v + k : v));
  const submit = () => {
    if (value.length !== length) return;
    props.onSubmit(value, userId);
    setValue("");
  };

  return (
    <div className="h-full bg-[#1E2F28] text-[#EAE6DD] font-body flex flex-col justify-between selection:bg-[#D4AF7C]/30 selection:text-[#EAE6DD] overflow-x-hidden antialiased select-none">
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-4 h-12 text-[#EAE6DD] bg-[#1E2F28] border-b border-[#C9B89F]/20">
        <div className="flex items-center space-x-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4AF7C] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D4AF7C]" />
          </span>
          <span className="material-symbols-outlined text-[#D4AF7C] text-sm">wifi</span>
          <span className="text-[11px] font-label text-[#C9B89F] tracking-wide font-normal">En línea · {deviceLabel}</span>
        </div>
        <div className="font-display tracking-[0.2em] font-semibold text-[#EAE6DD] text-xs uppercase opacity-90">CONVIVIUM</div>
        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-label text-[#C9B89F]/70">PWA Kiosk</span>
          <span className="material-symbols-outlined text-[#D4AF7C] text-sm">lock_clock</span>
        </div>
      </header>
      <main className="w-full max-w-md mx-auto pt-14 pb-4 px-5 flex-1 flex flex-col justify-between">
        <section className="flex flex-col items-center text-center mt-2 mb-3">
          <div className="relative w-12 h-12 mb-2 flex items-center justify-center rounded-full border border-[#D4AF7C]/40 bg-[#1E2F28] shadow-[0_0_20px_rgba(212,175,124,0.12)]">
            <svg className="w-7 h-7 text-[#D4AF7C]" fill="none" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
              <path d="M25 11C23.6 9.8 21.8 9 19.8 9C14.4 9 10 13.9 10 20C10 26.1 14.4 31 19.8 31C22.1 31 24.2 30 25.6 28.5" stroke="#D4AF7C" strokeLinecap="round" strokeWidth="1.8" />
              <path d="M20 14C23.3 14 26 16.7 26 20C26 22.8 24.1 25.1 21.5 25.8V29H24" stroke="#EAE6DD" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" />
              <path d="M19 29H24" stroke="#EAE6DD" strokeLinecap="round" strokeWidth="1.4" />
              <circle cx="20" cy="11.5" fill="#D4AF7C" r="1.2" />
            </svg>
          </div>
          <h1 className="font-display tracking-[0.25em] text-xl font-bold uppercase text-[#EAE6DD] leading-none mb-1">CONVIVIUM</h1>
          <p className="font-label tracking-[0.2em] text-[9px] uppercase text-[#D4AF7C] font-medium opacity-90">Donde todo sucede en la mesa.</p>
        </section>
        {mode === "pin" && (
          <section className="mb-4">
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[11px] font-label uppercase tracking-widest text-[#C9B89F]/80">Turno en curso</span>
              <span className="text-[10px] text-[#D4AF7C] font-medium">Toque para seleccionar</span>
            </div>
            <div className="grid grid-cols-3 gap-2.5 max-h-48 overflow-y-auto custom-scrollbar">
              {users.map((u) => {
                const active = u.id === userId;
                return (
                  <button key={u.id} type="button" onClick={() => setUserId(u.id)}
                    className={active
                      ? "group flex flex-col items-center p-2 rounded-lg bg-[#EAE6DD]/[0.06] border border-[#D4AF7C] shadow-sm transition-all active:scale-95 text-left"
                      : "group flex flex-col items-center p-2 rounded-lg bg-[#EAE6DD]/[0.03] border border-[#C9B89F]/25 hover:border-[#D4AF7C]/60 transition-all active:scale-95 text-left"}>
                    <div className={`relative w-10 h-10 rounded-full border ${active ? "border-[#D4AF7C]" : "border-[#C9B89F]/40"} p-0.5 mb-1.5 flex items-center justify-center bg-[#1E2F28]`}>
                      <span className={`font-display text-sm font-semibold ${active ? "text-[#D4AF7C]" : "text-[#C9B89F]"}`}>{initials(u.name)}</span>
                      {active && <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#4E8D68] rounded-full border-2 border-[#1E2F28]" />}
                    </div>
                    <span className={active ? "text-xs font-semibold text-[#EAE6DD] tracking-wide" : "text-xs font-medium text-[#EAE6DD]/90 tracking-wide"}>{u.name}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
        <section className="flex flex-col items-center justify-center mb-3 text-center">
          <h2 className="text-sm font-medium tracking-wide text-[#EAE6DD] mb-0.5">{mode === "pin" ? "Ingresa tu PIN de servicio" : "Vincular este dispositivo"}</h2>
          <p className="text-[11px] text-[#C9B89F]/80 mb-3">{mode === "pin" ? "4 dígitos de autorización de comanda" : "Código de 6 dígitos de Administración → Dispositivos"}</p>
          <div aria-label={`${value.length} de ${length} dígitos`} className="flex items-center justify-center space-x-4 py-1" role="status">
            {Array.from({ length }, (_, i) => i < value.length
              ? <div key={i} className="w-3.5 h-3.5 rounded-full bg-[#D4AF7C] shadow-[0_0_10px_#D4AF7C] border border-[#D4AF7C]" />
              : <div key={i} className="w-3.5 h-3.5 rounded-full bg-transparent border-2 border-[#C9B89F]/40" />)}
          </div>
          {error && <p className="mt-2 text-[11px] text-[#B45A3C] font-medium">{error}</p>}
        </section>
        <section className="w-full mb-3">
          <div className="grid grid-cols-3 gap-2.5 max-w-[320px] mx-auto">
            {KEYS.map((k) => (
              <button key={k} onClick={() => press(k)} className="touch-ripple h-14 rounded-lg bg-[#EAE6DD]/[0.05] border border-[#C9B89F]/20 flex flex-col items-center justify-center text-[#EAE6DD] shadow-sm" type="button">
                <span className="text-xl font-body font-semibold tracking-tight leading-none">{k}</span>
              </button>
            ))}
            <button aria-label="Borrar dígito" onClick={() => setValue((v) => v.slice(0, -1))} className="touch-ripple h-14 rounded-lg bg-[#B45A3C]/10 border border-[#B45A3C]/30 flex items-center justify-center text-[#B45A3C] shadow-sm hover:bg-[#B45A3C]/20" type="button">
              <span className="material-symbols-outlined text-xl">backspace</span>
            </button>
            <button onClick={() => press("0")} className="touch-ripple h-14 rounded-lg bg-[#EAE6DD]/[0.05] border border-[#C9B89F]/20 flex flex-col items-center justify-center text-[#EAE6DD] shadow-sm" type="button">
              <span className="text-xl font-body font-semibold tracking-tight leading-none">0</span>
            </button>
            <button aria-label="Entrar" onClick={submit} className="touch-ripple h-14 rounded-lg bg-[#D4AF7C] border border-[#D4AF7C] flex items-center justify-center text-[#1E2F28] shadow-[0_2px_12px_rgba(212,175,124,0.35)] active:bg-[#c49f6c]" type="button">
              <span className="material-symbols-outlined text-2xl font-bold">arrow_forward</span>
            </button>
          </div>
        </section>
        <footer className="flex flex-col items-center text-center space-y-2 mt-auto pt-1">
          {mode === "pin" && (
            <span className="inline-flex items-center space-x-1.5 text-xs text-[#C9B89F] py-1 px-3">
              <span className="material-symbols-outlined text-sm">help_outline</span>
              <span className="underline underline-offset-4 decoration-[#C9B89F]/40 font-medium">¿Olvidaste tu PIN? Solicita desbloqueo al capitán</span>
            </span>
          )}
          <div className="flex items-center justify-center space-x-3 text-[10px] text-[#C9B89F]/50 tracking-wider">
            <span>CONVIVIUM</span><span>•</span>
            <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[11px]">verified_user</span>Sesión cifrada</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
