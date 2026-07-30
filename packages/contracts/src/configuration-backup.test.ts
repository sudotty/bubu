import { describe, expect, it } from "vitest";
import { parseConfigurationBackupBundle, parseConfigurationRestoreFinalization } from "./configuration-backup.js";

const validBundle = {
  schemaVersion: 1,
  productId: "bubu",
  createdAt: "2026-07-29T00:00:00.000Z",
  privacyPolicy: { schemaVersion: 1, mode: "local-private", localDlpEnabled: true },
  conversationRetention: { schemaVersion: 1, enabled: false, retentionDays: 90 },
  agentDefinitions: { schemaVersion: 1, definitions: [] },
  rendererPreferences: {
    promptTemplates: { schemaVersion: 1, customTemplates: [], selected: {} },
    visualizationPreferences: [{ signature: "amount", valueLabel: "金额" }],
  },
  excluded: ["credentials", "datasets", "provider-connections", "mcp-connections", "hub-and-webhook-connections"],
} as const;

describe("configuration backup contract", () => {
  it("accepts a strict credential-free settings bundle", () => {
    expect(parseConfigurationBackupBundle(validBundle)).toEqual(validBundle);
  });

  it("rejects duplicate visualization preferences", () => {
    expect(() => parseConfigurationBackupBundle({
      ...validBundle,
      rendererPreferences: {
        ...validBundle.rendererPreferences,
        visualizationPreferences: [
          { signature: "amount", valueLabel: "金额" },
          { signature: "amount", valueLabel: "数量" },
        ],
      },
    })).toThrow();
  });

  it("rejects credential-shaped additions rather than silently carrying secrets", () => {
    expect(() => parseConfigurationBackupBundle({ ...validBundle, apiKey: "secret" })).toThrow();
  });

  it("requires an exact one-use restore transaction token", () => {
    expect(parseConfigurationRestoreFinalization({ rollbackToken: "a".repeat(32), commit: true })).toEqual({ rollbackToken: "a".repeat(32), commit: true });
    expect(() => parseConfigurationRestoreFinalization({ rollbackToken: "expired", commit: true })).toThrow();
  });
});
