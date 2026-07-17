import { builtinModules } from "node:module";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "node22",
    sourcemap: true,
    minify: false,
    lib: {
      entry: "src/index.ts",
      formats: ["cjs"],
      fileName: () => "index.cjs",
    },
    rollupOptions: {
      external: builtinModules.flatMap((moduleName) => [moduleName, `node:${moduleName}`]),
    },
  },
});
