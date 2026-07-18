import { describe, expect, it } from "vitest";
import config from "./vite.renderer.config.js";

describe("desktop renderer development security", () => {
  it("keeps Vite HMR disabled so React does not require an inline refresh preamble", () => {
    expect(config.server?.hmr).toBe(false);
  });
});
