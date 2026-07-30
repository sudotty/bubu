import { describe, expect, it } from "vitest";
import {
  parseExplicitRowDisclosureApproval,
  parseExplicitRowExplanationText,
  parseExplicitRowDisclosurePreview,
  parseExplicitRowDisclosureSelection,
} from "./explicit-row-disclosure.js";

const selection = {
  schemaVersion: 1,
  datasetId: "a".repeat(32),
  versionId: "b".repeat(32),
  purpose: "解释两条退款异常",
  rowNumbers: [2, 7],
  columns: ["Order ID", "Refund Amount"],
} as const;

describe("explicit raw-row disclosure contract", () => {
  it("accepts only an exact, unique and bounded row/column selection", () => {
    expect(parseExplicitRowDisclosureSelection(selection)).toEqual(selection);
    expect(() => parseExplicitRowDisclosureSelection({ ...selection, rowNumbers: [2, 2] })).toThrow("unique");
    expect(() => parseExplicitRowDisclosureSelection({ ...selection, columns: ["Order ID", "Order ID"] })).toThrow("unique");
    expect(() => parseExplicitRowDisclosureSelection({ ...selection, rowNumbers: [0] })).toThrow();
    expect(() => parseExplicitRowDisclosureSelection({ ...selection, columns: ["*"] })).toThrow();
    expect(() => parseExplicitRowDisclosureSelection({ ...selection, rowNumbers: Array.from({ length: 21 }, (_, index) => index + 1) })).toThrow();
  });

  it("binds the preview to exact cells and a deterministic payload digest", () => {
    const preview = {
      schemaVersion: 1,
      selection,
      columnTypes: ["text", "real"],
      rows: [
        { rowNumber: 2, cells: ["A-2", "10.25"] },
        { rowNumber: 7, cells: ["A-7", null] },
      ],
      cellCount: 4,
      payloadBytes: 155,
      payloadSha256: "c".repeat(64),
    } as const;
    expect(parseExplicitRowDisclosurePreview(preview)).toEqual(preview);
    expect(() => parseExplicitRowDisclosurePreview({ ...preview, cellCount: 5 })).toThrow("cell count");
    expect(() => parseExplicitRowDisclosurePreview({ ...preview, rows: [...preview.rows].reverse() })).toThrow("order");
    expect(() => parseExplicitRowDisclosurePreview({ ...preview, rows: [{ rowNumber: 2, cells: ["A-2"] }, preview.rows[1]] })).toThrow("width");
  });

  it("uses one opaque approval token without accepting copied disclosure content", () => {
    expect(parseExplicitRowDisclosureApproval({ approvalToken: "d".repeat(64) })).toEqual({ approvalToken: "d".repeat(64) });
    expect(() => parseExplicitRowDisclosureApproval({ approvalToken: "d".repeat(64), rows: selection.rowNumbers })).toThrow();
  });

  it("accepts only findings cited to an exactly disclosed cell", () => {
    const preview = parseExplicitRowDisclosurePreview({
      schemaVersion: 1, selection, columnTypes: ["text", "real"],
      rows: [{ rowNumber: 2, cells: ["A-2", "10.25"] }, { rowNumber: 7, cells: ["A-7", null] }],
      cellCount: 4, payloadBytes: 155, payloadSha256: "c".repeat(64),
    });
    const content = { schemaVersion: 1, summary: "第 2 行有退款金额。", findings: [{ title: "退款", detail: "金额为 10.25。", evidence: [{ rowNumber: 2, column: "Refund Amount" }] }], caveats: [] };
    expect(parseExplicitRowExplanationText(JSON.stringify(content), preview)).toMatchObject({ ...content, disclosure: preview });
    expect(() => parseExplicitRowExplanationText(JSON.stringify({ ...content, findings: [{ ...content.findings[0], evidence: [{ rowNumber: 3, column: "Refund Amount" }] }] }), preview)).toThrow("disclosed cell");
  });
});
