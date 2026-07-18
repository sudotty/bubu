import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    // React Fast Refresh injects an inline preamble that the desktop CSP must reject.
    // Electron reloads the renderer after rebuilds instead of weakening that policy.
    hmr: false,
  },
  build: {
    sourcemap: true,
  },
});
