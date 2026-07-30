import { describe, expect, it } from "vitest";
import { decideExternalDeliveryFailure } from "./external-delivery-policy.js";

describe("external delivery retry policy", () => {
  it("uses two bounded backoffs and then records final failure", () => {
    expect(decideExternalDeliveryFailure({ attempts: 1, now: "2026-07-29T00:00:00Z", errorCode: "HTTP_503" }).nextAttemptAt).toBe("2026-07-29T00:00:30.000Z");
    expect(decideExternalDeliveryFailure({ attempts: 2, now: "2026-07-29T00:00:00Z", errorCode: "HTTP_503" }).nextAttemptAt).toBe("2026-07-29T00:02:00.000Z");
    expect(decideExternalDeliveryFailure({ attempts: 3, now: "2026-07-29T00:00:00Z", errorCode: "HTTP_503" })).toMatchObject({ status: "failed", nextAttemptAt: null });
  });
});
