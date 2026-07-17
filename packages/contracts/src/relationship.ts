import { z } from "zod";
import { datasetGroupIdSchema } from "./dataset-group.js";
import { datasetIdSchema } from "./dataset.js";

export const relationshipIdSchema = z.string().regex(/^[0-9a-f]{32}$/u);
const columnNameSchema = z.string().min(1).max(500);

export const relationshipEndpointSchema = z
  .object({ datasetId: datasetIdSchema, column: columnNameSchema })
  .strict();

export const datasetRelationshipSaveInputSchema = z
  .object({
    left: relationshipEndpointSchema,
    right: relationshipEndpointSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.left.datasetId === value.right.datasetId) {
      context.addIssue({ code: "custom", message: "A relationship needs two different datasets" });
    }
  });

export const datasetRelationshipSchema = z
  .object({
    id: relationshipIdSchema,
    kind: z.literal("lookup"),
    left: relationshipEndpointSchema,
    right: relationshipEndpointSchema,
    status: z.enum(["ready", "invalid"]),
    issue: z.enum(["missing-column", "type-mismatch", "right-not-unique"]).nullable(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.status === "ready") !== (value.issue === null)) {
      context.addIssue({ code: "custom", path: ["issue"], message: "Ready relationships cannot have an issue" });
    }
  });

export const relationshipCandidateSchema = z
  .object({
    left: relationshipEndpointSchema,
    right: relationshipEndpointSchema,
    reason: z.literal("same-name-unique-right"),
  })
  .strict();

export const groupRelationshipOverviewSchema = z
  .object({
    groupId: datasetGroupIdSchema,
    relationships: z.array(datasetRelationshipSchema).max(100),
    candidates: z.array(relationshipCandidateSchema).max(500),
  })
  .strict();

export const relationshipHintSchema = z
  .object({
    leftSourceIndex: z.number().int().min(0).max(7),
    leftColumn: columnNameSchema,
    rightSourceIndex: z.number().int().min(0).max(7),
    rightColumn: columnNameSchema,
  })
  .strict();

export const relationshipDeletionResultSchema = z.object({ deleted: z.literal(true) }).strict();

export type RelationshipId = z.infer<typeof relationshipIdSchema>;
export type RelationshipEndpoint = z.infer<typeof relationshipEndpointSchema>;
export type DatasetRelationshipSaveInput = z.infer<typeof datasetRelationshipSaveInputSchema>;
export type DatasetRelationship = z.infer<typeof datasetRelationshipSchema>;
export type RelationshipCandidate = z.infer<typeof relationshipCandidateSchema>;
export type GroupRelationshipOverview = z.infer<typeof groupRelationshipOverviewSchema>;
export type RelationshipHint = z.infer<typeof relationshipHintSchema>;

export function parseRelationshipId(value: unknown): RelationshipId {
  return relationshipIdSchema.parse(value);
}

export function parseDatasetRelationshipSaveInput(value: unknown): DatasetRelationshipSaveInput {
  return datasetRelationshipSaveInputSchema.parse(value);
}

export function parseDatasetRelationship(value: unknown): DatasetRelationship {
  return datasetRelationshipSchema.parse(value);
}

export function parseGroupRelationshipOverview(value: unknown): GroupRelationshipOverview {
  return groupRelationshipOverviewSchema.parse(value);
}

export function parseRelationshipDeletionResult(value: unknown): { readonly deleted: true } {
  return relationshipDeletionResultSchema.parse(value);
}
