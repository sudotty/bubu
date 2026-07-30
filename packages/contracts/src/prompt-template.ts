import { z } from "zod";

export const promptTemplateScopeSchema = z.enum(["dataset-query", "group-query", "aggregate-explanation"]);
export const promptTemplateIdSchema = z.string().regex(/^(?:builtin:[a-z0-9-]{1,48}|[0-9a-f]{32})$/u);

export const promptTemplateSchema = z.object({
  schemaVersion: z.literal(1),
  id: promptTemplateIdSchema,
  origin: z.enum(["builtin", "custom"]),
  scope: promptTemplateScopeSchema,
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(240),
  instruction: z.string().trim().min(1).max(4_000),
}).strict().superRefine((value, context) => {
  if (value.origin === "builtin" && !value.id.startsWith("builtin:")) {
    context.addIssue({ code: "custom", path: ["id"], message: "Built-in prompt templates require a built-in ID" });
  }
  if (value.origin === "custom" && value.id.startsWith("builtin:")) {
    context.addIssue({ code: "custom", path: ["id"], message: "Custom prompt templates cannot use a built-in ID" });
  }
});

export const promptTemplateRegistrySchema = z.object({
  schemaVersion: z.literal(1),
  customTemplates: z.array(promptTemplateSchema).max(24),
  selected: z.object({
    datasetQuery: promptTemplateIdSchema.optional(),
    groupQuery: promptTemplateIdSchema.optional(),
    aggregateExplanation: promptTemplateIdSchema.optional(),
  }).strict(),
}).strict().superRefine((value, context) => {
  for (const [index, template] of value.customTemplates.entries()) {
    if (template.origin !== "custom") {
      context.addIssue({ code: "custom", path: ["customTemplates", index, "origin"], message: "Saved templates must be custom" });
    }
  }
  if (new Set(value.customTemplates.map(({ id }) => id)).size !== value.customTemplates.length) {
    context.addIssue({ code: "custom", path: ["customTemplates"], message: "Custom prompt template IDs must be unique" });
  }
});

export type PromptTemplateScope = z.infer<typeof promptTemplateScopeSchema>;
export type PromptTemplateId = z.infer<typeof promptTemplateIdSchema>;
export type PromptTemplate = z.infer<typeof promptTemplateSchema>;
export type PromptTemplateRegistry = z.infer<typeof promptTemplateRegistrySchema>;

export function parsePromptTemplate(value: unknown): PromptTemplate {
  return promptTemplateSchema.parse(value);
}

export function parsePromptTemplateRegistry(value: unknown): PromptTemplateRegistry {
  return promptTemplateRegistrySchema.parse(value);
}
