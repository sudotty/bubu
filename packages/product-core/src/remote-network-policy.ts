function ipv4Parts(value: string): readonly number[] | undefined {
  const parts = value.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/u.test(part))) return undefined;
  const numbers = parts.map(Number);
  return numbers.some((part) => part > 255) ? undefined : numbers;
}

function embeddedIPv4(value: string): string {
  const lastColon = value.lastIndexOf(":");
  if (lastColon < 0) return value;
  const parts = ipv4Parts(value.slice(lastColon + 1));
  if (!parts) return value;
  return `${value.slice(0, lastColon)}:${((parts[0]! << 8) | parts[1]!).toString(16)}:${((parts[2]! << 8) | parts[3]!).toString(16)}`;
}

function ipv6Parts(input: string): readonly number[] | undefined {
  const value = embeddedIPv4(input.toLowerCase().replace(/^\[|\]$/gu, ""));
  const halves = value.split("::");
  if (halves.length > 2) return undefined;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return undefined;
  const fields = [...left, ...Array.from({ length: missing }, () => "0"), ...right];
  if (fields.length !== 8 || fields.some((field) => !/^[a-f0-9]{1,4}$/u.test(field))) return undefined;
  return fields.map((field) => Number.parseInt(field, 16));
}

export function isPublicRemoteAddress(address: string): boolean {
  const v4 = ipv4Parts(address);
  if (v4) {
    const [a, b, c] = v4;
    if (a === 0 || a === 10 || a === 127 || a! >= 224) return false;
    if (a === 100 && b! >= 64 && b! <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b! >= 16 && b! <= 31) return false;
    if (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)))) return false;
    if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false;
    if (a === 203 && b === 0 && c === 113) return false;
    return true;
  }
  const v6 = ipv6Parts(address);
  if (!v6) return false;
  const [first, second] = v6;
  if (v6.slice(0, 7).every((part) => part === 0) && (v6[7] === 0 || v6[7] === 1)) return false;
  if (v6.slice(0, 5).every((part) => part === 0) && v6[5] === 0xffff) return isPublicRemoteAddress(`${v6[6]! >> 8}.${v6[6]! & 255}.${v6[7]! >> 8}.${v6[7]! & 255}`);
  if ((first! & 0xfe00) === 0xfc00 || (first! & 0xffc0) === 0xfe80 || (first! & 0xff00) === 0xff00) return false;
  if (first === 0x2001 && second === 0x0db8) return false;
  return (first! & 0xe000) === 0x2000;
}

export function assertRemoteMcpNetworkTarget(urlValue: string, resolvedAddresses: readonly string[]): void {
  const url = new URL(urlValue);
  if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new Error("Remote MCP target must be credential-free HTTPS without a fragment");
  const hostname = url.hostname.replace(/^\[|\]$/gu, "").replace(/\.$/u, "").toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) throw new Error("Remote MCP target hostname is local or private");
  if (resolvedAddresses.length === 0 || resolvedAddresses.some((address) => !isPublicRemoteAddress(address))) throw new Error("Remote MCP target resolved to a non-public address");
}
