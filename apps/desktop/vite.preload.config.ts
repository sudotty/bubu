import { defineConfig } from "vite";
import { forgePreloadVite8Compat } from "./vite-forge-compat.js";

export default defineConfig({
  plugins: [forgePreloadVite8Compat()],
  build: {
    sourcemap: true,
  },
});
