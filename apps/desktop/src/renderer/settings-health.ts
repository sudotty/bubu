export type SettingsHealthSection = "models" | "prompts" | "connectors" | "privacy";

export interface SettingsHealthFinding {
  readonly id: "diagnostics" | "encryption" | "provider" | "active-provider" | "connectors" | "ready";
  readonly severity: "blocker" | "action" | "optional" | "ready";
  readonly title: string;
  readonly detail: string;
  readonly section?: SettingsHealthSection;
}

export interface SettingsHealthInput {
  readonly encryptionAvailable: boolean | null;
  readonly providerCount: number | null;
  readonly hasActiveProvider: boolean | null;
  readonly connectorCount: number | null;
}

export function deriveSettingsHealth(input: SettingsHealthInput): readonly SettingsHealthFinding[] {
  if (input.encryptionAvailable === null || input.providerCount === null || input.hasActiveProvider === null || input.connectorCount === null) {
    return [{ id: "diagnostics", severity: "blocker", title: "配置状态暂时不可用", detail: "部分本地诊断没有返回；重新检查后再根据结果处理，不会把未知状态当成缺失配置。" }];
  }
  const findings: SettingsHealthFinding[] = [];
  if (!input.encryptionAvailable) findings.push({ id: "encryption", severity: "blocker", title: "系统加密不可用", detail: "当前只能使用无需密钥的本地服务；在隐私与恢复中查看系统凭据存储处理步骤。", section: "privacy" });
  if (input.providerCount === 0) findings.push({ id: "provider", severity: "action", title: "尚未配置模型", detail: "添加云模型、兼容接口或本机 Ollama，才能生成分析计划。", section: "models" });
  else if (!input.hasActiveProvider) findings.push({ id: "active-provider", severity: "action", title: "需要选择当前模型", detail: "已有配置但尚未指定用于新任务的模型。", section: "models" });
  if (input.connectorCount === 0) findings.push({ id: "connectors", severity: "optional", title: "没有本地连接器", detail: "这不会阻塞数据对话；仅在需要 MCP 能力时配置。", section: "connectors" });
  if (findings.length === 0) findings.push({ id: "ready", severity: "ready", title: "关键配置已就绪", detail: "当前模型、系统加密与本地连接器均可继续使用。" });
  return findings;
}
