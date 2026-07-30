function normalizeJson(value: unknown, ancestors: Set<object>): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Canonical JSON numbers must be finite");
    return value;
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) throw new Error("Canonical JSON must not contain cycles");
    ancestors.add(value);
    const normalized = value.map((entry) => normalizeJson(entry, ancestors));
    ancestors.delete(value);
    return normalized;
  }
  if (typeof value === "object") {
    if (ancestors.has(value)) throw new Error("Canonical JSON must not contain cycles");
    ancestors.add(value);
    const record = value as Record<string, unknown>;
    const normalized = Object.fromEntries(Object.keys(record).sort().map((key) => [key, normalizeJson(record[key], ancestors)]));
    ancestors.delete(value);
    return normalized;
  }
  throw new Error("Canonical JSON accepts JSON-compatible values only");
}

/** Deterministic, recursively key-sorted JSON for hashes and signatures. */
export const canonicalJson = (value: unknown): string => JSON.stringify(normalizeJson(value, new Set()));
