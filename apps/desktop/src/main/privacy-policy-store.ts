import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePrivacyPolicy, type PrivacyPolicy, type PrivacyTextInspection } from "@bubu/contracts";
import { inspectPrivacyText } from "@bubu/product-core";
import { atomicPrivateWrite, preparePrivateDirectory } from "./secure-files.js";

export interface PrivacyPolicyStore {
  state(): PrivacyPolicy;
  save(value: unknown): PrivacyPolicy;
  inspect(text: string): PrivacyTextInspection;
  assertModelTextAllowed(...values: readonly string[]): void;
  assertExplicitRowsAllowed(...values: readonly string[]): void;
  assertKnowledgeChunksAllowed(...values: readonly string[]): void;
  assertMcpModelContentAllowed(baseUrl: string, ...values: readonly string[]): void;
  disclosureFor(baseUrl: string): "schema-only" | "schema-synthetic";
}

const defaultPolicy: PrivacyPolicy = {
  schemaVersion: 1,
  mode: "local-private",
  localDlpEnabled: true,
};

function isLoopback(baseUrl: string): boolean {
  const hostname = new URL(baseUrl).hostname.replace(/^\[|\]$/gu, "").toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function createPrivacyPolicyStore(directory: string): PrivacyPolicyStore {
  preparePrivateDirectory(directory);
  const path = join(directory, "policy.json");
  let policy = existsSync(path)
    ? parsePrivacyPolicy(JSON.parse(readFileSync(path, "utf8")) as unknown)
    : defaultPolicy;

  return {
    state: () => policy,
    save(value) {
      const next = parsePrivacyPolicy(value);
      atomicPrivateWrite(path, `${JSON.stringify(next, null, 2)}\n`);
      policy = next;
      return policy;
    },
    inspect: inspectPrivacyText,
    assertModelTextAllowed(...values) {
      const findings = values.flatMap((value) => inspectPrivacyText(value).findings);
      if (findings.length === 0) return;
      const labels = [...new Set(findings.map(({ label }) => label))].join("、");
      throw new Error(`本地隐私检查已阻止模型请求：${labels}。请删除粘贴的敏感值，只描述需要完成的分析。`);
    },
    assertExplicitRowsAllowed(...values) {
      if (policy.mode === "strict-private") {
        throw new Error("严格隐私模式禁止任何显式原始行披露；请切换回本地私密模式后重新审查。");
      }
      const findings = values.flatMap((value) => inspectPrivacyText(value).findings);
      if (findings.length === 0) return;
      const labels = [...new Set(findings.map(({ label }) => label))].join("、");
      throw new Error(`本地隐私检查已阻止原始行披露：${labels}。请减少所选行列或先在本地完成脱敏。`);
    },
    assertKnowledgeChunksAllowed(...values) {
      if (policy.mode === "strict-private") {
        throw new Error("严格隐私模式禁止向模型披露检索段落；仍可在本地搜索并查看引用。");
      }
      const findings = values.flatMap((value) => inspectPrivacyText(value).findings);
      if (findings.length === 0) return;
      const labels = [...new Set(findings.map(({ label }) => label))].join("、");
      throw new Error(`本地隐私检查已阻止知识段落披露：${labels}。请缩小检索范围或先在本地完成脱敏。`);
    },
    assertMcpModelContentAllowed(baseUrl, ...values) {
      if (policy.mode === "strict-private" && !isLoopback(baseUrl)) {
        throw new Error("严格隐私模式禁止向远程模型披露 MCP 提示内容或工具元数据；可改用本机模型后重新审查。");
      }
      const findings = values.flatMap((value) => inspectPrivacyText(value).findings);
      if (findings.length === 0) return;
      const labels = [...new Set(findings.map(({ label }) => label))].join("、");
      throw new Error(`本地隐私检查已阻止 MCP 模型披露：${labels}。请先移除敏感值或改用本机模型。`);
    },
    disclosureFor(baseUrl) {
      return policy.mode === "strict-private" && !isLoopback(baseUrl)
        ? "schema-only"
        : "schema-synthetic";
    },
  };
}
