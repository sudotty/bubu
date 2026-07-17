import { describe, expect, it } from "vitest";
import { parseColumnDistribution } from "./distribution.js";

const base = {
  localOnly: true,
  datasetId: "a".repeat(32),
  versionId: "b".repeat(32),
  column: "Amount",
  inferredType: "real",
  nonNullCount: 2,
} as const;

describe("local column distribution", () => {
  it("accepts a bounded numeric histogram", () => {
    const value = {
      kind: "numeric",
      ...base,
      minimum: 10,
      maximum: 20,
      mean: 15,
      bins: [{ minimum: 10, maximum: 20, count: 2, rate: 1 }],
    } as const;
    expect(parseColumnDistribution(value)).toEqual(value);
  });

  it("requires the local-only marker and bounded previews", () => {
    const value = {
      kind: "categorical",
      ...base,
      inferredType: "text",
      values: [{ preview: "North", truncated: false, count: 2, rate: 1 }],
      otherCount: 0,
    } as const;
    expect(parseColumnDistribution(value)).toEqual(value);
    expect(() => parseColumnDistribution({ ...value, localOnly: false })).toThrow();
    expect(() => parseColumnDistribution({ ...value, values: [{ ...value.values[0], preview: "x".repeat(121) }] })).toThrow();
  });
});
