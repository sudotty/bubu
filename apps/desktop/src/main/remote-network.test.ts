import type { LookupAddress } from "node:dns";
import type { LookupFunction } from "node:net";
import { describe, expect, it } from "vitest";
import { createPinnedLookup } from "./remote-network.js";

function lookupAll(lookup: LookupFunction, hostname: string, family = 0): Promise<readonly LookupAddress[]> {
  return new Promise((resolve, reject) => {
    lookup(hostname, { all: true, family }, (error, value) => {
      if (error) reject(error);
      else if (Array.isArray(value)) resolve(value);
      else reject(new Error("Pinned lookup did not return all requested addresses"));
    });
  });
}

describe("public remote network binding", () => {
  it("returns only the previously validated addresses to the outbound socket", async () => {
    const lookup = createPinnedLookup("api.example.com", ["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"]);
    await expect(lookupAll(lookup, "api.example.com", 4)).resolves.toEqual([{ address: "93.184.216.34", family: 4 }]);
    await expect(lookupAll(lookup, "api.example.com", 6)).resolves.toEqual([{ address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 }]);
  });

  it("fails closed if the dispatcher asks for a different hostname", async () => {
    const lookup = createPinnedLookup("api.example.com", ["93.184.216.34"]);
    await expect(lookupAll(lookup, "rebound.example.com")).rejects.toThrow("unexpected hostname");
  });
});
