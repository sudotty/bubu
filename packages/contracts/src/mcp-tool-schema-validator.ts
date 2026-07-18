import Ajv, { type AnySchema, type ValidateFunction } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const draft7Dialects = new Set([
  "http://json-schema.org/draft-07/schema#",
  "https://json-schema.org/draft-07/schema#",
]);
const draft202012Dialects = new Set([
  "https://json-schema.org/draft/2020-12/schema",
  "https://json-schema.org/draft/2020-12/schema#",
]);

function createDraft7Validator(): Ajv {
  const validator = new Ajv({
    allErrors: false,
    coerceTypes: false,
    strict: false,
    useDefaults: false,
    validateFormats: true,
  });
  addFormats(validator);
  return validator;
}

function createDraft202012Validator(): Ajv2020 {
  const validator = new Ajv2020({
    allErrors: false,
    coerceTypes: false,
    strict: false,
    useDefaults: false,
    validateFormats: true,
  });
  addFormats(validator);
  return validator;
}

function assertSchemaPolicy(value: unknown): void {
  if (Array.isArray(value)) {
    for (const entry of value) assertSchemaPolicy(entry);
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    if (key === "pattern" || key === "patternProperties") {
      throw new Error("MCP tool schemas with synchronous regular-expression validation are not supported");
    }
    if ((key === "$ref" || key === "$dynamicRef" || key === "$recursiveRef") && typeof entry === "string" && !entry.startsWith("#")) {
      throw new Error("MCP tool schemas cannot load remote references");
    }
    assertSchemaPolicy(entry);
  }
}

function compileSchema(schemaValue: unknown): ValidateFunction {
  if (typeof schemaValue !== "object" || schemaValue === null || Array.isArray(schemaValue)) {
    throw new Error("MCP tool schema must be a JSON object");
  }
  assertSchemaPolicy(schemaValue);
  const dialect = (schemaValue as Record<string, unknown>)["$schema"];
  if (dialect !== undefined && typeof dialect !== "string") {
    throw new Error("MCP tool schema dialect must be a string");
  }
  let validator: Ajv | Ajv2020;
  if (dialect === undefined || draft202012Dialects.has(dialect)) validator = createDraft202012Validator();
  else if (draft7Dialects.has(dialect)) validator = createDraft7Validator();
  else throw new Error("MCP tool schema uses an unsupported JSON Schema dialect");
  try {
    return validator.compile(schemaValue as AnySchema);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1_000) : "invalid schema";
    throw new Error(`MCP tool schema could not be compiled: ${message}`);
  }
}

function assertValid(validate: ValidateFunction, value: unknown): void {
  if (validate(value)) return;
  const issue = validate.errors?.[0];
  const location = issue?.instancePath || "/";
  const keyword = issue?.keyword ?? "schema";
  throw new Error(`MCP tool value does not satisfy its schema at ${location} (${keyword})`);
}

export function validateMcpToolArguments(schemaJson: string, argumentsValue: Readonly<Record<string, unknown>>): void {
  let schema: unknown;
  try {
    schema = JSON.parse(schemaJson) as unknown;
  } catch {
    throw new Error("MCP tool input schema is not valid JSON");
  }
  assertValid(compileSchema(schema), argumentsValue);
}

export function validateMcpToolStructuredContent(schema: unknown, structuredContent: Readonly<Record<string, unknown>>): void {
  assertValid(compileSchema(schema), structuredContent);
}
