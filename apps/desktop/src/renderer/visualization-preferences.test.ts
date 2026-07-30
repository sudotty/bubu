import { describe, expect, it } from "vitest";
import { preferredVisualizationMetric, savePreferredVisualizationMetric, visualizationSchemaSignature } from "./visualization-preferences.js";

function memoryStorage(initial: string | null = null) {
  let value = initial;
  return { getItem: () => value, setItem: (_key: string, next: string) => { value = next; } };
}

describe("local visualization preferences", () => {
  it("remembers one metric by bounded result schema without storing values", () => {
    const storage = memoryStorage();
    const signature = visualizationSchemaSignature([{ label: "Region", type: "text" }, { label: "Revenue", type: "real" }]);
    savePreferredVisualizationMetric(storage, signature, "Revenue");
    expect(preferredVisualizationMetric(storage, signature)).toBe("Revenue");
    expect(storage.getItem()).not.toContain("North");
  });

  it("fails malformed or duplicate persisted state closed", () => {
    expect(preferredVisualizationMetric(memoryStorage("not-json"), "schema")).toBeUndefined();
    expect(preferredVisualizationMetric(memoryStorage(JSON.stringify([{ signature: "schema", valueLabel: "A" }, { signature: "schema", valueLabel: "B" }])), "schema")).toBeUndefined();
  });
});
