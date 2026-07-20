import { describe, expect, it } from "vitest";
import { dataCoreExecutableName, resolveRuntimePaths } from "./runtime-paths.js";

describe("native runtime paths", () => {
  it("uses the Windows executable suffix without changing the macOS name", () => {
    expect(dataCoreExecutableName("win32")).toBe("bubu-data-core.exe");
    expect(dataCoreExecutableName("darwin")).toBe("bubu-data-core");
  });

  it("resolves packaged Windows sidecars from resources", () => {
    expect(resolveRuntimePaths({ packaged: true, resourcesPath: "C:\\BuBu\\resources", appPath: "ignored", platform: "win32" })).toEqual({
      aiRuntime: "C:\\BuBu\\resources/dist/index.cjs",
      dataCore: "C:\\BuBu\\resources/bubu-data-core.exe",
    });
  });

  it("resolves development macOS sidecars from the repository", () => {
    const result = resolveRuntimePaths({ packaged: false, resourcesPath: "/Applications/BuBu.app/Contents/Resources", appPath: "/repo/apps/desktop", platform: "darwin" });
    expect(result.aiRuntime).toBe("/repo/services/ai-runtime/dist/index.cjs");
    expect(result.dataCore).toBe("/repo/services/data-core/bin/bubu-data-core");
  });
});
