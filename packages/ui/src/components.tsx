import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

export function Button({ variant = "primary", className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  return <button className={`cv-btn cv-btn--${variant} ${className}`} {...rest} />;
}

export function Card({ children, style, onClick }: { children: ReactNode; style?: CSSProperties; onClick?: () => void }) {
  return <div className="cv-card" style={style} onClick={onClick}>{children}</div>;
}

export function Badge({ children, color = "var(--accent)", text = "var(--c-carbon)" }: { children: ReactNode; color?: string; text?: string }) {
  return <span className="cv-badge" style={{ background: color, color: text }}>{children}</span>;
}

/** Monograma CONVIVIUM: C con copa. */
export function Monogram({ size = 40, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label="CONVIVIUM" role="img">
      <path d="M50 16a24 24 0 1 0 0 32" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" />
      <path d="M20 26h26" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <path d="M31 26v22M36 26v22M31 48h12" stroke={color} strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Wordmark({ color = "currentColor", tagline = true }: { color?: string; tagline?: boolean }) {
  return (
    <div style={{ textAlign: "center", color }}>
      <Monogram size={56} color={color} />
      <div style={{ fontFamily: "var(--font-display)", fontSize: 28, letterSpacing: ".22em", marginTop: 8 }}>CONVIVIUM</div>
      {tagline && <div className="cv-label" style={{ color: "var(--c-dorado)", marginTop: 6 }}>Donde todo sucede en la mesa.</div>}
    </div>
  );
}

export function Money({ cents }: { cents: number }) {
  return <>{new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100)}</>;
}

/** Teclado de PIN (E1-03). */
export function PinPad({ length = 4, value, onChange, onSubmit }: { length?: number; value: string; onChange: (v: string) => void; onSubmit: () => void }) {
  const press = (k: string) => {
    if (k === "⌫") return onChange(value.slice(0, -1));
    if (k === "✓") return onSubmit();
    if (value.length < length) onChange(value + k);
  };
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"];
  return (
    <div>
      <div style={{ display: "flex", gap: 16, justifyContent: "center", margin: "16px 0 24px" }}>
        {Array.from({ length }, (_, i) => (
          <span key={i} style={{ width: 16, height: 16, borderRadius: 8, border: "1.5px solid var(--c-dorado)", background: i < value.length ? "var(--c-dorado)" : "transparent" }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, maxWidth: 300, margin: "0 auto" }}>
        {keys.map((k) => (
          <button key={k} onClick={() => press(k)} className="cv-btn" style={{ height: 64, fontSize: 24, background: k === "✓" ? "var(--c-dorado)" : "rgba(234,230,221,.08)", color: k === "✓" ? "var(--c-carbon)" : "var(--c-marfil)", border: "1px solid rgba(212,175,124,.3)" }}>
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Colores de estado de mesa (E3-01). */
export const tableStatusStyle: Record<string, { bg: string; fg: string; label: string }> = {
  libre: { bg: "var(--surface)", fg: "var(--text)", label: "Libre" },
  ocupada: { bg: "var(--c-olivo)", fg: "var(--c-marfil)", label: "Ocupada" },
  listo_por_entregar: { bg: "var(--c-dorado)", fg: "var(--c-carbon)", label: "Listo por entregar" },
  pidio_cuenta: { bg: "var(--c-terracota)", fg: "var(--c-marfil)", label: "Pidió cuenta" },
};

export const semaforoColor = { verde: "var(--c-verde-ok)", amarillo: "var(--c-ambar)", rojo: "var(--c-terracota)" } as const;
