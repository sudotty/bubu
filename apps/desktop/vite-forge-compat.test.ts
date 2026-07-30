import { describe, expect, it } from "vitest";
import { migrateForgePreloadOutput } from "./vite-forge-compat.js";

describe("Electron Forge Vite 8 compatibility", () => {
  it("migrates Forge's single-file preload option without changing its behavior", () => {
    const output = {
      format: "cjs",
      inlineDynamicImports: true,
    };

    migrateForgePreloadOutput(output);

    expect(output).toEqual({
      format: "cjs",
      codeSplitting: false,
    });
  });

  it("leaves a future Forge output unchanged once the deprecated option disappears", () => {
    const output = {
      codeSplitting: false,
    };

    migrateForgePreloadOutput(output);

    expect(output).toEqual({
      codeSplitting: false,
    });
  });
});
