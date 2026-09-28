/** Todas las apps comparten el preset generado de Stitch. */
/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("@convivium/ui/tailwind.preset.cjs")],
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}", "../../packages/app-shell/src/**/*.{ts,tsx}"],
};
