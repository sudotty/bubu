import { describe, expect, it } from "vitest";
import {
  parseAgentDefinition,
  parseAgentDefinitionRegistry,
  parseAgentDefinitionSaveInput,
} from "./agent-definition.js";

const definition = {
  schemaVersion: 1 as const,
  id: "a".repeat(32),
  name: "区域差异审查",
  description: "复用固定聚合工具寻找异常区域",
  goal: "找出最值得关注的区域差异，并引用批准单元格。",
  createdAt: "2026-07-28T00:00:00.000Z",
  updatedAt: "2026-07-28T00:00:00.000Z",
};

describe("reusable bounded agent definitions", () => {
  it("accepts one bounded definition and its editable input", () => {
    expect(parseAgentDefinition(definition)).toEqual(definition);
    expect(parseAgentDefinitionSaveInput({ schemaVersion: 1, name: definition.name, description: definition.description, goal: definition.goal })).toEqual({
      schemaVersion: 1, name: definition.name, description: definition.description, goal: definition.goal,
    });
  });

  it("rejects duplicate IDs, unknown authority, and invalid timestamps", () => {
    expect(() => parseAgentDefinitionRegistry({ schemaVersion: 1, definitions: [definition, definition] })).toThrow();
    expect(() => parseAgentDefinition({ ...definition, tools: ["network"] })).toThrow();
    expect(() => parseAgentDefinition({ ...definition, updatedAt: "2026-07-27T00:00:00.000Z" })).toThrow();
  });
});
