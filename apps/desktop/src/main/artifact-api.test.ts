import { describe, expect, it } from "vitest";
import type { ArtifactTableActionInput } from "@bubu/contracts";
import { artifactCsv, artifactFileName, artifactTsv } from "./artifact-api.js";

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
});
