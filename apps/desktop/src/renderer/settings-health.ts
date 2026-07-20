export type SettingsHealthSection = "models" | "connectors" | "privacy";

export interface SettingsHealthFinding {
  readonly id: "encryption" | "provider" | "active-provider" | "connectors" | "ready";
  readonly severity: "blocker" | "action" | "optional" | "ready";
  readonly title: string;
  readonly detail: string;
  readonly section?: SettingsHealthSection;
}

export function deriveSettingsHealth(input: { readonly encryptionAvailable: boolean; readonly providerCount: number; readonly hasActiveProvider: boolean; readonly connectorCount: number }): readonly SettingsHealthFinding[] {
  const findings: SettingsHealthFinding[] = [];
  if (!input.encryptionAvailable) findings.push({ id: "encryption", severity: "blocker", title: "系统加密不可用", detail: "当前只能使用无需密钥的本地服务；先检查操作系统凭据存储。", section: "privacy" });
  if (input.providerCount === 0) findings.push({ id: "provider", severity: "action", title: "尚未配置模型", detail: "添加云模型、兼容接口或本机 Ollama，才能生成分析计划。", section: "models" });
  else if (!input.hasActiveProvider) findings.push({ id: "active-provider", severity: "action", title: "需要选择当前模型", detail: "已有配置但尚未指定用于新任务的模型。", section: "models" });
  if (input.connectorCount === 0) findings.push({ id: "connectors", severity: "optional", title: "没有本地连接器", detail: "这不会阻塞数据对话；仅在需要 MCP 能力时配置。", section: "connectors" });
  if (findings.length === 0) findings.push({ id: "ready", severity: "ready", title: "关键配置已就绪", detail: "当前模型、系统加密与本地连接器均可继续使用。" });
  return findings;
}
