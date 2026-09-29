/**
 * Convierte el <body> de una pantalla de Stitch en un componente React (TSX) con el
 * mismo marcado y las mismas clases. Punto de partida para conectar datos reales.
 * Uso: node scripts/stitch-to-jsx.mjs <pantalla> <salida.tsx> <NombreComponente>
 */
import { parse } from "node-html-parser";
import { readFileSync, writeFileSync } from "node:fs";

const [, , screen, out, name] = process.argv;
const html = readFileSync(`design/stitch/${screen}.html`, "utf8");
const body = parse(html, { comment: true }).querySelector("body");

const ATTR = { class: "className", for: "htmlFor", tabindex: "tabIndex", readonly: "readOnly", maxlength: "maxLength", autocomplete: "autoComplete", colspan: "colSpan", rowspan: "rowSpan", viewbox: "viewBox", "stroke-width": "strokeWidth", "stroke-linecap": "strokeLinecap", "stroke-linejoin": "strokeLinejoin", "fill-rule": "fillRule", "clip-rule": "clipRule", "stroke-dasharray": "strokeDasharray", "stroke-dashoffset": "strokeDashoffset", srcset: "srcSet", crossorigin: "crossOrigin", inputmode: "inputMode", enterkeyhint: "enterKeyHint", datetime: "dateTime", novalidate: "noValidate", autofocus: "autoFocus", "xlink:href": "xlinkHref" };
Object.assign(ATTR, { preserveaspectratio: "preserveAspectRatio", "stop-color": "stopColor", "stop-opacity": "stopOpacity", "fill-opacity": "fillOpacity", "stroke-opacity": "strokeOpacity", gradientunits: "gradientUnits", gradienttransform: "gradientTransform", "text-anchor": "textAnchor", "dominant-baseline": "dominantBaseline", "font-size": "fontSize", "font-weight": "fontWeight", "font-family": "fontFamily" });
const SVG_TAGS = { lineargradient: "linearGradient", radialgradient: "radialGradient", clippath: "clipPath", foreignobject: "foreignObject", textpath: "textPath" };
const NUMERIC = new Set(["rows", "cols", "colSpan", "rowSpan", "tabIndex", "maxLength", "span", "size"]);
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const BOOL = new Set(["checked", "disabled", "selected", "readonly", "required", "multiple", "hidden", "autofocus", "novalidate", "open"]);

const esc = (t) => t.replace(/[{}]/g, (c) => `{"${c}"}`).replace(/</g, "&lt;").replace(/>/g, "&gt;");
const camel = (p) => p.trim().replace(/^-(webkit|moz|ms)-/, (_, v) => `${v[0].toUpperCase()}${v.slice(1)}-`).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const styleObj = (s) =>
  `{{ ${s.split(";").filter((d) => d.includes(":")).map((d) => {
    const i = d.indexOf(":");
    return `${JSON.stringify(camel(d.slice(0, i)))}: ${JSON.stringify(d.slice(i + 1).trim())}`;
  }).join(", ")} }}`;

function attrs(el) {
  return Object.entries(el.rawAttributes).map(([k, v]) => {
    const key = k.toLowerCase();
    if (key.startsWith("on")) return ""; // manejadores inline de la maqueta: se reemplazan por React
    if (key === "style") return ` style=${styleObj(v)}`;
    const name = ATTR[key] ?? k;
    if (BOOL.has(key)) return v === "" || v === key ? ` ${name}` : ` ${name}={${v !== "false"}}`;
    if (key === "value" && el.tagName === "INPUT") return ` defaultValue=${JSON.stringify(v)}`;
    if (key === "checked") return ` defaultChecked`;
    if (NUMERIC.has(name) && /^-?\d+$/.test(v)) return ` ${name}={${v}}`;
    return ` ${name}=${JSON.stringify(v)}`;
  }).join("");
}

function jsx(node, depth) {
  const pad = "  ".repeat(depth);
  if (node.nodeType === 8) return `${pad}{/* ${node.rawText.trim().replace(/\*\//g, "")} */}`;
  if (node.nodeType === 3) {
    const t = node.rawText.replace(/\s+/g, " ");
    return t.trim() ? `${pad}${esc(t.trim())}` : "";
  }
  const lower = node.rawTagName.toLowerCase();
  const tag = SVG_TAGS[lower] ?? lower;
  if (lower === "script" || lower === "style") return "";
  const kids = node.childNodes.map((c) => jsx(c, depth + 1)).filter(Boolean);
  if (VOID.has(lower) || !kids.length) return `${pad}<${tag}${attrs(node)} />`;
  return `${pad}<${tag}${attrs(node)}>\n${kids.join("\n")}\n${pad}</${tag}>`;
}

const root = `<div className=${JSON.stringify(body.getAttribute("class") ?? "")}>\n${body.childNodes.map((c) => jsx(c, 3)).filter(Boolean).join("\n")}\n    </div>`;
writeFileSync(out, `/* Generado desde design/stitch/${screen}.html (Stitch). Marcado y clases originales. */
export function ${name}() {
  return (
    ${root}
  );
}
`);
console.log(`${screen} → ${out}`);
