import { z } from "zod";

export const providerKindSchema = z.enum([
  "openai",
  "anthropic",
  "gemini",
  "openai-compatible",
  "ollama",
]);

export const providerProfileSchema = z
  .object({
    id: z.string().regex(/^[0-9a-f]{32}$/u),
    name: z.string().trim().min(1).max(100),
    kind: providerKindSchema,
    baseUrl: z.url().max(2_000),
    model: z.string().trim().min(1).max(200),
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
    providerId: z.string().regex(/^[0-9a-f]{32}$/u),
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
export type ProviderProfile = z.infer<typeof providerProfileSchema>;
export type ModelInvocation = z.infer<typeof modelInvocationSchema>;
export type ModelCompletion = z.infer<typeof modelCompletionSchema>;

export function parseModelInvocation(value: unknown): ModelInvocation {
  return modelInvocationSchema.parse(value);
}

export function parseModelCompletion(value: unknown): ModelCompletion {
  return modelCompletionSchema.parse(value);
}
