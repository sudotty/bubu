import { z } from "zod";

export const agentDefinitionIdSchema = z.string().regex(/^[0-9a-f]{32}$/u);

export const agentDefinitionSchema = z.object({
  schemaVersion: z.literal(1),
  id: agentDefinitionIdSchema,
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(240),
  goal: z.string().trim().min(1).max(2_000),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict().superRefine((value, context) => {
  if (Date.parse(value.updatedAt) < Date.parse(value.createdAt)) {
    context.addIssue({ code: "custom", path: ["updatedAt"], message: "Agent definition update cannot predate creation" });
  }
});

export const agentDefinitionSaveInputSchema = z.object({
  schemaVersion: z.literal(1),
  id: agentDefinitionIdSchema.optional(),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(240),
  goal: z.string().trim().min(1).max(2_000),
}).strict();

export const agentDefinitionRegistrySchema = z.object({
  schemaVersion: z.literal(1),
  definitions: z.array(agentDefinitionSchema).max(24),
}).strict().superRefine((value, context) => {
  if (new Set(value.definitions.map(({ id }) => id)).size !== value.definitions.length) {
    context.addIssue({ code: "custom", path: ["definitions"], message: "Agent definition IDs must be unique" });
  }
});

export type AgentDefinitionId = z.infer<typeof agentDefinitionIdSchema>;
export type AgentDefinition = z.infer<typeof agentDefinitionSchema>;
export type AgentDefinitionSaveInput = z.infer<typeof agentDefinitionSaveInputSchema>;
export type AgentDefinitionRegistry = z.infer<typeof agentDefinitionRegistrySchema>;

export function parseAgentDefinitionId(value: unknown): AgentDefinitionId {
  return agentDefinitionIdSchema.parse(value);
}

export function parseAgentDefinition(value: unknown): AgentDefinition {
  return agentDefinitionSchema.parse(value);
}

export function parseAgentDefinitionSaveInput(value: unknown): AgentDefinitionSaveInput {
  return agentDefinitionSaveInputSchema.parse(value);
}

export function parseAgentDefinitionRegistry(value: unknown): AgentDefinitionRegistry {
  return agentDefinitionRegistrySchema.parse(value);
}
