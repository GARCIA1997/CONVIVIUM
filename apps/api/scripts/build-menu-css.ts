/** Compila las clases del menú digital (public-page.ts) a CSS y lo guarda en menu-styles.ts. */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const out = "/tmp/convivium-menu.css";
execFileSync("npx", ["tailwindcss", "-c", "scripts/menu-tailwind.config.cjs", "-i", "scripts/menu-input.css", "-o", out, "--minify"], { stdio: "inherit" });
const css = readFileSync(out, "utf8");
writeFileSync("src/modules/menus/menu-styles.ts", `// Generado por scripts/build-menu-css.ts (pnpm menu-css). No editar a mano.\nexport const MENU_CSS = ${JSON.stringify(css)};\n`);
console.log(`menu-styles.ts: ${css.length} bytes`);
