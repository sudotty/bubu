import { describe, expect, it } from "vitest";
import type { ArtifactTableActionInput } from "@bubu/contracts";
import { artifactCsv, artifactFileName, artifactHtmlReport, artifactTsv } from "./artifact-api.js";

const input: ArtifactTableActionInput = { title: "Q3: Sales / APAC. ", columns: ["Region", "Amount"], rows: [["North", 12], ["=cmd", "a,b"], ["line\nbreak", null]] };

describe("artifact table serialization", () => {
  it("exports valid CSV and prevents spreadsheet formula execution", () => {
    expect(artifactCsv(input)).toBe("Region,Amount\r\nNorth,12\r\n'=cmd,\"a,b\"\r\n\"line\nbreak\",");
  });

  it("copies a flattened TSV view and sanitizes the filename", () => {
    expect(artifactTsv(input)).toContain("' =cmd".replace(" ", ""));
    expect(artifactTsv(input)).toContain("line break");
    expect(artifactFileName(input.title)).toBe("Q3- Sales - APAC.csv");
  });

  it("creates a standalone local report and escapes untrusted cell content", () => {
    const report = artifactHtmlReport({ ...input, rows: [["<script>alert(1)</script>", 2]] });
    expect(report).toContain("BuBu 本地轻报告");
    expect(report).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(report).not.toContain("<script>alert(1)</script>");
  });
});
