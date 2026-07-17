import { describe, expect, it, vi } from "vitest";
import { createRpcSuccess } from "@bubu/contracts";
import { RpcRequestBroker } from "./rpc-broker.js";

const auth = "a".repeat(64);

describe("RPC request broker", () => {
  it("matches a response to its pending request", async () => {
    const sent: unknown[] = [];
    const broker = new RpcRequestBroker(auth, (message) => sent.push(message), 1_000);

    const pending = broker.request("system.health", {});
    const request = sent[0];
    if (!request || typeof request !== "object" || !("id" in request)) {
      throw new Error("request was not sent");
    }
    broker.accept(createRpcSuccess(String(request.id), { status: "ready" }));

    await expect(pending).resolves.toEqual({ status: "ready" });
  });

  it("rejects requests that exceed their deadline", async () => {
    vi.useFakeTimers();
    const sent: unknown[] = [];
    const broker = new RpcRequestBroker(auth, (message) => sent.push(message), 50);
    const pending = broker.request("system.health", {});
    const expectation = expect(pending).rejects.toThrow("timed out");

    await vi.advanceTimersByTimeAsync(51);
    await expectation;
    expect(sent).toHaveLength(2);
    expect(sent[1]).toMatchObject({ method: "system.cancel" });
    vi.useRealTimers();
  });

  it("sends an authenticated cancellation control request for an aborted operation", async () => {
    const sent: unknown[] = [];
    const controller = new AbortController();
    const broker = new RpcRequestBroker(auth, (message) => sent.push(message), 1_000);
    const pending = broker.request("dataset.import.batch", {}, { signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(sent).toHaveLength(2);
    expect(sent[1]).toMatchObject({
      auth,
      method: "system.cancel",
      params: { requestId: expect.any(String) },
    });
  });

  it("rejects all pending work when its sidecar exits", async () => {
    const broker = new RpcRequestBroker(auth, () => undefined, 1_000);
    const pending = broker.request("system.health", {});
    broker.close(new Error("sidecar exited"));

    await expect(pending).rejects.toThrow("sidecar exited");
  });
});
