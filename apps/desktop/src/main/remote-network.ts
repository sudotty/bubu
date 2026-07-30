import { lookup } from "node:dns/promises";
import { isIP, type LookupFunction } from "node:net";
import { assertRemoteMcpNetworkTarget } from "@bubu/product-core";
import { Agent } from "undici";

interface DispatcherRequestInit extends RequestInit {
  readonly dispatcher: Agent;
}

function normalizedHostname(value: string): string {
  return value.toLowerCase().replace(/\.$/u, "");
}

export function createPinnedLookup(expectedHostname: string, addresses: readonly string[]): LookupFunction {
  const expected = normalizedHostname(expectedHostname);
  const records = [...new Set(addresses)].map((address) => ({ address, family: isIP(address) }));
  if (records.length === 0 || records.some(({ family }) => family === 0)) throw new Error("Public target did not resolve to valid IP addresses");
  return (hostname, options, callback) => {
    if (normalizedHostname(hostname) !== expected) {
      callback(Object.assign(new Error("Pinned DNS lookup received an unexpected hostname"), { code: "ENOTFOUND" }), "", 0);
      return;
    }
    const family = options.family ?? 0;
    const eligible = family === 0 ? records : records.filter((record) => record.family === family);
    if (eligible.length === 0) {
      callback(Object.assign(new Error("Pinned DNS lookup has no address for the requested family"), { code: "ENOTFOUND" }), "", 0);
      return;
    }
    if (options.all) callback(null, eligible);
    else callback(null, eligible[0]!.address, eligible[0]!.family);
  };
}

export async function fetchResolvedPublicTarget(urlValue: string, addresses: readonly string[], init: RequestInit): Promise<Response> {
  const url = new URL(urlValue);
  assertRemoteMcpNetworkTarget(url.toString(), addresses);
  const dispatcher = new Agent({ connect: { lookup: createPinnedLookup(url.hostname, addresses) } });
  try {
    const response = await fetch(url, { ...init, redirect: "manual", dispatcher } as DispatcherRequestInit);
    void dispatcher.close();
    return response;
  } catch (error) {
    await dispatcher.close();
    throw error;
  }
}

export async function resolvePublicRemoteTarget(urlValue: string): Promise<readonly string[]> {
  const url = new URL(urlValue);
  const addresses = (await lookup(url.hostname, { all: true, verbatim: true })).map(({ address }) => address);
  assertRemoteMcpNetworkTarget(url.toString(), addresses);
  return addresses;
}

export async function postOAuthToken(urlValue: string, body: URLSearchParams, signal?: AbortSignal): Promise<unknown> {
  const addresses = await resolvePublicRemoteTarget(urlValue);
  const boundedSignal = signal ?? AbortSignal.timeout(30_000);
  const response = await fetchResolvedPublicTarget(urlValue, addresses, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body, signal: boundedSignal });
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get("location");
    if (location) await resolvePublicRemoteTarget(new URL(location, urlValue).toString());
    throw new Error("OAuth token endpoint redirects are not accepted");
  }
  if (!response.ok) throw new Error(`OAuth token exchange failed with HTTP ${response.status}`);
  const text = await response.text();
  if (text.length > 64 * 1024) throw new Error("OAuth token response exceeds 64 KiB");
  return JSON.parse(text) as unknown;
}
