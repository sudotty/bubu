import { describe, expect, it } from "vitest";
import { parseOperationEnvelope, parseOperationId } from "./operation.js";

describe("cancellable operation identity", () => {
  it("accepts UUID operation identities and strict envelopes", () => {
    const operationId = "123e4567-e89b-42d3-a456-426614174000";
    expect(parseOperationId(operationId)).toBe(operationId);
    expect(parseOperationEnvelope({ operationId, value: { datasetId: "local" } })).toEqual({
      operationId,
      value: { datasetId: "local" },
    });
    expect(() => parseOperationEnvelope({ operationId, value: {}, channel: "arbitrary" })).toThrow();
  });
});
