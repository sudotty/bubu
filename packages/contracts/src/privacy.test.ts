import { describe, expect, it } from "vitest";
import { modelDisclosureLevelSchema, parseModelContext, parsePrivacyPolicy, parsePrivacyTextInspection } from "./privacy.js";

const base = {
  datasetId: "a".repeat(32),
  versionId: "b".repeat(32),
  columns: [{ name: "Revenue", type: "real", nullable: false, unique: false }],
};

describe("model disclosure boundary", () => {
  it("keeps aggregate and explicit-row vocabulary outside model context construction", () => {
    expect(modelDisclosureLevelSchema.options).toEqual([
      "schema-only", "schema-synthetic", "aggregates", "explicit-rows",
    ]);
    expect(() => parseModelContext({
      ...base,
      disclosure: "aggregates",
      syntheticRows: [],
    })).toThrow();
  });

  it("accepts bounded synthetic examples and no source metadata", () => {
    const value = {
      ...base,
      disclosure: "schema-synthetic",
      syntheticRows: [[10.25], [20.25], [30.25]],
    } as const;
    expect(parseModelContext(value)).toEqual(value);
    expect(() => parseModelContext({ ...value, sourceName: "private.csv" })).toThrow();
    expect(() => parseModelContext({ ...value, sourcePath: "/private/private.csv" })).toThrow();
  });

  it("forbids examples at schema-only disclosure and mismatched row widths", () => {
    expect(() =>
      parseModelContext({ ...base, disclosure: "schema-only", syntheticRows: [[10.25]] }),
    ).toThrow("schema-only");
    expect(() =>
      parseModelContext({
        ...base,
        disclosure: "schema-synthetic",
        syntheticRows: [[10.25, "extra"]],
      }),
    ).toThrow("width");
  });
});

describe("strict privacy policy boundary", () => {
  it("accepts only a versioned policy with non-bypassable local DLP", () => {
    expect(parsePrivacyPolicy({ schemaVersion: 1, mode: "strict-private", localDlpEnabled: true })).toEqual({ schemaVersion: 1, mode: "strict-private", localDlpEnabled: true });
    expect(() => parsePrivacyPolicy({ schemaVersion: 1, mode: "strict-private", localDlpEnabled: false })).toThrow();
    expect(() => parsePrivacyPolicy({ schemaVersion: 1, mode: "strict-private", localDlpEnabled: true, allowRows: true })).toThrow();
  });

  it("never returns detected content through the DLP boundary", () => {
    expect(parsePrivacyTextInspection({ decision: "block", findings: [{ kind: "credential", severity: "high", label: "疑似访问密钥" }] })).toEqual({ decision: "block", findings: [{ kind: "credential", severity: "high", label: "疑似访问密钥" }] });
    expect(() => parsePrivacyTextInspection({ decision: "block", findings: [{ kind: "credential", severity: "high", label: "疑似访问密钥", value: "secret" }] })).toThrow();
  });
});
