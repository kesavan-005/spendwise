import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/",

  plugins: [
    react(),

    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.png"],
      manifest: {
        name: "SpendWise",
        short_name: "SpendWise",
        theme_color: "#10b981",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/favicon.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "/favicon.png",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      }
    })
  ]
});
