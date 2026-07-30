import { basename } from "node:path";
import { lstatSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import {
  parseConfigurationBackupBundle,
  parsePortableRendererPreferences,
  type ConfigurationBackupBundle,
  type ConfigurationRestoreSelectionResult,
  type PortableRendererPreferences,
} from "@bubu/contracts";
import type { AgentDefinitionStore } from "./agent-definition-store.js";
import type { ConversationRetentionStore } from "./conversation-retention-store.js";
import type { PrivacyPolicyStore } from "./privacy-policy-store.js";
import { atomicPrivateWrite } from "./secure-files.js";

const maximumConfigurationBytes = 2 * 1_024 * 1_024;
const excluded = ["credentials", "datasets", "provider-connections", "mcp-connections", "hub-and-webhook-connections"] as const;

export interface ConfigurationBackupService {
  create(path: string, rendererPreferences: unknown): ConfigurationBackupBundle;
  restore(path: string): ConfigurationRestoreSelectionResult & { status: "restored" };
  finalizeRestore(rollbackToken: string, commit: boolean): void;
}

export function createConfigurationBackupService({
  privacyPolicy,
  conversationRetention,
  agentDefinitions,
  now = () => new Date(),
  onRollbackError = (error) => console.error("Configuration restore auto-rollback failed", error),
}: {
  readonly privacyPolicy: PrivacyPolicyStore;
  readonly conversationRetention: ConversationRetentionStore;
  readonly agentDefinitions: AgentDefinitionStore;
  readonly now?: () => Date;
  readonly onRollbackError?: (error: unknown) => void;
}): ConfigurationBackupService {
  type Snapshot = {
    readonly privacyPolicy: ReturnType<PrivacyPolicyStore["state"]>;
    readonly conversationRetention: ReturnType<ConversationRetentionStore["state"]>;
    readonly agentDefinitions: ReturnType<AgentDefinitionStore["state"]>;
  };
  const pending = new Map<string, { readonly previous: Snapshot; readonly timer: ReturnType<typeof setTimeout> }>();

  function rollback(previous: Snapshot): void {
    const failures: unknown[] = [];
    try { agentDefinitions.replace(previous.agentDefinitions); } catch (error) { failures.push(error); }
    try { conversationRetention.save(previous.conversationRetention); } catch (error) { failures.push(error); }
    try { privacyPolicy.save(previous.privacyPolicy); } catch (error) { failures.push(error); }
    if (failures.length > 0) throw new AggregateError(failures, "配置恢复回滚不完整");
  }
  function assertPortableTextSafe(rendererPreferences: PortableRendererPreferences, agentRegistry = agentDefinitions.state()): void {
    const findings = [
      ...agentRegistry.definitions.flatMap(({ goal }) => privacyPolicy.inspect(goal).findings),
      ...rendererPreferences.promptTemplates.customTemplates.flatMap(({ instruction }) => privacyPolicy.inspect(instruction).findings),
    ];
    if (findings.length > 0) throw new Error("设置文件包含疑似凭据、个人信息或表格内容；请先从 Agent 目标或自定义提示模板中移除敏感值");
  }

  return {
    create(path, value) {
      const rendererPreferences = parsePortableRendererPreferences(value);
      assertPortableTextSafe(rendererPreferences);
      const bundle = parseConfigurationBackupBundle({
        schemaVersion: 1,
        productId: "bubu",
        createdAt: now().toISOString(),
        privacyPolicy: privacyPolicy.state(),
        conversationRetention: conversationRetention.state(),
        agentDefinitions: agentDefinitions.state(),
        rendererPreferences,
        excluded,
      });
      const encoded = `${JSON.stringify(bundle, null, 2)}\n`;
      if (Buffer.byteLength(encoded) > maximumConfigurationBytes) throw new Error("配置备份超过 2 MiB 安全上限");
      atomicPrivateWrite(path, encoded);
      return bundle;
    },
    restore(path) {
      const stat = lstatSync(path);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("配置备份必须是普通文件");
      if (stat.size > maximumConfigurationBytes) throw new Error("配置备份超过 2 MiB 安全上限");
      const bundle = parseConfigurationBackupBundle(JSON.parse(readFileSync(path, "utf8")) as unknown);
      assertPortableTextSafe(bundle.rendererPreferences, bundle.agentDefinitions);

      // Parse the entire bundle before changing any local state, then roll every
      // already-applied store back if a later atomic write fails.
      const previous = {
        privacyPolicy: privacyPolicy.state(),
        conversationRetention: conversationRetention.state(),
        agentDefinitions: agentDefinitions.state(),
      };
      let privacyApplied = false;
      let retentionApplied = false;
      let agentsApplied = false;
      try {
        privacyPolicy.save(bundle.privacyPolicy); privacyApplied = true;
        conversationRetention.save(bundle.conversationRetention); retentionApplied = true;
        agentDefinitions.replace(bundle.agentDefinitions); agentsApplied = true;
      } catch (error) {
        const rollbackErrors: unknown[] = [];
        if (agentsApplied) try { agentDefinitions.replace(previous.agentDefinitions); } catch (rollbackError) { rollbackErrors.push(rollbackError); }
        if (retentionApplied) try { conversationRetention.save(previous.conversationRetention); } catch (rollbackError) { rollbackErrors.push(rollbackError); }
        if (privacyApplied) try { privacyPolicy.save(previous.privacyPolicy); } catch (rollbackError) { rollbackErrors.push(rollbackError); }
        if (rollbackErrors.length > 0) throw new AggregateError([error, ...rollbackErrors], "配置恢复失败，且本地设置回滚不完整");
        throw error;
      }
      return {
        status: "restored",
        fileName: basename(path),
        rollbackToken: (() => {
          const token = randomBytes(16).toString("hex");
          const timer = setTimeout(() => {
            const transaction = pending.get(token);
            if (!transaction) return;
            pending.delete(token);
            try { rollback(transaction.previous); } catch (error) { onRollbackError(error); }
          }, 30_000);
          timer.unref();
          pending.set(token, { previous, timer });
          return token;
        })(),
        rendererPreferences: bundle.rendererPreferences,
        reauthorizationRequired: ["providers", "mcp", "hub-and-webhooks"],
      };
    },
    finalizeRestore(rollbackToken, commit) {
      if (!/^[0-9a-f]{32}$/u.test(rollbackToken)) throw new Error("配置恢复事务标识无效");
      const transaction = pending.get(rollbackToken);
      if (!transaction) throw new Error("配置恢复事务已结束或已过期");
      pending.delete(rollbackToken);
      clearTimeout(transaction.timer);
      if (!commit) rollback(transaction.previous);
    },
  };
}
