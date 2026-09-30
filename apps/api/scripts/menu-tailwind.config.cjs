// Tema del diseño Stitch del menú digital (design/stitch/menu-digital-qr.html), copiado de su tailwind.config.
module.exports = {
  content: ["./src/modules/menus/public-page.ts"],
  theme: { extend: {
    colors: { primary: "#1E2F28", "on-primary": "#EAE6DD", background: "#EAE6DD", "on-background": "#1A1A1A", surface: "#EAE6DD", "on-surface": "#1A1A1A", "surface-variant": "#C9B89F", "on-surface-variant": "#1E2F28", arena: "#C9B89F", terracota: "#B45A3C", "on-terracota": "#EAE6DD", dorado: "#D4AF7C", "on-dorado": "#1A1A1A", carbon: "#1A1A1A" },
    fontFamily: { headline: ["Playfair Display", "serif"], body: ["Inter", "sans-serif"] },
  } },
};
