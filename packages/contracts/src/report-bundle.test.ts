import { describe, expect, it } from "vitest";
import { parseReportBundleInput } from "./report-bundle.js";

describe("report bundle contract", () => {
  it("accepts deterministic facts, evidence tables and separated model narrative", () => {
    const parsed = parseReportBundleInput({ schemaVersion: 1, kind: "reconciliation", title: "August close", summary: "Reviewed local reconciliation", deterministicFacts: [{ label: "Difference", value: 0 }], tables: [{ name: "Exceptions", columns: ["Kind", "Count"], rows: [["Unmatched", 2]] }], quality: [], exceptions: ["Two unmatched rows"], limitations: ["Exact reviewed keys only"], lineage: [{ label: "Left version", value: "abc" }], runMetadata: [{ label: "Review", value: "one-use approval" }], modelNarrative: "Optional interpretation" });
    expect(parsed.modelNarrative).toBe("Optional interpretation");
  });

  it("rejects paths, arbitrary fields and mismatched rows", () => {
    const base = { schemaVersion: 1, kind: "clean", title: "Clean", summary: "Done", deterministicFacts: [], tables: [{ name: "Steps", columns: ["Step"], rows: [["one", "extra"]] }], quality: [], exceptions: [], limitations: [], lineage: [], runMetadata: [] };
    expect(() => parseReportBundleInput(base)).toThrow();
    expect(() => parseReportBundleInput({ ...base, tables: [{ name: "Steps", columns: ["Step"], rows: [["one"]] }], sourcePath: "/private" })).toThrow();
  });
});
