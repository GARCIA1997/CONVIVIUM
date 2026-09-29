/**
 * Unifica los tokens de diseño de todas las pantallas exportadas de Stitch (design/stitch/*.html)
 * en un solo preset de Tailwind: packages/ui/tailwind.preset.cjs
 *
 * Regla de conflictos: los colores base de la marca usan el valor oficial del branding;
 * las variantes toman el valor más frecuente entre pantallas.
 * Uso: node scripts/stitch-tokens.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const BRAND = { olivo: "#1E2F28", marfil: "#EAE6DD", arena: "#C9B89F", terracota: "#B45A3C", carbon: "#1A1A1A", dorado: "#D4AF7C" };
const DIR = "design/stitch";

const counts = {};
const keyframes = {};
const animation = {};
const flat = (o, p = "") =>
  Object.entries(o).flatMap(([k, v]) => {
    const key = k === "DEFAULT" ? p : p ? `${p}-${k}` : k;
    return v && typeof v === "object" && !Array.isArray(v) ? flat(v, key) : [[key, v]];
  });

for (const f of readdirSync(DIR).filter((f) => f.endsWith(".html"))) {
  const html = readFileSync(`${DIR}/${f}`, "utf8");
  const m = html.match(/tailwind\.config\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/);
  if (!m) continue;
  const cfg = new Function(`return (${m[1]})`)();
  const ext = cfg.theme?.extend ?? {};
  for (const [k, v] of flat(ext.colors ?? {})) {
    const hex = String(v).toUpperCase();
    ((counts[k] ??= {})[hex] ??= 0);
    counts[k][hex]++;
  }
  Object.assign(keyframes, ext.keyframes ?? {});
  Object.assign(animation, ext.animation ?? {});
}

/** Luminancia relativa aproximada de un color hex. */
const lum = (hex) => {
  const h = hex.replace("#", "").padEnd(6, "0");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const LIGHT = /(soft|light|subtle|bg|pale|lighter)$/i;
const DARK = /(dark|deep|darker)$/i;

const colors = {};
for (const [token, options] of Object.entries(counts).sort()) {
  const base = token.replace(/^(brand|convivium)-/, "");
  const values = Object.keys(options);
  // El nombre del token manda cuando las pantallas no coinciden: "soft/light" = el más claro, "dark" = el más oscuro.
  if (BRAND[base]) colors[token] = BRAND[base];
  else if (values.length > 1 && LIGHT.test(token)) colors[token] = values.sort((a, b) => lum(b) - lum(a))[0];
  else if (values.length > 1 && DARK.test(token)) colors[token] = values.sort((a, b) => lum(a) - lum(b))[0];
  else colors[token] = Object.entries(options).sort((a, b) => b[1] - a[1])[0][0];
}
// Los tokens de marca siempre existen, aunque ninguna pantalla los declare.
for (const [k, v] of Object.entries(BRAND)) colors[k] = v;

const preset = `/* Generado por scripts/stitch-tokens.mjs a partir de design/stitch/*.html — no editar a mano. */
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  theme: {
    extend: {
      colors: ${JSON.stringify(colors, null, 8).replace(/\n}/, "\n      }")},
      fontFamily: {
        display: ['"Playfair Display"', "Georgia", "serif"],
        serif: ['"Playfair Display"', "Georgia", "serif"],
        headline: ['"Playfair Display"', "Georgia", "serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        label: ["Inter", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      borderRadius: { DEFAULT: "0.25rem", lg: "0.5rem", xl: "0.75rem", "2xl": "1rem", full: "9999px" },
      keyframes: ${JSON.stringify(keyframes, null, 8).replace(/\n}/, "\n      }")},
      animation: ${JSON.stringify(animation, null, 8).replace(/\n}/, "\n      }")},
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/container-queries")],
};
`;
writeFileSync("packages/ui/tailwind.preset.cjs", preset);
console.log(`${Object.keys(colors).length} colores, ${Object.keys(keyframes).length} keyframes → packages/ui/tailwind.preset.cjs`);

/* ---------- Estilos propios de las pantallas → packages/ui/src/convivium.css ---------- */
function rules(css) {
  const out = [];
  let depth = 0, start = 0, sel = "";
  for (let i = 0; i < css.length; i++) {
    if (css[i] === "{") { if (depth === 0) { sel = css.slice(start, i).trim(); start = i + 1; } depth++; }
    else if (css[i] === "}") { depth--; if (depth === 0) { out.push([sel, css.slice(start, i).trim()]); start = i + 1; } }
  }
  return out;
}
const norm = (s) => s.replace(/\s+/g, " ").trim();
const seen = {};
for (const f of readdirSync(DIR).filter((f) => f.endsWith(".html"))) {
  const html = readFileSync(`${DIR}/${f}`, "utf8");
  for (const [, raw] of html.matchAll(/<style>([\s\S]*?)<\/style>/g)) {
    const css = raw.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const [sel, body] of rules(css)) {
      // body/html son del lienzo de vista previa de Stitch, no del diseño.
      if (!sel || /^(body|html|\*)\b/.test(sel)) continue;
      const k = norm(sel);
      ((seen[k] ??= {})[norm(body)] ??= 0);
      seen[k][norm(body)]++;
    }
  }
}
const custom = Object.entries(seen)
  .map(([sel, bodies]) => {
    const body = Object.entries(bodies).sort((a, b) => b[1] - a[1])[0][0];
    return sel.startsWith("@") ? `${sel} { ${body} }` : `${sel} { ${body.replace(/;\s*/g, "; ").trim()} }`;
  })
  .join("\n");

writeFileSync("packages/ui/src/convivium.css", `/*
 * CONVIVIUM · hoja de estilos única del sistema de diseño.
 * Base: Tailwind + preset generado de Stitch (packages/ui/tailwind.preset.cjs).
 * La sección "Stitch" se genera con scripts/stitch-tokens.mjs — no editar a mano.
 */
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,400;1,600&family=Public+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700;800&display=swap");
@import url("https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap");

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html, body, #root { height: 100%; }
  body { -webkit-font-smoothing: antialiased; -webkit-tap-highlight-color: transparent; }
}

/* ===== Stitch (generado) ===== */
${custom}
`);
console.log(`${Object.keys(seen).length} reglas propias → packages/ui/src/convivium.css`);
