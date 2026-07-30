import { z } from "zod";
import { datasetGroupSchema } from "./dataset-group.js";
import { datasetSummarySchema } from "./dataset.js";

export const demoWorkspaceIdSchema = z.enum(["retail-operations", "reconciliation-cases", "merge-exports"]);
export const demoWorkspaceImportResultSchema = z.object({
  demoId: demoWorkspaceIdSchema,
  datasets: z.array(datasetSummarySchema).min(3).max(4),
  group: datasetGroupSchema,
}).strict().superRefine((result, context) => {
  const expected = result.demoId === "reconciliation-cases" ? 4 : 3;
  if (result.datasets.length !== expected) context.addIssue({ code: "custom", path: ["datasets"], message: `Demo requires exactly ${expected} datasets` });
});

export type DemoWorkspaceId = z.infer<typeof demoWorkspaceIdSchema>;
export type DemoWorkspaceImportResult = z.infer<typeof demoWorkspaceImportResultSchema>;

export function parseDemoWorkspaceId(value: unknown): DemoWorkspaceId {
  return demoWorkspaceIdSchema.parse(value);
}

export function parseDemoWorkspaceImportResult(value: unknown): DemoWorkspaceImportResult {
  return demoWorkspaceImportResultSchema.parse(value);
}
