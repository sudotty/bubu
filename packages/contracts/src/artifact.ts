import { z } from "zod";

const artifactCellSchema = z.union([z.string().max(100_000), z.number().finite(), z.boolean(), z.null()]);

export const artifactTableActionInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  columns: z.array(z.string().trim().min(1).max(500)).min(1).max(64),
  rows: z.array(z.array(artifactCellSchema).max(64)).max(200),
}).strict().superRefine((input, context) => {
  input.rows.forEach((row, index) => {
    if (row.length !== input.columns.length) context.addIssue({ code: "custom", path: ["rows", index], message: "Artifact row width must match columns" });
  });
});

export const artifactCopyResultSchema = z.object({ status: z.literal("copied"), rowCount: z.number().int().nonnegative() }).strict();
export const artifactExportResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("exported"), rowCount: z.number().int().nonnegative() }).strict(),
  z.object({ status: z.literal("cancelled") }).strict(),
]);

export type ArtifactTableActionInput = z.infer<typeof artifactTableActionInputSchema>;
export type ArtifactCopyResult = z.infer<typeof artifactCopyResultSchema>;
export type ArtifactExportResult = z.infer<typeof artifactExportResultSchema>;

export function parseArtifactTableActionInput(value: unknown): ArtifactTableActionInput {
  return artifactTableActionInputSchema.parse(value);
}
