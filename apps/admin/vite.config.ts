import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Cada app es una PWA independiente. En producción el nodo local / la nube la sirve bajo /admin/.
export default defineConfig({
  base: process.env.NODE_ENV === "production" ? "/admin/" : "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "CONVIVIUM · Administración",
        short_name: "Administración",
        lang: "es-MX",
        display: "standalone",
        orientation: "any",
        theme_color: "#1E2F28",
        background_color: "#EAE6DD",
      },
    }),
  ],
  server: { proxy: { "/v1": { target: "http://localhost:4000", ws: true } } },
});
