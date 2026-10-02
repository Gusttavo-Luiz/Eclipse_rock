import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  root: "client",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
    sourcemap: false,
    target: "es2020",
  },
  server: {
    port: 5173,
    // changeOrigin: false mantém o Host original (localhost:5173), que a proteção CSRF compara com o Origin.
    proxy: Object.fromEntries(
      ["/api", "/uploads", "/sitemap.xml", "/robots.txt"].map((p) => [p, { target: "http://localhost:3001", changeOrigin: false }]),
    ),
  },
});
