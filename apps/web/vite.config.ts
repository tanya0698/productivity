import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

const env = loadEnv("development", process.cwd(), "");

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Creedence",
        short_name: "Creedence",
        description: "Tasks, notes, calendar, habits and goals in one place. The digital engine behind your growth.",
        theme_color: "#0b0f14",
        background_color: "#0b0f14",
        display: "standalone",
        // Used on laptops as well as phones, so no forced orientation.
        orientation: "any",
        start_url: "/",
        scope: "/",
        // From Experimental/logos/creedence-icon.png. Full-bleed, so it also works masked.
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      // Web push: the push and notification-click handlers (public/push-sw.js).
      workbox: { importScripts: ["push-sw.js"] },
      devOptions: { enabled: true },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  build: {
    rollupOptions: {
      output: {
        // Keep React and antd in their own cached chunks.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router)/.test(id)) return "react";
          if (/[\\/]node_modules[\\/](antd|@ant-design|rc-[^\\/]+|@rc-component)[\\/]/.test(id)) return "antd";
          return undefined;
        },
      },
    },
  },
  server: {
    // Every module's API lives in the one NestJS app under /api (apps/api).
    proxy: {
      "/api": {
        target: env.VITE_API_PROXY_TARGET || "http://localhost:3000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
