import { z } from "zod";

export const providerIdSchema = z.string().regex(/^[0-9a-f]{32}$/u);

export const providerKindSchema = z.enum([
  "openai",
  "anthropic",
  "gemini",
  "openai-compatible",
  "ollama",
]);

export const providerProfileSchema = z
  .object({
    id: providerIdSchema,
    name: z.string().trim().min(1).max(100),
    kind: providerKindSchema,
    baseUrl: z.url().max(2_000),
    model: z.string().trim().min(1).max(200),
  })
  .strict();

export const providerConfigurationInputSchema = z
  .object({
    id: providerIdSchema.optional(),
    name: z.string().trim().min(1).max(100),
    kind: providerKindSchema,
    baseUrl: z.url().max(2_000),
    model: z.string().trim().min(1).max(200),
    credential: z.string().trim().min(1).max(8_192).optional(),
  })
  .strict();

export const providerSummarySchema = z
  .object({
    profile: providerProfileSchema,
    hasCredential: z.boolean(),
  })
  .strict();

export const providerRegistryStateSchema = z
  .object({
    providers: z.array(providerSummarySchema).max(50),
    activeProviderId: providerIdSchema.nullable(),
    encryptionAvailable: z.boolean(),
  })
  .strict()
  .superRefine((state, context) => {
    if (
      state.activeProviderId !== null &&
      !state.providers.some(({ profile }) => profile.id === state.activeProviderId)
    ) {
      context.addIssue({
        code: "custom",
        message: "Active provider must exist in the registry",
        path: ["activeProviderId"],
      });
    }
  });

export const providerConnectionResultSchema = z
  .object({
    status: z.literal("connected"),
    providerId: providerIdSchema,
    providerKind: providerKindSchema,
    model: z.string().min(1).max(200),
    latencyMs: z.number().int().nonnegative(),
  })
  .strict();

export const modelInvocationSchema = z
  .object({
    provider: providerProfileSchema,
    credential: z.string().max(8_192),
    system: z.string().min(1).max(50_000),
    user: z.string().min(1).max(200_000),
    maxOutputTokens: z.number().int().min(1).max(32_768).default(2_048),
  })
  .strict();

export const modelCompletionSchema = z
  .object({
    providerId: providerIdSchema,
    providerKind: providerKindSchema,
    model: z.string().min(1),
    text: z.string(),
    usage: z
      .object({
        inputTokens: z.number().int().nonnegative().optional(),
        outputTokens: z.number().int().nonnegative().optional(),
        totalTokens: z.number().int().nonnegative().optional(),
      })
      .strict(),
  })
  .strict();

export type ProviderKind = z.infer<typeof providerKindSchema>;
export type ProviderId = z.infer<typeof providerIdSchema>;
export type ProviderProfile = z.infer<typeof providerProfileSchema>;
export type ProviderConfigurationInput = z.infer<typeof providerConfigurationInputSchema>;
export type ProviderSummary = z.infer<typeof providerSummarySchema>;
export type ProviderRegistryState = z.infer<typeof providerRegistryStateSchema>;
export type ProviderConnectionResult = z.infer<typeof providerConnectionResultSchema>;
export type ModelInvocation = z.infer<typeof modelInvocationSchema>;
export type ModelCompletion = z.infer<typeof modelCompletionSchema>;

export function parseProviderId(value: unknown): ProviderId {
  return providerIdSchema.parse(value);
}

export function parseProviderConfigurationInput(value: unknown): ProviderConfigurationInput {
  return providerConfigurationInputSchema.parse(value);
}

export function parseProviderRegistryState(value: unknown): ProviderRegistryState {
  return providerRegistryStateSchema.parse(value);
}

export function parseProviderConnectionResult(value: unknown): ProviderConnectionResult {
  return providerConnectionResultSchema.parse(value);
}

export function parseModelInvocation(value: unknown): ModelInvocation {
  return modelInvocationSchema.parse(value);
}

export function parseModelCompletion(value: unknown): ModelCompletion {
  return modelCompletionSchema.parse(value);
}
