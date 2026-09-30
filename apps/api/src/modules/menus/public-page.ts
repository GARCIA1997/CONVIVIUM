/**
 * Menú digital público (se abre con el QR de la mesa). Página ligera renderizada en el servidor:
 * carga al instante en cualquier celular, sin JavaScript de la app ni inicio de sesión.
 * Paleta, tipografía y estructura del diseño Stitch design/stitch/menu-digital-publico.html.
 */
import { BADGES, type MenuView } from "./render.js";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const price = (c: number) => `$${(c / 100).toLocaleString("es-MX", { minimumFractionDigits: c % 100 ? 2 : 0 })}`;
const BADGE_CLS: Record<string, string> = { nuevo: "b-nuevo", picante: "b-picante", vegetariano: "b-veg", recomendado: "b-rec" };

export function renderPublicMenu(view: MenuView): string {
  const { config: c } = view;
  const accent = /^#[0-9a-f]{6}$/i.test(c.accent) ? c.accent : "#D4AF7C";
  const time = new Date(view.updatedAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" });
  const wa = c.whatsapp.replace(/\D/g, "");
  const present = (["vegetariano", "picante", "nuevo"] as const).filter((b) => view.sections.some((s) => s.items.some((i) => i.badges.includes(b))));
  const filters = present.length ? `<div class="filters"><span>Filtros:</span>${present.map((b) => `<button type="button" data-f="${b}">${BADGES[b]}</button>`).join("")}</div>` : "";
  const sections = view.sections.map((s) => `
    <section id="c-${s.id}">
      <h2>${esc(s.name)}</h2>
      ${s.items.map((i) => `
      <article class="dish${i.soldOut ? " out" : ""}" data-b="${i.badges.join(" ")}">
        ${i.photoUrl ? `<img src="${esc(i.photoUrl)}" alt="" loading="lazy">` : ""}
        <div class="body">
          <div class="row"><h3>${esc(i.name)}</h3><span class="price">${price(i.price)}</span></div>
          ${i.description ? `<p>${esc(i.description)}</p>` : ""}
          <div class="badges">${i.soldOut ? `<span class="b b-out">Agotado hoy</span>` : ""}${i.badges.filter((b) => b in BADGES).map((b) => `<span class="b ${BADGE_CLS[b]}">${BADGES[b as keyof typeof BADGES]}</span>`).join("")}</div>
        </div>
      </article>`).join("")}
    </section>`).join("");
  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.title)} · ${esc(view.branchName)} · Menú</title>
