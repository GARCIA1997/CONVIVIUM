/**
 * Menú digital público (se abre con el QR de la mesa). Página renderizada en el servidor, sin inicio de sesión.
 * Estructura y clases tomadas tal cual del diseño Stitch design/stitch/menu-digital-qr.html.
 * Las clases se compilan a CSS con `pnpm --filter @convivium/api menu-css` (ver menu-styles.ts); así el
 * celular del cliente no descarga Tailwind.
 * Marca blanca: colores, tipografías, logo y nombre son los del restaurante (view.brand); CONVIVIUM solo
 * aparece como "Powered by CONVIVIUM" al pie.
 */
import { branding } from "@convivium/contracts";
import { MENU_CSS } from "./menu-styles.js";
import type { MenuView } from "./render.js";

type Item = MenuView["sections"][number]["items"][number];

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const price = (c: number) => `$${(c / 100).toLocaleString("es-MX", { minimumFractionDigits: c % 100 ? 2 : 0 })}`;
/** Etiquetas del producto → claves de filtro del diseño (veg, spicy, nuevo). */
const TAG: Record<string, string> = { vegetariano: "veg", picante: "spicy", nuevo: "nuevo" };
const tags = (i: Item) => i.badges.map((b) => TAG[b]).filter(Boolean).join(" ");
/** "#1E2F28" → "30 47 40" para las variables rgb() del tema. */
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(" ");
/** Mezcla de dos colores hex (t = 0 → a, 1 → b). */
const mix = (a: string, b: string, t: number) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, "0")).join("");
/** Texto legible sobre un color: el fondo de la marca si contrasta, si no blanco o negro. */
const onColor = (c: string, bg: string) => (branding.contrastRatio(c, bg) >= 4.5 ? bg : branding.contrastRatio(c, "#FFFFFF") >= branding.contrastRatio(c, "#1A1A1A") ? "#FFFFFF" : "#1A1A1A");
function brandStyle(b: MenuView["brand"]) {
  const vars = { primary: b.primary, "on-primary": onColor(b.primary, b.background), accent: b.accent, "on-accent": onColor(b.accent, b.text), bg: b.background, text: b.text, muted: mix(b.background, b.text, 0.22) };
  return `:root{${Object.entries(vars).map(([k, v]) => `--brand-${k}:${rgb(v)}`).join(";")};--brand-font-heading:"${b.fontHeading}";--brand-font-body:"${b.fontBody}"}`;
}
const fontsHref = (b: MenuView["brand"]) => `https://fonts.googleapis.com/css2?${[...new Set([b.fontHeading, b.fontBody])].map((f) => `family=${f.replace(/ /g, "+")}:wght@400;500;600;700`).join("&")}&display=swap`;

const search = (i: Item) => esc(`${i.name} ${i.description ?? ""}`.toLowerCase());

/** Ícono de la categoría según su nombre (el diseño usa uno por categoría). */
function catIcon(name: string) {
  const n = name.toLowerCase();
  const map: [RegExp, string][] = [
    [/entrad|botan|antoj/, "tapas"], [/taco/, "lunch_dining"], [/fuert|plato|especial|carne|corte/, "soup_kitchen"],
    [/postre|dulce/, "cake"], [/coctel|c[oó]ctel|mezcal|tequila|destil|bar|cerve/, "local_bar"], [/vino|cava/, "wine_bar"],
    [/caf[eé]|bebida|agua|refresco/, "local_cafe"], [/desayun/, "egg_alt"], [/ensalad/, "eco"], [/sopa|caldo/, "ramen_dining"],
  ];
  return map.find(([re]) => re.test(n))?.[1] ?? "restaurant";
}

const chip = (i: Item) => [
  i.badges.includes("vegetariano") && `<span class="px-1.5 py-0.5 rounded bg-green-100 text-green-800 text-[9px] font-medium tracking-tight">Vegetariano</span>`,
  i.badges.includes("picante") && `<span class="px-1.5 py-0.5 rounded bg-terracota/15 text-terracota text-[9px] font-bold flex items-center gap-0.5"><span class="material-symbols-outlined text-[12px]">local_fire_department</span> Picante</span>`,
  i.badges.includes("nuevo") && `<span class="px-1.5 py-0.5 rounded bg-dorado/30 text-carbon text-[9px] font-medium">Nuevo</span>`,
  i.badges.includes("recomendado") && `<span class="px-1.5 py-0.5 rounded bg-primary text-dorado text-[9px] font-medium">Recomendado</span>`,
].filter(Boolean).join("");

