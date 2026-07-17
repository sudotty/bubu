import { describe, expect, it } from "vitest";
import { createReplacementSessionStore } from "./replacement-sessions.js";

describe("private replacement sessions", () => {
  it("returns only an opaque token and consumes the private path once", () => {
    let tokenIndex = 0;
    const store = createReplacementSessionStore({
      now: () => 1_000,
      newToken: () => `${++tokenIndex}`.padStart(32, "a"),
    });
    const token = store.issue("b".repeat(32), "/private/sales-week-2.csv");
    expect(token).not.toContain("sales");
    expect(store.consume(token)).toEqual({
      datasetId: "b".repeat(32),
      sourcePath: "/private/sales-week-2.csv",
    });
    expect(() => store.consume(token)).toThrow("expired or has already been used");
  });

  it("expires pending source paths after ten minutes", () => {
    let now = 5_000;
    const store = createReplacementSessionStore({
      now: () => now,
      newToken: () => "c".repeat(32),
    });
    const token = store.issue("d".repeat(32), "/private/replacement.csv");
    now += 10 * 60 * 1_000 + 1;
    expect(() => store.consume(token)).toThrow("expired or has already been used");
  });
});
