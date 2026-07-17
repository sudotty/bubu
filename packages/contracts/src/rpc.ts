import { z } from "zod";

export const PROTOCOL_VERSION = 1 as const;

const rpcIdSchema = z.string().min(1).max(128);
const rpcMethodSchema = z.string().regex(/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/u);
const rpcParamsSchema = z.record(z.string(), z.unknown());

export const rpcRequestSchema = z.object({
  protocolVersion: z.literal(PROTOCOL_VERSION),
  auth: z.string().min(32).max(512),
  id: rpcIdSchema,
  method: rpcMethodSchema,
  params: rpcParamsSchema,
});

const rpcErrorSchema = z.object({
  code: z.string().min(1).max(128),
  message: z.string().min(1).max(2_000),
  retryable: z.boolean(),
});

export const rpcSuccessResponseSchema = z.object({
  protocolVersion: z.literal(PROTOCOL_VERSION),
  id: rpcIdSchema,
  ok: z.literal(true),
  result: z.unknown(),
});

export const rpcErrorResponseSchema = z.object({
  protocolVersion: z.literal(PROTOCOL_VERSION),
  id: rpcIdSchema,
  ok: z.literal(false),
  error: rpcErrorSchema,
});

export const rpcResponseSchema = z.discriminatedUnion("ok", [
  rpcSuccessResponseSchema,
  rpcErrorResponseSchema,
]);

export type RpcRequest = z.infer<typeof rpcRequestSchema>;
export type RpcResponse = z.infer<typeof rpcResponseSchema>;
export type RpcErrorResponse = z.infer<typeof rpcErrorResponseSchema>;

export function parseRpcRequest(value: unknown): RpcRequest {
  return rpcRequestSchema.parse(value);
}

export function parseRpcResponse(value: unknown): RpcResponse {
  return rpcResponseSchema.parse(value);
}

export function createRpcRequest(input: Omit<RpcRequest, "protocolVersion">): RpcRequest {
  return parseRpcRequest({ protocolVersion: PROTOCOL_VERSION, ...input });
}

export function createRpcSuccess(id: string, result: unknown): RpcResponse {
  return rpcSuccessResponseSchema.parse({
    protocolVersion: PROTOCOL_VERSION,
    id,
    ok: true,
    result,
  });
}

export function createRpcError(
  id: string,
  code: string,
  message: string,
  retryable = false,
): RpcErrorResponse {
  return rpcErrorResponseSchema.parse({
    protocolVersion: PROTOCOL_VERSION,
    id,
    ok: false,
    error: { code, message, retryable },
  });
}
