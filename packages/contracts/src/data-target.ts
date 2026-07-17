import { z } from "zod";
import { datasetGroupIdSchema } from "./dataset-group.js";
import { datasetIdSchema } from "./dataset.js";

export const dataTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("dataset"), id: datasetIdSchema }).strict(),
  z.object({ kind: z.literal("group"), id: datasetGroupIdSchema }).strict(),
]);

export type DataTarget = z.infer<typeof dataTargetSchema>;
