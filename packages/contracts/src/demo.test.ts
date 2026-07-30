import { describe, expect, it } from "vitest";
import { parseDemoWorkspaceId, parseDemoWorkspaceImportResult } from "./demo.js";

describe("demo workspace contracts", () => {
  it("accepts only the bundled demo identity", () => {
    expect(parseDemoWorkspaceId("retail-operations")).toBe("retail-operations");
    expect(parseDemoWorkspaceId("merge-exports")).toBe("merge-exports");
    expect(() => parseDemoWorkspaceId("../../private")).toThrow();
  });

  it("rejects incomplete demo results", () => {
    expect(() => parseDemoWorkspaceImportResult({ demoId: "retail-operations", datasets: [], group: {} })).toThrow();
  });
});
