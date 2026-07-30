import type { ExplicitRowDisclosurePreview } from "@bubu/contracts";

export interface ExplicitRowDisclosureFacts {
  readonly rowCount: number;
  readonly columnCount: number;
  readonly cellCount: number;
  readonly payloadBytes: number;
  readonly rowNumbers: readonly number[];
  readonly columns: readonly string[];
  readonly fingerprintPrefix: string;
}

export function explicitRowDisclosureFacts(preview: ExplicitRowDisclosurePreview): ExplicitRowDisclosureFacts {
  return {
    rowCount: preview.rows.length,
    columnCount: preview.selection.columns.length,
    cellCount: preview.cellCount,
    payloadBytes: preview.payloadBytes,
    rowNumbers: [...preview.selection.rowNumbers],
    columns: [...preview.selection.columns],
    fingerprintPrefix: preview.payloadSha256.slice(0, 16),
  };
}
