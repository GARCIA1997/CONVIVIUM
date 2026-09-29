/**
 * Carta impresa en PDF (diseño: design/stitch/menu-impreso.html).
 * Carta o media carta, una o dos columnas, título de sección con filete, línea punteada hasta
 * el precio y bloque de QR hacia el menú digital al pie.
 */
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { BADGES, type MenuView } from "./render.js";

const OLIVO = "#1E2F28", CARBON = "#1A1A1A", MUTED = "#6B6B6B", ARENA = "#C9B89F";
const PT = 72; // puntos por pulgada
const peso = (c: number) => (c % 100 ? (c / 100).toFixed(2) : String(c / 100));

export async function renderMenuPdf(view: MenuView, publicUrl: string | null): Promise<Buffer> {
  const { config } = view;
  const size: [number, number] = config.size === "carta" ? [8.5 * PT, 11 * PT] : [5.5 * PT, 8.5 * PT];
  const small = config.size === "media_carta";
  const margin = small ? 0.45 * PT : 0.6 * PT;
  const doc = new PDFDocument({ size, bufferPages: true, margins: { top: margin, bottom: margin, left: margin, right: margin }, info: { Title: `${config.title} · ${view.branchName}`, Author: "CONVIVIUM" } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((r) => doc.on("end", () => r(Buffer.concat(chunks))));

  const accent = /^#[0-9a-f]{6}$/i.test(config.accent) ? config.accent : "#D4AF7C";
  const serif = "Times-Roman", serifBold = "Times-Bold", sans = "Helvetica", sansBold = "Helvetica-Bold";
  const W = size[0], H = size[1];
  const footerH = publicUrl ? (small ? 70 : 90) : 40;

  const header = () => {
    const cx = W / 2;
    let y = margin;
    doc.circle(cx, y + 16, 16).lineWidth(1).strokeColor(accent).stroke();
    doc.font(serifBold).fontSize(18).fillColor(OLIVO).text("C", cx - 16, y + 6, { width: 32, align: "center" });
    y += 42;
    doc.font(serif).fontSize(small ? 18 : 24).fillColor(OLIVO).text(config.title.toUpperCase(), margin, y, { width: W - margin * 2, align: "center", characterSpacing: small ? 4 : 7 });
    y = doc.y + 2;
    if (config.subtitle) doc.font("Times-Italic").fontSize(small ? 9 : 11).fillColor(MUTED).text(config.subtitle, margin, y, { width: W - margin * 2, align: "center" });
    y = doc.y + 4;
    doc.moveTo(cx - 40, y).lineTo(cx + 40, y).lineWidth(0.6).strokeColor(accent).stroke();
    return y + (small ? 12 : 18);
  };

  const cols = config.columns;
  const gap = small ? 14 : 24;
  const colW = (W - margin * 2 - gap * (cols - 1)) / cols;
  let top = header();
  let col = 0;
  let y = top;
  const bottom = () => H - margin - footerH;
  const x = () => margin + col * (colW + gap);
  const next = (need: number) => {
    if (y + need <= bottom()) return;
    if (col < cols - 1) { col++; y = top; return; }
    doc.addPage(); top = margin; col = 0; y = top;
  };

  const nameSize = small ? 9.5 : 11, descSize = small ? 7.5 : 8.5, headSize = small ? 9 : 10.5;
  // El impreso no muestra agotados del día; una sección sin platillos disponibles no se imprime.
  for (const s of view.sections.map((x) => ({ ...x, items: x.items.filter((i) => !i.soldOut) })).filter((x) => x.items.length)) {
    next(headSize + nameSize * 3);
    doc.font(serifBold).fontSize(headSize).fillColor(OLIVO).text(s.name.toUpperCase(), x(), y, { width: colW, characterSpacing: 2 });
    y = doc.y + 2;
    doc.moveTo(x(), y).lineTo(x() + colW, y).lineWidth(0.5).strokeColor(ARENA).stroke();
    y += 6;
    for (const it of s.items) {
      const desc = it.description ? it.description : null;
      const descH = desc ? doc.font(sans).fontSize(descSize).heightOfString(desc, { width: colW - 4 }) : 0;
      next(nameSize + 4 + descH + 6);
      const price = peso(it.price);
      doc.font(sansBold).fontSize(nameSize);
      const priceW = doc.widthOfString(price);
      doc.font(serifBold).fontSize(nameSize);
      const tags = it.badges.filter((b) => b in BADGES).map((b) => (b === "picante" ? "(picante)" : b === "vegetariano" ? "(veg.)" : "")).filter(Boolean).join(" ");
      const label = tags ? `${it.name}  ${tags}` : it.name;
      const nameW = Math.min(doc.widthOfString(label), colW - priceW - 16);
      doc.fillColor(CARBON).text(label, x(), y, { width: colW - priceW - 12, lineBreak: false, ellipsis: true });
      // Línea punteada entre nombre y precio.
      const ly = y + nameSize * 0.8;
      doc.moveTo(x() + nameW + 4, ly).lineTo(x() + colW - priceW - 4, ly).dash(0.8, { space: 2 }).lineWidth(0.6).strokeColor(ARENA).stroke().undash();
      doc.font(sansBold).fontSize(nameSize).fillColor(OLIVO).text(price, x() + colW - priceW, y, { width: priceW, align: "right", lineBreak: false });
      y += nameSize + 3;
      if (desc) { doc.font(sans).fontSize(descSize).fillColor(MUTED).text(desc, x(), y, { width: colW - 4 }); y = doc.y; }
      y += small ? 5 : 7;
    }
    y += small ? 6 : 10;
  }

  // Pie con QR en cada página.
  const range = doc.bufferedPageRange();
  const qr = publicUrl ? await QRCode.toBuffer(publicUrl, { margin: 0, width: 240, color: { dark: OLIVO, light: "#FFFFFF" } }) : null;
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const fy = H - margin - footerH + 10;
    doc.moveTo(margin, fy).lineTo(W - margin, fy).lineWidth(0.5).strokeColor(ARENA).stroke();
    const q = small ? 46 : 60;
    if (qr) {
      doc.image(qr, margin, fy + 8, { width: q, height: q });
      doc.font(serifBold).fontSize(small ? 8 : 9.5).fillColor(OLIVO).text("Escanea para ver el menú digital", margin + q + 10, fy + 12, { width: 200 });
      doc.font(sans).fontSize(small ? 6.5 : 7.5).fillColor(MUTED).text(publicUrl!, margin + q + 10, doc.y + 1, { width: 220 });
    }
    const info = [config.address, config.phone && `Tel. ${config.phone}`, config.footer].filter(Boolean).join("\n");
    doc.font(sans).fontSize(small ? 6.5 : 7.5).fillColor(MUTED).text(info, W / 2, fy + 12, { width: W / 2 - margin, align: "right" });
  }
  doc.end();
  return done;
}
