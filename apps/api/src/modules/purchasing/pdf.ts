/**
 * Orden de compra en PDF (E8-02) para enviar al proveedor.
 * Marca blanca como la carta impresa: logo, nombre y colores del restaurante; al pie "Powered by CONVIVIUM".
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { branding } from "@convivium/contracts";
import PDFDocument from "pdfkit";
import { mediaDir } from "../../plugins/media.js";

export interface PurchaseOrderPdf {
  folio: string;
  createdAt: string;
  expectedAt: string | null;
  branchName: string;
  tenantRfc: string | null;
  supplier: { name: string; rfc: string | null; contactName: string | null; phone: string | null; email: string | null };
  lines: { name: string; purchaseUnit: string; quantity: number; unitPrice: number; amount: number }[];
  total: number;
}

const MUTED = "#6B6B6B", RULE = "#D9CFC0";
const money = (c: number) => `$${(c / 100).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const qty = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 3 });
const date = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });

export async function renderPurchaseOrderPdf(po: PurchaseOrderPdf, brand: branding.Branding): Promise<Buffer> {
  const logo = brand.logoUrl?.startsWith("/media/") && /\.(png|jpe?g)$/i.test(brand.logoUrl) ? await readFile(join(mediaDir, brand.logoUrl.slice(7))).catch(() => null) : null;
  const M = 50;
  const doc = new PDFDocument({ size: "LETTER", bufferPages: true, margins: { top: M, bottom: M, left: M, right: M }, info: { Title: `Orden de compra ${po.folio}`, Author: brand.name, Producer: "CONVIVIUM" } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((r) => doc.on("end", () => r(Buffer.concat(chunks))));
  const W = doc.page.width, H = doc.page.height, inner = W - M * 2;

  // Encabezado: marca a la izquierda, folio a la derecha.
  let x = M;
  if (logo) { doc.image(logo, M, M, { fit: [48, 48] }); x = M + 60; }
  doc.font("Helvetica-Bold").fontSize(16).fillColor(brand.primary).text(brand.name, x, M + 4, { width: inner / 2 });
  doc.font("Helvetica").fontSize(9).fillColor(MUTED).text([po.branchName, po.tenantRfc ? `RFC ${po.tenantRfc}` : ""].filter(Boolean).join(" · "), x, doc.y + 2, { width: inner / 2 });
  doc.font("Helvetica-Bold").fontSize(18).fillColor(brand.text).text("ORDEN DE COMPRA", M, M, { width: inner, align: "right" });
  doc.font("Helvetica").fontSize(10).fillColor(brand.accent).text(po.folio, M, doc.y + 2, { width: inner, align: "right" });
  doc.fillColor(MUTED).fontSize(9).text(`Fecha: ${date(po.createdAt)}`, M, doc.y + 2, { width: inner, align: "right" });
  let y = M + 70;
  doc.moveTo(M, y).lineTo(W - M, y).lineWidth(1).strokeColor(brand.primary).stroke();

  // Proveedor y entrega.
  y += 14;
  const s = po.supplier;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text("PROVEEDOR", M, y);
  doc.font("Helvetica-Bold").fontSize(11).fillColor(brand.text).text(s.name, M, y + 12, { width: inner * 0.6 });
  doc.font("Helvetica").fontSize(9).fillColor(MUTED).text([s.rfc && `RFC ${s.rfc}`, s.contactName, s.phone, s.email].filter(Boolean).join("\n"), M, doc.y + 2, { width: inner * 0.6 });
  const leftBottom = doc.y;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text("ENTREGA", M + inner * 0.65, y, { width: inner * 0.35 });
  doc.font("Helvetica").fontSize(10).fillColor(brand.text).text(po.expectedAt ? date(po.expectedAt) : "A convenir", M + inner * 0.65, y + 12, { width: inner * 0.35 });
  doc.fontSize(9).fillColor(MUTED).text(po.branchName, M + inner * 0.65, doc.y + 2, { width: inner * 0.35 });
  y = Math.max(leftBottom, doc.y) + 20;

  // Tabla de partidas.
  const cols = [
    { t: "CANT.", w: 0.1, a: "right" as const },
    { t: "UNIDAD", w: 0.14, a: "left" as const },
    { t: "INSUMO", w: 0.44, a: "left" as const },
    { t: "P. UNIT.", w: 0.15, a: "right" as const },
    { t: "IMPORTE", w: 0.17, a: "right" as const },
  ];
  const row = (cells: string[], yy: number, font: string, color: string) => {
    let cx = M;
    cols.forEach((c, i) => {
      doc.font(font).fontSize(9).fillColor(color).text(cells[i]!, cx + 4, yy, { width: inner * c.w - 8, align: c.a });
      cx += inner * c.w;
    });
  };
  const head = (yy: number) => {
    doc.rect(M, yy - 5, inner, 20).fill(brand.primary);
    row(cols.map((c) => c.t), yy, "Helvetica-Bold", brand.background);
    return yy + 22;
  };
  y = head(y);
  for (const l of po.lines) {
    const h = Math.max(doc.font("Helvetica").fontSize(9).heightOfString(l.name, { width: inner * 0.44 - 8 }), 11) + 8;
    if (y + h > H - M - 80) { doc.addPage(); y = head(M); }
    row([qty(l.quantity), l.purchaseUnit, l.name, money(l.unitPrice), money(l.amount)], y, "Helvetica", brand.text);
    y += h;
    doc.moveTo(M, y - 4).lineTo(W - M, y - 4).lineWidth(0.5).strokeColor(RULE).stroke();
  }

  // Total.
  if (y + 60 > H - M - 30) { doc.addPage(); y = M; }
  y += 6;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(brand.text).text("TOTAL", M + inner * 0.55, y, { width: inner * 0.2, align: "right" });
  doc.fillColor(brand.primary).text(`${money(po.total)} MXN`, M + inner * 0.75, y, { width: inner * 0.25 - 4, align: "right" });
  doc.font("Helvetica").fontSize(8).fillColor(MUTED).text("Precios estimados según el último precio registrado; la factura del proveedor es la referencia final.", M, y + 24, { width: inner });

  // Pie en cada página.
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0; // el pie va dentro del margen inferior sin abrir otra página
    doc.font("Helvetica").fontSize(7).fillColor(MUTED).text(`${po.folio} · página ${i + 1} de ${range.count}   ·   Powered by CONVIVIUM`, M, H - M + 10, { width: inner, align: "center", lineBreak: false });
  }
  doc.end();
  return done;
}
