import { describe, expect, it } from "vitest";
import { parseFileArrivalApproval, parseFileArrivalState } from "./file-arrival.js";

describe("file-arrival contracts", () => {
  it("accepts a bounded privacy-safe inbox state", () => {
    expect(parseFileArrivalState({
      configured: true,
      watchStatus: "active",
      folderLabel: "weekly-inputs",
      items: [{
        id: "a".repeat(32), fileName: "sales-2026-08.csv", detectedAt: "2026-08-01T00:00:00.000Z",
        status: "needs-review", candidates: [{ datasetId: "b".repeat(32), displayName: "Sales", reason: "source-name", confidence: "high" }],
      }],
    }).items).toHaveLength(1);
  });

  it("rejects paths and unbounded approvals", () => {
    expect(() => parseFileArrivalState({ configured: true, folderLabel: "x", folderPath: "/secret", items: [] })).toThrow();
    expect(() => parseFileArrivalApproval({ arrivalId: "a".repeat(32), datasetId: "not-an-id" })).toThrow();
  });
});
