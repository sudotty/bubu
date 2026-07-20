import { describe, expect, it } from "vitest";
import { parseProductMetricInput } from "./product-metrics.js";

describe("product metric boundary", () => {
  it("accepts only bounded operational metadata", () => {
    expect(parseProductMetricInput({ name: "task_result_ready", targetKind: "dataset", outcome: "succeeded", durationMs: 42, rowCount: 10, columnCount: 2 })).toMatchObject({ rowCount: 10 });
  });

  it.each(["question", "prompt", "modelOutput", "filePath", "rowValue", "threadId"])("rejects content-like field %s", (field) => {
    expect(() => parseProductMetricInput({ name: "artifact_opened", [field]: "secret" })).toThrow();
  });
});
