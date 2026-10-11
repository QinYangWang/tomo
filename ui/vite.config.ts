import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The SPA builds to ui/dist, which the Bun server serves. `vite` (dev) proxies the API to a running Tomo.
const target = process.env.TOMO_URL ?? "http://localhost:8787";
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
  server: { proxy: { "/api": target, "/ws": { target: target.replace(/^http/, "ws"), ws: true } } },
});
