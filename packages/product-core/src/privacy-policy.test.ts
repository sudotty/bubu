import { describe, expect, it } from "vitest";
import { inspectPrivacyText } from "./privacy-policy.js";

describe("local privacy DLP", () => {
  it("allows ordinary analytical questions", () => {
    expect(inspectPrivacyText("按区域汇总本月销售额并显示趋势")).toEqual({ decision: "allow", findings: [] });
  });

  it.each([
    ["credential", ["api_key = s", "k-example_12345678901234567890"].join("")],
    ["government-id", "客户证件号 110101199001011234"],
    ["email", "联系 alice@example.com"],
    ["phone", "手机号 13800138000"],
    ["pasted-table", "name,email,amount\nAlice,a@example.com,10\nBob,b@example.com,20"],
  ])("blocks %s without returning matched content", (kind, text) => {
    const result = inspectPrivacyText(text);
    expect(result.decision).toBe("block");
    expect(result.findings.some((finding) => finding.kind === kind)).toBe(true);
    expect(JSON.stringify(result)).not.toContain(text);
  });
});
