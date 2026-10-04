/**
 * Clave corta de sucursal para folios (OC-CEN-0001). Misma regla que la migración 0020:
 * se quita "Sucursal", acentos y símbolos, se toman 3 caracteres y, si ya existe, se numera (CEN2, CEN3…).
 */
export const BRANCH_CODE_RE = /^[A-Z0-9]{2,6}$/;

export function branchCode(name: string, taken: Iterable<string> = []) {
  const base =
    name
      .replace(/^\s*sucursal\s+/i, "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(0, 3)
      .toUpperCase() || "SUC";
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}${n}`)) return `${base}${n}`;
}
