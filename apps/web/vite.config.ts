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
        name: "Productivity",
        short_name: "Productivity",
        description: "Notes, tasks, calendar and reminders in one place",
        theme_color: "#0b0f14",
        background_color: "#0b0f14",
        display: "standalone",
        // Used on laptops as well as phones, so no forced orientation.
        orientation: "any",
        start_url: "/",
        scope: "/",
        // SVG with sizes "any" installs in Chromium. Add 192/512 PNGs before
        // shipping, for Safari and older browsers.
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml" },
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
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
