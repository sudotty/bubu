import type { ProviderKind } from "@bubu/contracts";

export interface ProviderPreset {
  readonly id: "openai-frontier" | "openai-balanced" | "deepseek-fast" | "ollama-local";
  readonly name: string;
  readonly kind: ProviderKind;
  readonly baseUrl: string;
  readonly model: string;
  readonly summary: string;
  readonly transportLabel: string;
}

/** Editable starting points only: no preset saves credentials or sends requests. */
export const providerPresets: readonly ProviderPreset[] = [
  { id: "openai-frontier", name: "OpenAI · 高质量", kind: "openai", baseUrl: "https://api.openai.com/v1/", model: "gpt-5.6", summary: "复杂分析与高质量任务", transportLabel: "Responses API" },
  { id: "openai-balanced", name: "OpenAI · 均衡", kind: "openai", baseUrl: "https://api.openai.com/v1/", model: "gpt-5.6-terra", summary: "质量、速度与成本平衡", transportLabel: "Responses API" },
  { id: "deepseek-fast", name: "DeepSeek · 快速", kind: "openai-compatible", baseUrl: "https://api.deepseek.com/", model: "deepseek-v4-flash", summary: "OpenAI 兼容的快速分析", transportLabel: "Chat Completions" },
  { id: "ollama-local", name: "Ollama · 本机", kind: "ollama", baseUrl: "http://127.0.0.1:11434/v1/", model: "qwen3:8b", summary: "数据与推理都留在本机", transportLabel: "Responses API" },
] as const;

export function providerPresetById(id: ProviderPreset["id"]): ProviderPreset {
  const preset = providerPresets.find((candidate) => candidate.id === id);
  if (!preset) throw new Error(`Unknown provider preset: ${id}`);
  return preset;
}
