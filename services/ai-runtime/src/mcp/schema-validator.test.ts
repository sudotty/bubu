import { describe, expect, it } from "vitest";
import { canonicalMcpJson } from "@bubu/contracts";
import {
  validateMcpToolArguments,
  validateMcpToolStructuredContent,
} from "./schema-validator.js";

describe("MCP tool JSON Schema validator", () => {
  it("validates default 2020-12 and explicit draft-07 object schemas without coercion", () => {
    const modern = canonicalMcpJson({
      type: "object",
      properties: { term: { type: "string", minLength: 1 } },
      required: ["term"],
      additionalProperties: false,
    });
    expect(() => validateMcpToolArguments(modern, { term: "margin" })).not.toThrow();
    expect(() => validateMcpToolArguments(modern, { term: 7 })).toThrow("does not satisfy");
    expect(() => validateMcpToolArguments(modern, { term: "margin", hidden: true })).toThrow("does not satisfy");

    const draft7 = canonicalMcpJson({
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: { count: { type: "integer", minimum: 1 } },
      required: ["count"],
    });
    expect(() => validateMcpToolArguments(draft7, { count: 2 })).not.toThrow();
  });

  it("fails closed on unsupported dialects, remote references, and synchronous regex schemas", () => {
    expect(() => validateMcpToolArguments(canonicalMcpJson({
      $schema: "https://example.com/custom-schema",
      type: "object",
    }), {})).toThrow("dialect");
    expect(() => validateMcpToolArguments(canonicalMcpJson({
      type: "object",
      properties: { value: { $ref: "https://example.com/schema.json" } },
    }), { value: "x" })).toThrow("remote references");
    expect(() => validateMcpToolArguments(canonicalMcpJson({
      type: "object",
      properties: { value: { type: "string", pattern: "(a+)+$" } },
    }), { value: "a" })).toThrow("regular-expression");
  });

  it("validates structured content against an advertised output schema", () => {
    const outputSchema = {
      type: "object",
      properties: { definition: { type: "string" } },
      required: ["definition"],
      additionalProperties: false,
    };
    expect(() => validateMcpToolStructuredContent(outputSchema, { definition: "Revenue minus cost" })).not.toThrow();
    expect(() => validateMcpToolStructuredContent(outputSchema, { value: "wrong" })).toThrow("does not satisfy");
  });
});
