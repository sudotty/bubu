import { describe, expect, it } from "vitest";
import type { ExplicitRowDisclosurePreview } from "@bubu/contracts";
import { createExplicitRowApprovalSessionStore } from "./explicit-row-approval-sessions.js";

const preview: ExplicitRowDisclosurePreview = {
  schemaVersion: 1,
  selection: { schemaVersion: 1, datasetId: "a".repeat(32), versionId: "b".repeat(32), purpose: "review", rowNumbers: [1], columns: ["Order ID"] },
  columnTypes: ["text"], rows: [{ rowNumber: 1, cells: ["A-1"] }], cellCount: 1, payloadBytes: 100, payloadSha256: "c".repeat(64),
};
const destination = { providerId: "d".repeat(32), providerKind: "openai" as const, providerName: "Provider", model: "model", endpointOrigin: "https://api.example.com" };

describe("explicit row one-use approval", () => {
  it("binds exact preview and destination, then consumes once", () => {
    const store = createExplicitRowApprovalSessionStore({ now: () => 1_000, newToken: () => "e".repeat(64) });
    const proposal = store.issue(preview, destination);
    expect(proposal).toMatchObject({ preview, destination });
    expect(store.consume(proposal.approvalToken)).toEqual({ preview, destination });
    expect(() => store.consume(proposal.approvalToken)).toThrow("expired or has already been used");
  });

  it("rejects an expired approval and supports revocation", () => {
    let now = 1_000;
    const store = createExplicitRowApprovalSessionStore({ now: () => now, newToken: () => "f".repeat(64) });
    const expired = store.issue(preview, destination);
    now += 10 * 60 * 1_000 + 1;
    expect(() => store.consume(expired.approvalToken)).toThrow("expired");
    now = 1_000;
    const revoked = store.issue(preview, destination);
    store.revoke(revoked.approvalToken);
    expect(() => store.consume(revoked.approvalToken)).toThrow();
  });
});