function itemCard(i: Item) {
  if (i.soldOut) return `
<article class="menu-item-card rounded-2xl bg-arena/20 p-3.5 shadow-none opacity-60 relative overflow-hidden" data-name="${search(i)}" data-tags="">
<div class="flex items-start justify-between gap-3">
<div class="space-y-1 flex-1">
<div class="flex items-center gap-2 flex-wrap">
<h4 class="font-headline font-semibold text-sm text-carbon/80 line-through">${esc(i.name)}</h4>
<span class="px-2 py-0.5 rounded-full bg-terracota text-white text-[9px] font-bold uppercase tracking-wider">Agotado hoy</span>
</div>
${i.description ? `<p class="text-xs text-carbon/60 font-body leading-relaxed">${esc(i.description)}</p>` : ""}
</div>
<div class="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-arena/40 grayscale flex items-center justify-center">
<span class="material-symbols-outlined text-carbon/40 text-[26px]">block</span>
</div>
</div>
<div class="flex items-center justify-between text-xs pt-1">
<span class="font-medium text-carbon/50 line-through">${price(i.price)} MXN</span>
<span class="text-[11px] text-terracota/80 font-medium">Pregunta a tu mesero por disponibilidad</span>
</div>
</article>`;
  return `
<article class="menu-item-card rounded-2xl bg-white/80 p-3.5 shadow-sm space-y-2.5" data-name="${search(i)}" data-tags="${tags(i)}">
<div class="flex items-start justify-between gap-3">
<div class="space-y-1 flex-1">
<div class="flex items-center gap-1.5 flex-wrap">
<h4 class="font-headline font-semibold text-sm text-carbon">${esc(i.name)}</h4>
${chip(i)}
</div>
${i.description ? `<p class="text-xs text-carbon/75 font-body leading-relaxed">${esc(i.description)}</p>` : ""}
</div>
${i.photoUrl ? `<div class="w-16 h-16 rounded-xl overflow-hidden shrink-0 shadow-inner bg-arena/20"><img class="w-full h-full object-cover" src="${esc(i.photoUrl)}" alt="" loading="lazy"/></div>` : ""}
</div>
<div class="flex items-center justify-between text-xs pt-1">
<span class="font-semibold text-primary font-body">${price(i.price)} MXN</span>
</div>
</article>`;
}

function featuredCard(i: Item) {
  return `
<article class="menu-item-card snap-start shrink-0 w-[265px] rounded-2xl bg-white/85 p-3 shadow-md flex flex-col justify-between space-y-3" data-name="${search(i)}" data-tags="${tags(i)}">
<div class="relative w-full h-36 rounded-xl overflow-hidden bg-arena/20 flex items-center justify-center">
${i.photoUrl ? `<img alt="${esc(i.name)}" class="w-full h-full object-cover" src="${esc(i.photoUrl)}" loading="lazy"/>` : `<span class="material-symbols-outlined text-primary/40 text-[40px]">restaurant</span>`}
<div class="absolute top-2 left-2 flex flex-col gap-1">
<span class="px-2 py-0.5 rounded-md bg-primary/90 text-dorado text-[9px] font-semibold tracking-wider uppercase backdrop-blur-xs">Recomendado</span>
${i.badges.includes("nuevo") ? `<span class="px-2 py-0.5 rounded-md bg-dorado text-carbon text-[9px] font-bold tracking-wider uppercase">Nuevo</span>` : ""}
</div>
</div>
<div class="space-y-1">
<h4 class="font-headline font-bold text-sm text-carbon leading-snug">${esc(i.name)}</h4>
${i.description ? `<p class="text-[11px] text-carbon/70 font-body line-clamp-2">${esc(i.description)}</p>` : ""}
</div>
<div class="flex items-center justify-between pt-1 border-none">
<span class="text-sm font-semibold font-body text-primary tracking-tight">${price(i.price)} <span class="text-[10px] font-normal text-carbon/60">MXN</span></span>
${i.badges.includes("picante") ? `<span class="text-[11px] text-terracota font-medium flex items-center gap-0.5"><span class="material-symbols-outlined text-[13px]">local_fire_department</span> Toque picante</span>` : ""}
</div>
</article>`;
}

