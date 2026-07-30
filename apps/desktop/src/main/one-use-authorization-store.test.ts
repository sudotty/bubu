import { describe, expect, it } from "vitest";
import { createOneUseAuthorizationStore } from "./one-use-authorization-store.js";

const errors = { allocationError: "duplicate", consumeError: "expired or used" } as const;

describe("one-use authorization lifecycle", () => {
  it("consumes an exact value once and treats the expiry instant as expired", () => {
    let now = 100;
    const store = createOneUseAuthorizationStore({ now: () => now, newToken: () => "token", lifetimeMilliseconds: 10, maximumSessions: 2, ...errors });
    expect(store.issue({ exact: 1 })).toEqual({ token: "token", expiresAt: 110 });
    expect(store.consume("token")).toEqual({ exact: 1 });
    expect(() => store.consume("token")).toThrow("expired or used");
    store.issue({ exact: 2 }); now = 110;
    expect(() => store.consume("token")).toThrow("expired or used");
  });

  it("evicts the oldest live authorization at a fixed capacity", () => {
    let token = 0;
    const store = createOneUseAuthorizationStore({ now: () => 0, newToken: () => String(++token), lifetimeMilliseconds: 10, maximumSessions: 2, ...errors });
    store.issue("first"); store.issue("second"); store.issue("third");
    expect(() => store.consume("1")).toThrow();
    expect(store.consume("2")).toBe("second");
    expect(store.consume("3")).toBe("third");
  });
});
