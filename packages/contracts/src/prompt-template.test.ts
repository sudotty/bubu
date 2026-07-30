import { describe, expect, it } from "vitest";
import { parsePromptTemplate, parsePromptTemplateRegistry } from "./prompt-template.js";

const custom = {
  schemaVersion: 1,
  id: "a".repeat(32),
  origin: "custom",
  scope: "dataset-query",
  name: "经营周报",
  description: "突出环比和异常",
  instruction: "优先选择时间维度，并保留记录数作为分母。",
} as const;

describe("prompt template boundary", () => {
  it("accepts bounded custom templates and versioned selection state", () => {
    expect(parsePromptTemplate(custom)).toEqual(custom);
    expect(parsePromptTemplateRegistry({ schemaVersion: 1, customTemplates: [custom], selected: { datasetQuery: custom.id } })).toMatchObject({ selected: { datasetQuery: custom.id } });
  });

  it("rejects origin spoofing, duplicate IDs, and unbounded instructions", () => {
    expect(() => parsePromptTemplate({ ...custom, id: "builtin:spoof" })).toThrow();
    expect(() => parsePromptTemplate({ ...custom, instruction: "x".repeat(4_001) })).toThrow();
    expect(() => parsePromptTemplateRegistry({ schemaVersion: 1, customTemplates: [custom, custom], selected: {} })).toThrow();
  });
});
