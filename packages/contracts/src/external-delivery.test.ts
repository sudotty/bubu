import { describe, expect, it } from "vitest";
import { parseExternalDeliveryPayload, parseWebhookDestinationInput, parseWorkflowDeliveryBindingInput } from "./external-delivery.js";

describe("external delivery contracts", () => {
  it("accepts only credential-free HTTPS destinations and bounded secrets", () => {
    expect(parseWebhookDestinationInput({ name: "Ops", url: "https://hooks.example.com/bubu", secret: "s".repeat(16) }).url).toContain("https://");
    for (const url of ["http://hooks.example.com", "https://token@hooks.example.com", "https://hooks.example.com/#secret"]) expect(() => parseWebhookDestinationInput({ name: "Ops", url, secret: "s".repeat(16) })).toThrow();
  });
  it("binds a destination to an exact workflow version and minimal payload", () => {
    const id = "a".repeat(32); const runId = "b".repeat(32); const destinationId = "c".repeat(32);
    expect(parseWorkflowDeliveryBindingInput({ workflowId: id, definitionVersion: 2, target: { kind: "dataset", id }, destinationId }).definitionVersion).toBe(2);
    const payload = parseExternalDeliveryPayload({ schemaVersion: 1, event: "workflow.completed", status: "succeeded", workflowId: id, definitionVersion: 2, runId, artifact: null, openHint: `workflow:${id}:run:${runId}` });
    expect(JSON.stringify(payload)).not.toMatch(/path|row|question|prompt/iu);
  });
});
