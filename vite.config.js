import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/spendwise/", // ✅ IMPORTANT for GitHub Pages repo name

  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png"],
      manifest: {
        name: "SpendWise",
        short_name: "SpendWise",
        description: "Track your daily expenses with reports and graphs",
        theme_color: "#10b981",
        background_color: "#0b1220",
        display: "standalone",

        // ✅ IMPORTANT for GitHub Pages repo name
        start_url: "/spendwise/",
        scope: "/spendwise/",

        icons: [
          {
            src: "/spendwise/pwa-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/spendwise/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/spendwise/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
});
