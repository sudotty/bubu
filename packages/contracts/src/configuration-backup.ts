import { z } from "zod";
import { agentDefinitionRegistrySchema } from "./agent-definition.js";
import { conversationRetentionPolicySchema } from "./conversation.js";
import { privacyPolicySchema } from "./privacy.js";
import { promptTemplateRegistrySchema } from "./prompt-template.js";

export const visualizationPreferenceSchema = z.object({
  signature: z.string().min(1).max(2_000),
  valueLabel: z.string().min(1).max(500),
}).strict();

export const portableRendererPreferencesSchema = z.object({
  promptTemplates: promptTemplateRegistrySchema,
  visualizationPreferences: z.array(visualizationPreferenceSchema).max(24),
}).strict().superRefine((value, context) => {
  if (new Set(value.visualizationPreferences.map(({ signature }) => signature)).size !== value.visualizationPreferences.length) {
    context.addIssue({ code: "custom", path: ["visualizationPreferences"], message: "Visualization preference signatures must be unique" });
  }
});

export const configurationBackupBundleSchema = z.object({
  schemaVersion: z.literal(1),
  productId: z.literal("bubu"),
  createdAt: z.string().datetime(),
  privacyPolicy: privacyPolicySchema,
  conversationRetention: conversationRetentionPolicySchema,
  agentDefinitions: agentDefinitionRegistrySchema,
  rendererPreferences: portableRendererPreferencesSchema,
  excluded: z.tuple([
    z.literal("credentials"),
    z.literal("datasets"),
    z.literal("provider-connections"),
    z.literal("mcp-connections"),
    z.literal("hub-and-webhook-connections"),
  ]),
}).strict();

export const configurationBackupSelectionResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("cancelled") }).strict(),
  z.object({ status: z.literal("created"), fileName: z.string().min(1).max(255), createdAt: z.string().datetime() }).strict(),
]);

export const configurationRestoreSelectionResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("cancelled") }).strict(),
  z.object({
    status: z.literal("restored"),
    fileName: z.string().min(1).max(255),
    rollbackToken: z.string().regex(/^[0-9a-f]{32}$/u),
    rendererPreferences: portableRendererPreferencesSchema,
    reauthorizationRequired: z.tuple([
      z.literal("providers"),
      z.literal("mcp"),
      z.literal("hub-and-webhooks"),
    ]),
  }).strict(),
]);

export const configurationRestoreFinalizationSchema = z.object({
  rollbackToken: z.string().regex(/^[0-9a-f]{32}$/u),
  commit: z.boolean(),
}).strict();

export type VisualizationPreference = z.infer<typeof visualizationPreferenceSchema>;
export type PortableRendererPreferences = z.infer<typeof portableRendererPreferencesSchema>;
export type ConfigurationBackupBundle = z.infer<typeof configurationBackupBundleSchema>;
export type ConfigurationBackupSelectionResult = z.infer<typeof configurationBackupSelectionResultSchema>;
export type ConfigurationRestoreSelectionResult = z.infer<typeof configurationRestoreSelectionResultSchema>;
export type ConfigurationRestoreFinalization = z.infer<typeof configurationRestoreFinalizationSchema>;

export const parsePortableRendererPreferences = (value: unknown): PortableRendererPreferences => portableRendererPreferencesSchema.parse(value);
export const parseConfigurationBackupBundle = (value: unknown): ConfigurationBackupBundle => configurationBackupBundleSchema.parse(value);
export const parseConfigurationRestoreFinalization = (value: unknown): ConfigurationRestoreFinalization => configurationRestoreFinalizationSchema.parse(value);
