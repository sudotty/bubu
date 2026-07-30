import { describe, expect, it } from "vitest";
import { canonicalJson } from "./canonical-json.js";

describe("canonicalJson", () => {
  it("sorts keys recursively without changing array order", () => {
    expect(canonicalJson({ z: [{ b: 2, a: 1 }], a: true })).toBe('{"a":true,"z":[{"a":1,"b":2}]}');
  });

  it("rejects non-JSON and cyclic values", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => canonicalJson(cyclic)).toThrow("cycles");
    expect(() => canonicalJson(Number.NaN)).toThrow("finite");
    expect(() => canonicalJson(undefined)).toThrow("JSON-compatible");
  });
});
