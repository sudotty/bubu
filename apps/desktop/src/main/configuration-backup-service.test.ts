import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createAgentDefinitionStore } from "./agent-definition-store.js";
import { createConfigurationBackupService } from "./configuration-backup-service.js";
import { createConversationRetentionStore } from "./conversation-retention-store.js";
import { createPrivacyPolicyStore } from "./privacy-policy-store.js";

const rendererPreferences = {
  promptTemplates: { schemaVersion: 1 as const, customTemplates: [], selected: {} },
  visualizationPreferences: [{ signature: "sales", valueLabel: "销售额" }],
};

describe("configuration backup service", () => {
  it("round-trips portable settings while keeping credentials out of scope", () => {
    const root = mkdtempSync(join(tmpdir(), "bubu-config-"));
    const source = {
      privacyPolicy: createPrivacyPolicyStore(join(root, "source-privacy")),
      conversationRetention: createConversationRetentionStore(join(root, "source-retention")),
      agentDefinitions: createAgentDefinitionStore({ directory: join(root, "source-agents"), createId: () => "a".repeat(32), now: () => new Date("2026-07-29T00:00:00.000Z") }),
    };
    source.privacyPolicy.save({ schemaVersion: 1, mode: "strict-private", localDlpEnabled: true });
    source.conversationRetention.save({ schemaVersion: 1, enabled: true, retentionDays: 180 });
    source.agentDefinitions.save({ schemaVersion: 1, name: "周报", description: "经营周报", goal: "只分析聚合经营指标" });
    const path = join(root, "settings.bubu-settings");
    createConfigurationBackupService({ ...source, now: () => new Date("2026-07-29T01:00:00.000Z") }).create(path, rendererPreferences);

    const target = {
      privacyPolicy: createPrivacyPolicyStore(join(root, "target-privacy")),
      conversationRetention: createConversationRetentionStore(join(root, "target-retention")),
      agentDefinitions: createAgentDefinitionStore({ directory: join(root, "target-agents") }),
    };
    const service = createConfigurationBackupService(target);
    const result = service.restore(path);
    expect(target.privacyPolicy.state().mode).toBe("strict-private");
    expect(target.conversationRetention.state()).toMatchObject({ enabled: true, retentionDays: 180 });
    expect(target.agentDefinitions.state().definitions).toHaveLength(1);
    expect(result.rendererPreferences).toEqual(rendererPreferences);
    expect(result.reauthorizationRequired).toEqual(["providers", "mcp", "hub-and-webhooks"]);
    service.finalizeRestore(result.rollbackToken, true);
  });

  it("rolls main-process settings back when the renderer rejects the transaction", () => {
    const root = mkdtempSync(join(tmpdir(), "bubu-config-renderer-rollback-"));
    const source = {
      privacyPolicy: createPrivacyPolicyStore(join(root, "source-privacy")),
      conversationRetention: createConversationRetentionStore(join(root, "source-retention")),
      agentDefinitions: createAgentDefinitionStore({ directory: join(root, "source-agents") }),
    };
    source.privacyPolicy.save({ schemaVersion: 1, mode: "strict-private", localDlpEnabled: true });
    const path = join(root, "settings.bubu-settings");
    createConfigurationBackupService(source).create(path, rendererPreferences);
    const target = {
      privacyPolicy: createPrivacyPolicyStore(join(root, "target-privacy")),
      conversationRetention: createConversationRetentionStore(join(root, "target-retention")),
      agentDefinitions: createAgentDefinitionStore({ directory: join(root, "target-agents") }),
    };
    const service = createConfigurationBackupService(target);
    const result = service.restore(path);
    expect(target.privacyPolicy.state().mode).toBe("strict-private");
    service.finalizeRestore(result.rollbackToken, false);
    expect(target.privacyPolicy.state().mode).toBe("local-private");
  });

  it("rolls back every applied store when a later section cannot be persisted", () => {
    const root = mkdtempSync(join(tmpdir(), "bubu-config-rollback-"));
    const source = {
      privacyPolicy: createPrivacyPolicyStore(join(root, "source-privacy")),
      conversationRetention: createConversationRetentionStore(join(root, "source-retention")),
      agentDefinitions: createAgentDefinitionStore({ directory: join(root, "source-agents") }),
    };
    source.privacyPolicy.save({ schemaVersion: 1, mode: "strict-private", localDlpEnabled: true });
    source.conversationRetention.save({ schemaVersion: 1, enabled: true, retentionDays: 365 });
    const path = join(root, "settings.bubu-settings");
    createConfigurationBackupService(source).create(path, rendererPreferences);

    const privacyPolicy = createPrivacyPolicyStore(join(root, "target-privacy"));
    const conversationRetention = createConversationRetentionStore(join(root, "target-retention"));
    const realAgents = createAgentDefinitionStore({ directory: join(root, "target-agents") });
    const service = createConfigurationBackupService({
      privacyPolicy,
      conversationRetention,
      agentDefinitions: { ...realAgents, replace: () => { throw new Error("disk full"); } },
    });
    expect(() => service.restore(path)).toThrow("disk full");
    expect(privacyPolicy.state()).toMatchObject({ mode: "local-private" });
    expect(conversationRetention.state()).toMatchObject({ enabled: false, retentionDays: 90 });
  });
});
