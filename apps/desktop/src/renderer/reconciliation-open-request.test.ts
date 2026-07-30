import { describe, expect, it } from "vitest";
import { shouldOpenReconciliation } from "./reconciliation-open-request.js";

describe("shouldOpenReconciliation", () => {
  it("consumes an open request once instead of reopening after a group refresh", () => {
    expect(shouldOpenReconciliation(1, 0, true)).toBe(true);
    expect(shouldOpenReconciliation(1, 1, true)).toBe(false);
  });

  it("waits until the requested group exists", () => {
    expect(shouldOpenReconciliation(2, 1, false)).toBe(false);
    expect(shouldOpenReconciliation(2, 1, true)).toBe(true);
  });
});
