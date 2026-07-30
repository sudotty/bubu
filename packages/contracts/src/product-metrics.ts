import { z } from "zod";

export const productMetricNameSchema = z.enum([
  "task_question_submitted", "task_plan_ready", "task_plan_approved", "task_result_ready",
  "task_recovery_selected", "artifact_opened", "artifact_copied", "artifact_exported", "artifact_pinned",
  "workspace_demo_opened", "data_clean_previewed", "data_clean_result_ready", "reviewed_rule_replayed",
  "reconciliation_previewed", "reconciliation_result_ready",
  "file_arrival_detected", "file_arrival_target_suggested", "file_arrival_review_required", "file_arrival_folder_approved",
  "replacement_version_approved", "recurring_run_started", "recurring_run_paused", "recurring_run_recovered", "recurring_run_result_ready",
  "report_bundle_exported", "next_cycle_returned",
]);

export const productMetricInputSchema = z.object({
  name: productMetricNameSchema,
  targetKind: z.enum(["dataset", "group"]).optional(),
  outcome: z.enum(["started", "succeeded", "failed", "cancelled"]).optional(),
  durationMs: z.number().int().nonnegative().max(86_400_000).optional(),
  rowCount: z.number().int().nonnegative().max(1_000_000).optional(),
  columnCount: z.number().int().nonnegative().max(10_000).optional(),
}).strict();

export type ProductMetricInput = z.infer<typeof productMetricInputSchema>;
export type ProductMetricName = z.infer<typeof productMetricNameSchema>;

export function parseProductMetricInput(value: unknown): ProductMetricInput {
  return productMetricInputSchema.parse(value);
}
