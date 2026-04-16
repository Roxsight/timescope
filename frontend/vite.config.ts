import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || "/",
  server: {
    port: 5173,
    proxy: {
      // Proxy API calls to Spring Boot in dev
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      // Proxy launcher calls in dev
      "/launcher": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/launcher/, ""),
      },
    },
  },
  build: {
    outDir: "dist",
  },
});