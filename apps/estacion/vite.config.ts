import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Cada app es una PWA independiente. En producción el nodo local / la nube la sirve bajo /estacion/.
export default defineConfig({
  base: process.env.NODE_ENV === "production" ? "/estacion/" : "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "CONVIVIUM · Estación",
        short_name: "Estación",
        lang: "es-MX",
        display: "standalone",
        orientation: "landscape",
        theme_color: "#1E2F28",
        background_color: "#1A1A1A",
      },
    }),
  ],
  server: { proxy: { "/v1": { target: "http://localhost:4000", ws: true } } },
});
