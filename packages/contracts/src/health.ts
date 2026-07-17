import { z } from "zod";

export const serviceNameSchema = z.enum(["ai-runtime", "data-core"]);

export const serviceHealthSchema = z.object({
  service: serviceNameSchema,
  protocolVersion: z.literal(1),
  status: z.enum(["ready", "degraded"]),
  capabilities: z.array(z.string()).readonly(),
});

export type ServiceHealth = z.infer<typeof serviceHealthSchema>;

export function parseServiceHealth(value: unknown): ServiceHealth {
  return serviceHealthSchema.parse(value);
}