const CAT_OFF = "menu-cat-btn flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-arena/30 text-carbon font-normal text-xs whitespace-nowrap shadow-sm hover:bg-arena/50 transition-all";
const CAT_ON = "menu-cat-btn flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-dorado font-medium text-xs whitespace-nowrap shadow-sm transition-all";

export function renderPublicMenu(view: MenuView): string {
  const { config: c, brand } = view;
  const title = brand.name;
  const logo = brand.logoUrl ? `<img src="${esc(brand.logoUrl)}" alt="${esc(title)}" class="w-full h-full object-cover"/>` : "";
  const time = new Date(view.updatedAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Mexico_City" });
  const wa = c.whatsapp.replace(/\D/g, "").slice(-10);
  const branch = /^sucursal\b/i.test(view.branchName) ? view.branchName : `Sucursal ${view.branchName}`;
  const all = view.sections.flatMap((s) => s.items);
  const featured = all.filter((i) => i.badges.includes("recomendado") && !i.soldOut).slice(0, 6);
  const present = (["vegetariano", "picante", "nuevo"] as const).filter((b) => all.some((i) => i.badges.includes(b)));
  const FILTER = {
    vegetariano: `<span class="material-symbols-outlined text-[15px] text-green-700">spa</span><span>Vegetariano</span>`,
    picante: `<span class="material-symbols-outlined text-[15px] text-terracota">local_fire_department</span><span>Picante</span>`,
    nuevo: `<span class="material-symbols-outlined text-[15px] text-amber-600">star</span><span>Nuevo</span>`,
  };

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"/><meta content="width=device-width, initial-scale=1.0, viewport-fit=cover" name="viewport"/>
<title>${esc(title)} · ${esc(view.branchName)} · Menú</title>
<meta name="description" content="Menú de ${esc(title)} ${esc(view.branchName)}"><meta name="theme-color" content="${brand.background}">
<link href="https://fonts.googleapis.com" rel="preconnect"/><link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect"/>
<link href="${esc(fontsHref(brand))}" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<style>${brandStyle(brand)}${MENU_CSS}</style></head>
<body class="bg-surface font-body text-carbon flex flex-col min-h-screen">
<header class="fixed top-0 w-full z-50 bg-surface/90 backdrop-blur-xl pt-safe shadow-[0_1px_8px_rgba(0,0,0,0.04)]"><div class="h-20 px-4 flex items-center gap-3">${logo ? `<div class="w-11 h-11 rounded-full overflow-hidden shrink-0 bg-white shadow-sm">${logo}</div>` : ""}<div class="flex flex-col justify-center min-w-0"><h1 class="font-headline text-lg font-bold tracking-[0.2em] uppercase text-primary leading-tight truncate">${esc(title)}</h1><p class="text-[10px] tracking-wide text-carbon/75 font-body mt-0.5 truncate">${[brand.slogan, branch].filter(Boolean).map(esc).join(" · ")}</p></div></div></header>
<main class="flex flex-col relative w-full pt-20 pb-28 bg-surface px-4"><div class="flex flex-col w-full space-y-6 pb-6">

<section class="rounded-2xl bg-primary text-on-primary p-4 shadow-md relative overflow-hidden">
<div class="absolute -right-6 -bottom-6 w-24 h-24 bg-dorado/10 rounded-full blur-xl pointer-events-none"></div>
<div class="flex items-center justify-between relative z-10">
<div class="space-y-1">
<div class="flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-dorado animate-pulse"></span><span class="text-[10px] tracking-[0.25em] font-medium text-dorado uppercase font-body">Menú Digital · Solo Consulta</span></div>
<h2 class="font-headline text-xl font-bold tracking-[0.15em] text-on-primary">${esc(title.toUpperCase())}</h2>
<p class="text-xs text-on-primary/80 font-body flex items-center gap-1.5"><span class="material-symbols-outlined text-[14px] text-dorado">location_on</span><span>${esc(branch)}${c.address ? ` · ${esc(c.address)}` : ""}</span></p>
</div>
${logo ? `<div class="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-white shadow-inner">${logo}</div>` : `<div class="w-11 h-11 rounded-xl bg-surface/10 flex items-center justify-center text-dorado shadow-inner backdrop-blur-sm"><span class="material-symbols-outlined text-[24px]">restaurant</span></div>`}
</div>
</section>

<div class="relative w-full">
<span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-carbon/50 text-[20px] pointer-events-none">search</span>
<input class="w-full pl-10 pr-10 py-3 bg-white/70 focus:bg-white text-carbon text-xs rounded-xl shadow-sm placeholder:text-carbon/40 transition-all outline-none" id="menu-search-input" placeholder="Buscar platillo, ingrediente o bebida..." type="search" autocomplete="off"/>
<button class="hidden absolute right-3.5 top-1/2 -translate-y-1/2 text-carbon/40 hover:text-carbon" id="clear-search" type="button" aria-label="Borrar búsqueda"><span class="material-symbols-outlined text-[18px]">cancel</span></button>
</div>

<div class="sticky top-20 z-30 -mx-4 px-4 py-2 bg-surface/95 backdrop-blur-md transition-all">
<div class="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1">
<button class="${CAT_ON}" data-target="cat-todos" type="button"><span class="material-symbols-outlined text-[16px]">menu_book</span><span>Todos</span></button>
${view.sections.map((s) => `<button class="${CAT_OFF}" data-target="cat-${s.id}" type="button"><span class="material-symbols-outlined text-[16px]">${catIcon(s.name)}</span><span>${esc(s.name)}</span></button>`).join("\n")}
</div>
</div>

${c.showPromos ? view.promos.map((p) => `
<div class="relative rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-on-primary p-4 shadow-md overflow-hidden">
<div class="absolute -right-8 -top-8 w-28 h-28 bg-dorado/15 rounded-full blur-2xl pointer-events-none"></div>
<div class="flex items-start gap-3.5 relative z-10">
<div class="w-10 h-10 rounded-xl bg-dorado/20 text-dorado flex items-center justify-center shrink-0 mt-0.5"><span class="material-symbols-outlined text-[22px]">local_offer</span></div>
<div class="space-y-1">
<div class="flex items-center gap-2"><span class="px-2 py-0.5 rounded-full bg-dorado text-primary font-bold text-[9px] uppercase tracking-wider">Hoy</span><span class="text-dorado text-xs font-semibold tracking-wide">${esc(p.detail)}</span></div>
<h3 class="font-headline font-semibold text-sm leading-snug text-on-primary">${esc(p.name)}</h3>
</div>
</div>
</div>`).join("") : ""}

${present.length ? `<div class="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
${present.map((b) => `<button class="diet-filter-chip flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/70 text-carbon text-xs shadow-sm hover:bg-white transition-colors" data-tag="${TAG[b]}" type="button">${FILTER[b]}</button>`).join("\n")}
</div>` : ""}

${featured.length ? `<section class="space-y-3 pt-1" id="recomendados">
<div class="flex items-baseline justify-between">
<div><h2 class="font-headline font-bold text-lg text-primary tracking-wide">Recomendados de la casa</h2><p class="text-xs text-carbon/70 font-body">Nuestros favoritos para disfrutar en la mesa</p></div>
<span class="text-[10px] font-semibold text-dorado uppercase tracking-widest bg-primary px-2 py-0.5 rounded-full">Top ${featured.length}</span>
</div>
<div class="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth pb-2 pt-1 -mx-4 px-4 snap-x snap-mandatory">${featured.map(featuredCard).join("")}</div>
</section>` : ""}

<div class="space-y-8" id="full-menu-sections">
${view.sections.map((s) => `
<section class="menu-section space-y-3 scroll-mt-36" id="cat-${s.id}">
<div class="flex items-center justify-between pb-1">
<div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-primary"></span><h3 class="font-headline font-bold text-base text-primary uppercase tracking-wider">${esc(s.name)}</h3></div>
<span class="text-[11px] text-carbon/50 font-body">${s.items.length} ${s.items.length === 1 ? "selección" : "selecciones"}</span>
</div>
<div class="space-y-3">${s.items.map(itemCard).join("")}</div>
</section>`).join("") || `<p class="text-center text-xs text-carbon/60 py-10">El menú se está actualizando.</p>`}
</div>

<div class="hidden text-center py-10 px-4 space-y-3" id="no-results">
<div class="w-12 h-12 rounded-full bg-arena/30 flex items-center justify-center mx-auto text-carbon/60"><span class="material-symbols-outlined text-[24px]">search_off</span></div>
<h4 class="font-headline font-semibold text-sm text-carbon">Sin platillos coincidentes</h4>
<p class="text-xs text-carbon/60 max-w-xs mx-auto">No encontramos platillos con ese nombre o ingrediente. Revisa la ortografía o explora las categorías.</p>
</div>

<footer class="mt-8 pt-8 space-y-4 text-center rounded-2xl bg-white/40 p-6 shadow-sm">
<div class="flex flex-col items-center justify-center space-y-1">
${logo ? `<div class="w-12 h-12 rounded-full overflow-hidden bg-white shadow-xs">${logo}</div>` : `<div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-dorado font-headline text-sm font-bold shadow-xs">${esc(title.charAt(0).toUpperCase())}</div>`}
<h3 class="font-headline font-bold text-sm tracking-[0.2em] text-primary">${esc(title.toUpperCase())}</h3>
${brand.slogan ? `<p class="text-[10px] text-carbon/60 tracking-wider uppercase">${esc(brand.slogan)}</p>` : ""}
</div>
<div class="space-y-1 text-xs text-carbon/75 font-body">
${c.address ? `<p class="font-medium text-carbon">${esc(c.address)}</p>` : ""}
${c.phone ? `<p>Reservaciones y dudas: <span class="text-primary font-semibold select-all">${esc(c.phone)}</span></p>` : ""}
</div>
<div class="pt-2 space-y-1 text-[11px] text-carbon/60 font-body">
<p>Precios en MXN, IVA incluido${c.footer ? ` · ${esc(c.footer)}` : ""}</p>
<p>Carta digital actualizada hoy a las ${time} hrs</p>
</div>
</footer>
<p class="text-center text-[10px] tracking-wider text-carbon/45 font-body pt-2">Powered by <span class="font-semibold tracking-[0.2em]">CONVIVIUM</span></p>
</div></main>
${wa ? `<a class="fixed bottom-6 right-4 z-40 flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-primary/95 text-dorado text-xs font-medium shadow-[0_4px_16px_rgba(30,47,40,0.25)] backdrop-blur-md transition-transform active:scale-95 pb-safe" href="https://wa.me/52${wa}" rel="noopener noreferrer" target="_blank"><span class="material-symbols-outlined text-[18px]">chat</span><span>Dudas por WhatsApp</span></a>` : ""}
<script>
(function () {
  var input = document.getElementById("menu-search-input"), clear = document.getElementById("clear-search");
  var cards = document.querySelectorAll(".menu-item-card"), cats = document.querySelectorAll(".menu-cat-btn");
  var chips = document.querySelectorAll(".diet-filter-chip"), none = document.getElementById("no-results");
  var featured = document.getElementById("recomendados"), diet = null;
  var ON = ${JSON.stringify(CAT_ON)}, OFF = ${JSON.stringify(CAT_OFF)};
  function filter() {
    var term = input.value.trim().toLowerCase(), n = 0;
    clear.classList.toggle("hidden", !term);
    cards.forEach(function (c) {
      var ok = (!term || c.dataset.name.indexOf(term) >= 0) && (!diet || (" " + c.dataset.tags + " ").indexOf(" " + diet + " ") >= 0);
      c.classList.toggle("hidden", !ok); if (ok) n++;
    });
    document.querySelectorAll(".menu-section").forEach(function (s) { s.classList.toggle("hidden", !s.querySelector(".menu-item-card:not(.hidden)")); });
    if (featured) featured.classList.toggle("hidden", !featured.querySelector(".menu-item-card:not(.hidden)"));
    none.classList.toggle("hidden", n > 0);
  }
  input.addEventListener("input", filter);
  clear.addEventListener("click", function () { input.value = ""; filter(); input.focus(); });
  cats.forEach(function (b) {
    b.addEventListener("click", function () {
      cats.forEach(function (x) { x.className = OFF; }); b.className = ON;
      var el = b.dataset.target === "cat-todos" ? document.body : document.getElementById(b.dataset.target);
      if (b.dataset.target === "cat-todos") window.scrollTo({ top: 0, behavior: "smooth" }); else if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      var t = chip.dataset.tag;
      chips.forEach(function (c) { c.classList.remove("bg-primary", "text-dorado"); c.classList.add("bg-white/70", "text-carbon"); });
      if (diet === t) diet = null; else { diet = t; chip.classList.add("bg-primary", "text-dorado"); chip.classList.remove("bg-white/70", "text-carbon"); }
      filter();
    });
  });
})();
</script>
</body></html>`;
}
