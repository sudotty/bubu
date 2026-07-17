import { describe, expect, it } from "vitest";
import { parseModelContext } from "./privacy.js";

const base = {
  datasetId: "a".repeat(32),
  versionId: "b".repeat(32),
  columns: [{ name: "Revenue", type: "real", nullable: false }],
};

describe("model disclosure boundary", () => {
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
