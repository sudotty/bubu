import { parsePortableRendererPreferences, type VisualizationPreference } from "../shared/product-api.js";

const storageKey = "bubu:visualization-preferences:v1";
const maximumPreferences = 24;

function parsePreferences(value: unknown): readonly VisualizationPreference[] {
  if (!Array.isArray(value) || value.length > maximumPreferences) return [];
  const preferences: VisualizationPreference[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    if (Object.keys(record).sort().join(",") !== "signature,valueLabel" || typeof record.signature !== "string" || record.signature.length < 1 || record.signature.length > 2_000 || typeof record.valueLabel !== "string" || record.valueLabel.length < 1 || record.valueLabel.length > 500) return [];
    preferences.push({ signature: record.signature, valueLabel: record.valueLabel });
  }
  return new Set(preferences.map(({ signature }) => signature)).size === preferences.length ? preferences : [];
}

export function readVisualizationPreferences(storage: Pick<Storage, "getItem">): readonly VisualizationPreference[] {
  try {
    return parsePreferences(JSON.parse(storage.getItem(storageKey) ?? "[]") as unknown);
  } catch {
    return [];
  }
}

export function writeVisualizationPreferences(storage: Pick<Storage, "setItem">, preferences: readonly VisualizationPreference[]): void {
  const parsed = parsePortableRendererPreferences({
    promptTemplates: { schemaVersion: 1, customTemplates: [], selected: {} },
    visualizationPreferences: preferences,
  }).visualizationPreferences;
  storage.setItem(storageKey, JSON.stringify(parsed));
}

export function visualizationSchemaSignature(columns: readonly { readonly label: string; readonly type: string }[]): string {
  return JSON.stringify(columns.map(({ label, type }) => [label.slice(0, 500), type]));
}

export function preferredVisualizationMetric(storage: Pick<Storage, "getItem">, signature: string): string | undefined {
  return readVisualizationPreferences(storage).find((preference) => preference.signature === signature)?.valueLabel;
}

export function savePreferredVisualizationMetric(storage: Pick<Storage, "getItem" | "setItem">, signature: string, valueLabel: string): void {
  if (!signature || signature.length > 2_000 || !valueLabel || valueLabel.length > 500) throw new Error("Visualization preference is invalid");
  const next = [{ signature, valueLabel }, ...readVisualizationPreferences(storage).filter((preference) => preference.signature !== signature)].slice(0, maximumPreferences);
  storage.setItem(storageKey, JSON.stringify(next));
}
