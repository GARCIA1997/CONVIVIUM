import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Cada app es una PWA independiente. En producción el nodo local / la nube la sirve bajo /mesero/.
export default defineConfig({
  base: process.env.NODE_ENV === "production" ? "/mesero/" : "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "CONVIVIUM · Mesero",
        short_name: "Mesero",
        lang: "es-MX",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#1E2F28",
        background_color: "#EAE6DD",
      },
    }),
  ],
  server: { proxy: { "/v1": { target: "http://localhost:4000", ws: true } } },
});