<meta name="description" content="Menú de ${esc(c.title)} ${esc(view.branchName)}">
<meta name="theme-color" content="#1E2F28">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root { --olivo:#1E2F28; --marfil:#EAE6DD; --fondo:#F7F5F0; --arena:#C9B89F; --terracota:#B45A3C; --carbon:#1A1A1A; --dorado:${accent}; }
  * { box-sizing:border-box; margin:0; padding:0 }
  body { font-family:Inter,system-ui,sans-serif; background:var(--fondo); color:var(--carbon); -webkit-font-smoothing:antialiased }
  header { background:var(--olivo); color:var(--marfil); text-align:center; padding:28px 16px 22px }
  .mono { width:44px; height:44px; border-radius:50%; border:1px solid var(--dorado); display:inline-flex; align-items:center; justify-content:center; font-family:'Playfair Display',serif; font-weight:700; color:var(--dorado); font-size:22px }
  header h1 { font-family:'Playfair Display',serif; font-weight:500; letter-spacing:.28em; font-size:22px; margin-top:10px; color:#F3E9D2 }
  header .branch { font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:var(--arena); margin-top:4px }
  header .tag { font-family:'Playfair Display',serif; font-style:italic; font-size:13px; color:var(--arena); margin-top:8px; opacity:.9 }
  nav { position:sticky; top:0; z-index:5; background:rgba(247,245,240,.96); backdrop-filter:blur(6px); border-bottom:1px solid rgba(201,184,159,.5); display:flex; gap:8px; overflow-x:auto; padding:10px 16px; scrollbar-width:none }
  nav::-webkit-scrollbar { display:none }
  nav a { flex:none; text-decoration:none; font-size:13px; font-weight:500; color:var(--olivo); border:1px solid var(--arena); border-radius:999px; padding:6px 14px; background:#fff }
  main { max-width:640px; margin:0 auto; padding:8px 16px 32px }
  .promo { margin:14px 0 4px; background:linear-gradient(90deg, color-mix(in srgb, var(--dorado) 22%, #fff), #fff); border:1px solid var(--dorado); border-radius:10px; padding:12px 14px }
  .promo strong { font-family:'Playfair Display',serif; color:var(--olivo); font-size:15px; display:block }
  .promo span { font-size:12px; color:#5b5b5b }
  section { padding-top:18px; scroll-margin-top:56px }
  h2 { font-family:'Playfair Display',serif; font-weight:700; color:var(--olivo); font-size:20px; padding-bottom:6px; border-bottom:1px solid var(--arena); margin-bottom:4px }
  .dish { display:flex; gap:12px; padding:12px 0; border-bottom:1px solid rgba(201,184,159,.35) }
  .dish img { width:64px; height:64px; border-radius:8px; object-fit:cover; flex:none }
  .dish .body { flex:1; min-width:0 }
  .row { display:flex; justify-content:space-between; gap:12px; align-items:baseline }
  h3 { font-family:'Playfair Display',serif; font-weight:500; font-size:16px; color:var(--carbon) }
  .price { font-weight:600; color:var(--olivo); white-space:nowrap }
  .dish p { font-size:13px; line-height:1.4; color:#6b6b6b; margin-top:3px }
  .badges { display:flex; flex-wrap:wrap; gap:6px; margin-top:6px }
  .badges:empty { display:none }
  .b { font-size:10.5px; font-weight:600; letter-spacing:.02em; border-radius:999px; padding:2px 8px; border:1px solid }
  .b-nuevo { color:#1E2F28; background:color-mix(in srgb, var(--dorado) 25%, #fff); border-color:var(--dorado) }
  .b-picante { color:var(--terracota); background:#F8ECE8; border-color:#E5C2B6 }
  .b-veg { color:#2F6B45; background:#ECF6EF; border-color:#BFDDC8 }
  .b-rec { color:#fff; background:var(--olivo); border-color:var(--olivo) }
  .b-out { color:var(--terracota); background:#fff; border-color:var(--terracota) }
  .out { opacity:.5 } .out .price { text-decoration:line-through }
  .filters { display:flex; gap:8px; align-items:center; overflow-x:auto; padding:12px 0 2px; font-size:12px; color:#6b6b6b; scrollbar-width:none }
  .filters button { flex:none; font:inherit; font-weight:500; color:var(--olivo); background:#fff; border:1px solid var(--arena); border-radius:999px; padding:5px 12px; cursor:pointer }
  .filters button.on { background:var(--olivo); color:var(--dorado); border-color:var(--olivo) }
  .hide { display:none }
  .help { margin:26px 0 0; background:#fff; border:1px solid var(--arena); border-radius:12px; padding:16px; text-align:center }
  .help strong { font-family:'Playfair Display',serif; color:var(--olivo); font-size:16px; display:block }
  .help p { font-size:13px; color:#6b6b6b; margin-top:4px }
  .legal { font-size:11px; color:#8a8a8a }
  footer { text-align:center; padding:26px 16px 40px; font-size:12px; color:#6b6b6b; line-height:1.7 }
  .wa { display:inline-block; margin:10px 0; background:var(--olivo); color:var(--dorado); text-decoration:none; font-weight:600; border-radius:10px; padding:10px 18px }
</style></head>
<body>
<header>
  <span class="mono">${esc(c.title.charAt(0) || "C")}</span>
  <h1>${esc(c.title.toUpperCase())}</h1>
  <div class="branch">${esc(view.branchName)}</div>
  ${c.subtitle ? `<div class="tag">${esc(c.subtitle)}</div>` : ""}
</header>
<nav>${view.sections.map((s) => `<a href="#c-${s.id}">${esc(s.name)}</a>`).join("")}</nav>
<main>
  ${c.showPromos ? view.promos.map((p) => `<div class="promo"><strong>${esc(p.name)}</strong><span>${esc(p.detail)}</span></div>`).join("") : ""}
  ${filters}
  ${sections || `<p style="padding:40px 0;text-align:center;color:#6b6b6b">El menú se está actualizando.</p>`}
  ${wa ? `<div class="help"><strong>¿Tienes alguna duda sobre la carta?</strong><p>Escríbenos y con gusto te ayudamos.</p><a class="wa" href="https://wa.me/52${wa.slice(-10)}">Asistencia por WhatsApp</a></div>` : ""}
</main>
<footer>
  ${c.footer ? `<div>${esc(c.footer)}</div>` : ""}
  ${c.address ? `<div>${esc(c.address)}</div>` : ""}
  ${c.phone ? `<div>Tel. ${esc(c.phone)}</div>` : ""}
  <div class="legal">Precios en MXN, IVA incluido</div>
  <div class="legal">Carta sincronizada hoy a las ${time}</div>
</footer>
${filters ? `<script>
  // Filtros por etiqueta: muestra solo los platillos que tengan todas las elegidas.
  const on = new Set();
  document.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => {
    const f = b.dataset.f; on.has(f) ? on.delete(f) : on.add(f); b.classList.toggle("on");
    document.querySelectorAll(".dish").forEach((d) => { const bs = d.dataset.b.split(" "); d.classList.toggle("hide", [...on].some((x) => !bs.includes(x))); });
    document.querySelectorAll("main section").forEach((s) => s.classList.toggle("hide", !s.querySelector(".dish:not(.hide)")));
  }));
</script>` : ""}
</body></html>`;
}
