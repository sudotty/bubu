import { describe, expect, it } from "vitest";
import {
  PROTOCOL_VERSION,
  createRpcRequest,
  parseRpcRequest,
  parseRpcResponse,
} from "./rpc.js";

const token = "a".repeat(64);

describe("RPC boundary", () => {
  it("creates and parses a versioned authenticated request", () => {
    const request = createRpcRequest({
      auth: token,
      id: "request-1",
      method: "system.health",
      params: {},
    });

    expect(request.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(parseRpcRequest(request)).toEqual(request);
  });

  it("rejects an unsupported protocol version", () => {
    expect(() =>
      parseRpcRequest({
        auth: token,
        id: "request-1",
        method: "system.health",
        params: {},
        protocolVersion: PROTOCOL_VERSION + 1,
      }),
    ).toThrow();
  });

  it("rejects malformed success and error responses", () => {
    expect(() =>
      parseRpcResponse({
        id: "request-1",
        ok: true,
        protocolVersion: PROTOCOL_VERSION,
      }),
    ).toThrow();

    expect(() =>
      parseRpcResponse({
        error: { code: "BAD", message: "bad" },
        id: "request-1",
        ok: false,
        protocolVersion: PROTOCOL_VERSION,
        result: {},
      }),
    ).toThrow();
  });
});
