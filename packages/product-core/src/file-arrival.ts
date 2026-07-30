import type { DatasetSummary, FileArrivalCandidate, SourceInspection } from "@bubu/contracts";

export interface FileArrivalDatasetProfile { readonly datasetId: string; readonly columns: readonly string[]; readonly rowCount: number }

function normalizedStem(value: string): string {
  return value.toLocaleLowerCase("en-US").replace(/\.(csv|tsv|xlsx)$/u, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function sourceKind(fileName: string): "csv" | "xlsx" | undefined {
  const extension = fileName.toLocaleLowerCase("en-US").split(".").pop();
  return extension === "xlsx" ? "xlsx" : extension === "csv" || extension === "tsv" ? "csv" : undefined;
}

export function recommendFileArrivalTargets(fileName: string, datasets: readonly DatasetSummary[], inspection?: SourceInspection, profiles: readonly FileArrivalDatasetProfile[] = []): readonly FileArrivalCandidate[] {
  const incomingKind = sourceKind(fileName);
  if (!incomingKind) return [];
  const incomingStem = normalizedStem(fileName);
  return datasets.flatMap((dataset): FileArrivalCandidate[] => {
    if (dataset.sourceKind !== incomingKind) return [];
    if (dataset.sourceName.toLocaleLowerCase("en-US") === fileName.toLocaleLowerCase("en-US")) {
      return [{ datasetId: dataset.id, displayName: dataset.displayName, reason: "source-name", confidence: "high" }];
    }
    const sourceStem = normalizedStem(dataset.sourceName);
    const displayStem = normalizedStem(dataset.displayName);
    if (sourceStem && (incomingStem.includes(sourceStem) || sourceStem.includes(incomingStem))) {
      return [{ datasetId: dataset.id, displayName: dataset.displayName, reason: "source-name", confidence: "medium" }];
    }
    if (displayStem && (incomingStem.includes(displayStem) || displayStem.includes(incomingStem))) {
      return [{ datasetId: dataset.id, displayName: dataset.displayName, reason: "display-name", confidence: "medium" }];
    }
    return [{ datasetId: dataset.id, displayName: dataset.displayName, reason: "source-kind", confidence: "low" }];
  }).map((candidate): FileArrivalCandidate => {
    if (!inspection) return candidate;
    const profile = profiles.find(({ datasetId }) => datasetId === candidate.datasetId);
    if (!profile) return candidate;
    const exactSchema = inspection.tables.some((table) => table.columns.length === profile.columns.length && table.columns.every((column, index) => column === profile.columns[index]));
    if (!exactSchema) return candidate.confidence === "high" ? { ...candidate, confidence: "medium" } : candidate;
    const incomingRows = inspection.tables.find((table) => table.columns.length === profile.columns.length && table.columns.every((column, index) => column === profile.columns[index]))?.rowCount ?? 0;
    const ratio = profile.rowCount === 0 ? (incomingRows === 0 ? 1 : Number.POSITIVE_INFINITY) : incomingRows / profile.rowCount;
    return { ...candidate, reason: "schema-profile", confidence: ratio >= 0.1 && ratio <= 10 ? "high" : "medium" };
  }).sort((left, right) => {
    const rank = { high: 0, medium: 1, low: 2 } as const;
    return rank[left.confidence] - rank[right.confidence] || left.displayName.localeCompare(right.displayName);
  }).slice(0, 5);
}
