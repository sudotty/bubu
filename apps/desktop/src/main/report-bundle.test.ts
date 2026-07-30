import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ReportBundleInput } from "@bubu/contracts";
import { unzipSync, strFromU8 } from "fflate";
import { reportCsv, reportHtml, reportWorkbook, writeReportBundle } from "./report-bundle.js";

const input: ReportBundleInput = {
  schemaVersion: 1, kind: "reconciliation", title: "August / Close", summary: "Reviewed deterministic result",
  deterministicFacts: [{ label: "Difference", value: 0 }], quality: [{ label: "Source quality", value: 98 }],
  tables: [{ name: "Exceptions", columns: ["Kind", "Value"], rows: [["Unmatched", 2], ["Formula", "=cmd"]] }],
  exceptions: ["Two unmatched rows"], limitations: ["Exact reviewed keys only"], lineage: [{ label: "Left version", value: "abc" }], runMetadata: [{ label: "Approval", value: "one-use" }], modelNarrative: "Optional model interpretation",
};

describe("professional report bundle serialization", () => {
  it("separates deterministic evidence from model narrative in standalone HTML", () => {
    const html = reportHtml(input);
    expect(html).toContain("确定性事实"); expect(html).toContain("模型叙述（非权威）"); expect(html).toContain("Optional model interpretation");
    expect(html).toContain("overflow-wrap:anywhere");
    expect(html).toContain("repeat(auto-fit,minmax(220px,1fr))");
    expect(html).not.toContain("<script>");
  });

  it("creates an Excel-safe CSV", () => {
    expect(reportCsv(input.tables[0]!)).toContain("'=cmd");
  });

  it("creates a valid multi-sheet OOXML package", () => {
    const files = unzipSync(reportWorkbook(input));
    expect(Object.keys(files)).toContain("xl/worksheets/sheet1.xml");
    expect(Object.keys(files)).toContain("xl/worksheets/sheet2.xml");
    expect(Object.keys(files)).toContain("xl/styles.xml");
    expect(strFromU8(files["xl/workbook.xml"]!)).toContain("Summary");
    const summary = strFromU8(files["xl/worksheets/sheet1.xml"]!);
    const evidence = strFromU8(files["xl/worksheets/sheet2.xml"]!);
    expect(summary).toContain("<cols>");
    expect(summary).toContain('state="frozen"');
    expect(evidence).toContain("&apos;=cmd");
    expect(evidence).toContain("<autoFilter");
    expect(evidence).toContain('s="2"');
  });

  it("atomically publishes HTML, PDF, XLSX, CSV and a hash manifest", async () => {
    const parent = await mkdtemp(join(tmpdir(), "bubu-report-"));
    const result = await writeReportBundle(input, parent, async (_htmlPath, pdfPath) => writeFile(pdfPath, "%PDF-1.4\n% local test\n", { mode: 0o600 }), () => new Date("2026-08-01T00:00:00.000Z"));
    expect(result.fileCount).toBe(5);
    const names = await readdir(join(parent, result.bundleName));
    expect(names.toSorted()).toEqual(["01-Exceptions.csv", "manifest.json", "report.html", "report.pdf", "report.xlsx"]);
    const manifest = JSON.parse(await readFile(join(parent, result.bundleName, "manifest.json"), "utf8")) as { generatedAt: string; files: readonly { name: string; sha256: string }[] };
    expect(manifest.generatedAt).toBe("2026-08-01T00:00:00.000Z");
    expect(manifest.files.every(({ sha256 }) => /^[0-9a-f]{64}$/u.test(sha256))).toBe(true);
  });
});
