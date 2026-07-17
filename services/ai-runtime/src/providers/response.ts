import { parseModelCompletion, type ModelCompletion, type ModelInvocation } from "@bubu/contracts";
import { z } from "zod";
import { providerTransport } from "./request.js";

const usageSchema = z
  .object({
    input_tokens: z.number().int().nonnegative().optional(),
    output_tokens: z.number().int().nonnegative().optional(),
    total_tokens: z.number().int().nonnegative().optional(),
    prompt_tokens: z.number().int().nonnegative().optional(),
    completion_tokens: z.number().int().nonnegative().optional(),
    total_input_tokens: z.number().int().nonnegative().optional(),
    total_output_tokens: z.number().int().nonnegative().optional(),
  })
  .loose();

const responsesSchema = z
  .object({
    output: z.array(
      z
        .object({
          content: z.array(z.object({ type: z.string(), text: z.string().optional() }).loose()).optional(),
        })
        .loose(),
    ),
    usage: usageSchema.optional(),
  })
  .loose();

const chatSchema = z
  .object({
    choices: z.array(
      z.object({ message: z.object({ content: z.string() }).loose() }).loose(),
    ).min(1),
    usage: usageSchema.optional(),
  })
  .loose();

const anthropicSchema = z
  .object({
    content: z.array(z.object({ type: z.string(), text: z.string().optional() }).loose()),
    usage: usageSchema.optional(),
  })
  .loose();

const geminiSchema = z
  .object({
    steps: z.array(
      z
        .object({
          type: z.string(),
          content: z.array(z.object({ type: z.string(), text: z.string().optional() }).loose()).optional(),
        })
        .loose(),
    ),
    usage: usageSchema.optional(),
  })
  .loose();

export function parseProviderResponse(invocation: ModelInvocation, value: unknown): ModelCompletion {
  const transport = providerTransport(invocation.provider.kind);
  let text: string;
  let usage: z.infer<typeof usageSchema> | undefined;
  if (transport === "responses") {
    const response = responsesSchema.parse(value);
    text = response.output.flatMap((item) => item.content ?? []).flatMap((item) => item.text ?? []).join("");
    usage = response.usage;
  } else if (transport === "chat-completions") {
    const response = chatSchema.parse(value);
    text = response.choices[0]?.message.content ?? "";
    usage = response.usage;
  } else if (transport === "messages") {
    const response = anthropicSchema.parse(value);
    text = response.content.flatMap((item) => item.text ?? []).join("");
    usage = response.usage;
  } else {
    const response = geminiSchema.parse(value);
    text = response.steps
      .filter((step) => step.type === "model_output")
      .flatMap((step) => step.content ?? [])
      .flatMap((item) => item.text ?? [])
      .join("");
    usage = response.usage;
  }
  if (text === "") throw new Error(`${invocation.provider.kind} returned no text output`);
  return parseModelCompletion({
    providerId: invocation.provider.id,
    providerKind: invocation.provider.kind,
    model: invocation.provider.model,
    text,
    usage: {
      inputTokens: usage?.input_tokens ?? usage?.prompt_tokens ?? usage?.total_input_tokens,
      outputTokens: usage?.output_tokens ?? usage?.completion_tokens ?? usage?.total_output_tokens,
      totalTokens: usage?.total_tokens,
    },
  });
}
