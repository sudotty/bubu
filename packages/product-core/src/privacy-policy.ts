import { parsePrivacyTextInspection, type PrivacyDlpFinding, type PrivacyTextInspection } from "@bubu/contracts";

const definitions = [
  { kind: "credential", severity: "high", label: "疑似访问密钥或密码", patterns: [/\b(?:sk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{16,}\b/u, /\bAIza[0-9A-Za-z_-]{24,}\b/u, /\b(?:api[_ -]?key|access[_ -]?token|password|passwd|secret)\s*[:=]\s*\S{8,}/iu] },
  { kind: "government-id", severity: "high", label: "疑似身份证件号码", patterns: [/(?<!\d)\d{17}[0-9Xx](?!\d)/u] },
  { kind: "email", severity: "medium", label: "疑似电子邮箱", patterns: [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu] },
  { kind: "phone", severity: "medium", label: "疑似电话号码", patterns: [/(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)/u] },
] as const;

function looksLikePastedTable(text: string): boolean {
  const lines = text.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 3) return false;
  for (const separator of ["\t", ",", "|"] as const) {
    const widths = lines.slice(0, 20).map((line) => line.split(separator).length);
    if (widths[0] !== undefined && widths[0] >= 3 && widths.every((width) => width === widths[0])) return true;
  }
  return false;
}

export function inspectPrivacyText(text: string): PrivacyTextInspection {
  const normalized = text.normalize("NFKC").slice(0, 20_000);
  const findings: PrivacyDlpFinding[] = definitions.flatMap((definition) =>
    definition.patterns.some((pattern) => pattern.test(normalized))
      ? [{ kind: definition.kind, severity: definition.severity, label: definition.label }]
      : []);
  if (looksLikePastedTable(normalized)) findings.push({ kind: "pasted-table", severity: "high", label: "疑似粘贴的多行表格" });
  return parsePrivacyTextInspection({ decision: findings.length > 0 ? "block" : "allow", findings });
}
