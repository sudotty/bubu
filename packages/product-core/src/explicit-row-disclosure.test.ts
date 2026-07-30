import { describe, expect, it } from "vitest";
import { explicitRowDisclosureFacts } from "./explicit-row-disclosure.js";

describe("explicit row disclosure product policy", () => {
  it("derives exact human-review facts without inspecting cell content", () => {
    const facts = explicitRowDisclosureFacts({
      schemaVersion: 1,
      selection: { schemaVersion: 1, datasetId: "a".repeat(32), versionId: "b".repeat(32), purpose: "review", rowNumbers: [2, 7], columns: ["Order ID", "Amount"] },
      columnTypes: ["text", "real"], rows: [{ rowNumber: 2, cells: ["secret", "10"] }, { rowNumber: 7, cells: ["other", null] }],
      cellCount: 4, payloadBytes: 200, payloadSha256: "c".repeat(64),
    });
    expect(facts).toEqual({ rowCount: 2, columnCount: 2, cellCount: 4, payloadBytes: 200, rowNumbers: [2, 7], columns: ["Order ID", "Amount"], fingerprintPrefix: "cccccccccccccccc" });
    expect(JSON.stringify(facts)).not.toContain("secret");
  });
});
