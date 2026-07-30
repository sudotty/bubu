import { describe, expect, it } from "vitest";
import { assertRemoteMcpNetworkTarget, isPublicRemoteAddress } from "./remote-network-policy.js";

describe("remote MCP network policy", () => {
  it("allows only public resolved addresses", () => {
    expect(isPublicRemoteAddress("93.184.216.34")).toBe(true);
    expect(isPublicRemoteAddress("2606:2800:220:1:248:1893:25c8:1946")).toBe(true);
    for (const address of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "172.16.0.1", "192.168.1.1", "100.64.0.1", "::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "2001:db8::1"]) expect(isPublicRemoteAddress(address)).toBe(false);
  });

  it("rechecks every URL against every DNS answer", () => {
    expect(() => assertRemoteMcpNetworkTarget("https://mcp.example.com/rpc", ["93.184.216.34"])).not.toThrow();
    expect(() => assertRemoteMcpNetworkTarget("https://mcp.example.com/rpc", ["93.184.216.34", "127.0.0.1"])).toThrow("non-public");
    expect(() => assertRemoteMcpNetworkTarget("https://localhost/rpc", ["93.184.216.34"])).toThrow("local");
  });
});
