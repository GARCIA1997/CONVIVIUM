// Tema del diseño Stitch del menú digital (design/stitch/menu-digital-qr.html). Los colores y fuentes son
// variables CSS que public-page.ts llena con la identidad del restaurante (marca blanca).
const v = (name) => `rgb(var(--brand-${name}) / <alpha-value>)`;
module.exports = {
  content: ["./src/modules/menus/public-page.ts"],
  theme: { extend: {
    colors: {
      primary: v("primary"), "on-primary": v("on-primary"), background: v("bg"), "on-background": v("text"), surface: v("bg"), "on-surface": v("text"),
      "surface-variant": v("muted"), "on-surface-variant": v("primary"), arena: v("muted"), terracota: "#B45A3C", "on-terracota": "#EAE6DD",
      dorado: v("accent"), "on-dorado": v("on-accent"), carbon: v("text"),
    },
    fontFamily: { headline: ["var(--brand-font-heading)", "serif"], body: ["var(--brand-font-body)", "sans-serif"] },
  } },
};
