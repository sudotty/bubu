import { describe, expect, it } from "vitest";
import { createOperationRegistry } from "./operation-registry.js";

const operationId = "123e4567-e89b-42d3-a456-426614174000";

describe("desktop operation registry", () => {
  it("aborts a named active operation and releases its identity", async () => {
    const registry = createOperationRegistry();
    const active = registry.run(operationId, (signal) => new Promise<never>((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true });
    }));
    expect(registry.cancel(operationId)).toBe(true);
    await expect(active).rejects.toThrow("cancelled");
    expect(registry.cancel(operationId)).toBe(false);
    await expect(registry.run(operationId, async () => "reused")).resolves.toBe("reused");
  });

  it("rejects concurrent reuse of one operation identity", async () => {
    const registry = createOperationRegistry();
    let release: (() => void) | undefined;
    const active = registry.run(operationId, () => new Promise<void>((resolve) => { release = resolve; }));
    await expect(registry.run(operationId, async () => undefined)).rejects.toThrow("already active");
    release?.();
    await active;
  });
});
