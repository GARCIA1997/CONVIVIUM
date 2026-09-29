/**
 * Constructor mínimo de tickets ESC/POS (impresoras térmicas 80 mm, 48 columnas).
 * Texto en CP858 aproximado: se eliminan acentos para máxima compatibilidad.
 */
const ESC = 0x1b;
const GS = 0x1d;

export class Ticket {
  private chunks: number[] = [ESC, 0x40]; // inicializar

  private push(...bytes: number[]) { this.chunks.push(...bytes); return this; }
  text(s: string) {
    const ascii = s.replace(/·/g, "-").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e\n]/g, "?");
    for (const ch of ascii) this.chunks.push(ch.charCodeAt(0));
    return this;
  }
  line(s = "") { return this.text(s + "\n"); }
  bold(on: boolean) { return this.push(ESC, 0x45, on ? 1 : 0); }
  size(double: boolean) { return this.push(GS, 0x21, double ? 0x11 : 0x00); }
  align(a: "left" | "center" | "right") { return this.push(ESC, 0x61, a === "left" ? 0 : a === "center" ? 1 : 2); }
  rule() { return this.line("-".repeat(48)); }
  cut() { return this.push(ESC, 0x64, 4, GS, 0x56, 0x42, 0x00); }
  buffer() { return Buffer.from(this.chunks); }
}
