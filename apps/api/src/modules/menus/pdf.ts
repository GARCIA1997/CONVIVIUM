/**
 * Carta impresa en PDF (diseño: design/stitch/menu-impreso.html).
 * Carta o media carta, una o dos columnas, título de sección con filete, línea punteada hasta
 * el precio y bloque de QR hacia el menú digital al pie.
 * Marca blanca: logo, nombre, eslogan y colores del restaurante (view.brand); al pie "Powered by CONVIVIUM".
 * Las tipografías de la marca no se incrustan: se usan Times/Helvetica, que imprimen igual en cualquier equipo.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import { mediaDir } from "../../plugins/media.js";
import QRCode from "qrcode";
import { BADGES, type MenuView } from "./render.js";

const MUTED = "#6B6B6B", ARENA = "#C9B89F";
const PT = 72; // puntos por pulgada
const peso = (c: number) => (c % 100 ? (c / 100).toFixed(2) : String(c / 100));

export async function renderMenuPdf(view: MenuView, publicUrl: string | null): Promise<Buffer> {
  const { config, brand } = view;
  const OLIVO = brand.primary, CARBON = brand.text, accent = brand.accent;
  // Logo propio (PNG/JPG; pdfkit no lee WebP).
  const logo = brand.logoUrl?.startsWith("/media/") && /\.(png|jpe?g)$/i.test(brand.logoUrl) ? await readFile(join(mediaDir, brand.logoUrl.slice(7))).catch(() => null) : null;
  const size: [number, number] = config.size === "carta" ? [8.5 * PT, 11 * PT] : [5.5 * PT, 8.5 * PT];
  const small = config.size === "media_carta";
  const margin = small ? 0.45 * PT : 0.6 * PT;
  const doc = new PDFDocument({ size, bufferPages: true, margins: { top: margin, bottom: margin, left: margin, right: margin }, info: { Title: `${brand.name} · ${view.branchName}`, Author: brand.name, Producer: "CONVIVIUM" } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((r) => doc.on("end", () => r(Buffer.concat(chunks))));

  const serif = "Times-Roman", serifBold = "Times-Bold", sans = "Helvetica", sansBold = "Helvetica-Bold";
  const W = size[0], H = size[1];
  const footerH = publicUrl ? (small ? 70 : 90) : 40;

  const header = () => {
    const cx = W / 2;
    let y = margin;
    if (logo) {
      const L = small ? 40 : 52;
      doc.image(logo, cx - L / 2, y, { fit: [L, L], align: "center", valign: "center" });
      y += L + 8;
    } else {
      doc.circle(cx, y + 16, 16).lineWidth(1).strokeColor(accent).stroke();
      doc.font(serifBold).fontSize(18).fillColor(OLIVO).text(brand.name.charAt(0).toUpperCase(), cx - 16, y + 6, { width: 32, align: "center" });
      y += 42;
    }
    doc.font(serif).fontSize(small ? 18 : 24).fillColor(OLIVO).text(brand.name.toUpperCase(), margin, y, { width: W - margin * 2, align: "center", characterSpacing: small ? 4 : 7 });
    y = doc.y + 2;
    if (brand.slogan) doc.font("Times-Italic").fontSize(small ? 9 : 11).fillColor(MUTED).text(brand.slogan, margin, y, { width: W - margin * 2, align: "center" });
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
  const tagsOf = (it: (typeof view.sections)[number]["items"][number]) => it.badges.filter((b) => b in BADGES).map((b) => (b === "picante" ? "(picante)" : b === "vegetariano" ? "(veg.)" : "")).filter(Boolean).join(" ");
  /** Alto que ocupa un platillo (nombre que puede bajar de renglón + descripción). */
  const itemHeight = (it: (typeof view.sections)[number]["items"][number]) => {
    doc.font(sansBold).fontSize(nameSize);
    const labelW = colW - doc.widthOfString(peso(it.price)) - 12;
    const label = tagsOf(it) ? `${it.name}  ${tagsOf(it)}` : it.name;
    const labelH = doc.font(serifBold).fontSize(nameSize).heightOfString(label, { width: labelW });
    const descH = it.description ? doc.font(sans).fontSize(descSize).heightOfString(it.description, { width: colW - 4 }) : 0;
    return labelH + 4 + descH + 6;
  };
  for (const s of view.sections.map((x) => ({ ...x, items: x.items.filter((i) => !i.soldOut) })).filter((x) => x.items.length)) {
    // El título nunca queda solo al final de una columna: reserva también su primer platillo.
    next(headSize + 12 + itemHeight(s.items[0]!));
    doc.font(serifBold).fontSize(headSize).fillColor(OLIVO).text(s.name.toUpperCase(), x(), y, { width: colW, characterSpacing: 2 });
    y = doc.y + 2;
    doc.moveTo(x(), y).lineTo(x() + colW, y).lineWidth(0.5).strokeColor(ARENA).stroke();
    y += 6;
    for (const it of s.items) {
      const desc = it.description ? it.description : null;
      const descH = desc ? doc.font(sans).fontSize(descSize).heightOfString(desc, { width: colW - 4 }) : 0;
      const price = peso(it.price);
      doc.font(sansBold).fontSize(nameSize);
      const priceW = doc.widthOfString(price);
      doc.font(serifBold).fontSize(nameSize);
      const tags = tagsOf(it);
      const label = tags ? `${it.name}  ${tags}` : it.name;
      const labelW = colW - priceW - 12;
      // Nombres largos bajan de renglón (y empujan la descripción) en lugar de encimarse.
      const labelH = doc.heightOfString(label, { width: labelW });
      const wrapped = labelH > nameSize * 1.6;
      next(labelH + 4 + descH + 6);
      doc.font(serifBold).fontSize(nameSize).fillColor(CARBON).text(label, x(), y, { width: labelW });
      if (!wrapped) {
        // Línea punteada entre nombre y precio.
        const nameW = Math.min(doc.widthOfString(label), colW - priceW - 16);
        const ly = y + nameSize * 0.8;
        doc.moveTo(x() + nameW + 4, ly).lineTo(x() + colW - priceW - 4, ly).dash(0.8, { space: 2 }).lineWidth(0.6).strokeColor(ARENA).stroke().undash();
      }
      doc.font(sansBold).fontSize(nameSize).fillColor(OLIVO).text(price, x() + colW - priceW, y, { width: priceW, align: "right", lineBreak: false });
      y += labelH + 3;
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
    doc.font(sans).fontSize(small ? 5.5 : 6.5).fillColor(ARENA).text("Powered by CONVIVIUM", margin, H - margin - 8, { width: W - margin * 2, align: "center", characterSpacing: 1, lineBreak: false });
  }
  doc.end();
  return done;
}
