import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Demonstração estática (GitHub Pages): VITE_DEMO=1 e VITE_BASE=/<repositório>/.
const demo = process.env.VITE_DEMO === "1";

export default defineConfig({
  root: "client",
  base: process.env.VITE_BASE || "/",
  plugins: [
    react(),
    tailwindcss(),
    // A demonstração não deve aparecer no Google (o site oficial é o publicado).
    demo && {
      name: "demo-noindex",
      transformIndexHtml: (html: string) => html.replace("<!--app-head-->", '<meta name="robots" content="noindex, nofollow" />'),
    },
  ],
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
