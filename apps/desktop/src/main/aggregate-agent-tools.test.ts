import { describe, expect, it } from "vitest";
import type { AggregateDisclosure } from "@bubu/contracts";
import { executeAggregateAgentTool } from "./aggregate-agent-tools.js";

const disclosure: AggregateDisclosure = {
  schemaVersion: 1,
  target: { kind: "dataset", id: "a".repeat(32) },
  question: "Find the important differences",
  purpose: "Regional totals",
  sourceCount: 1,
  columns: [
    { label: "Region", type: "text" },
    { label: "sum(Amount)", type: "real" },
    { label: "count(*)", type: "integer" },
  ],
  rows: [["North", 1200, 8], ["South", 900, 6], ["West", 600, 5]],
  truncated: false,
  minimumGroupSize: 5,
};

describe("bounded aggregate agent tools", () => {
  it("ranks only numeric cells from one approved column with stable row references", () => {
    expect(executeAggregateAgentTool(disclosure, {
      name: "rank",
      input: { columnIndex: 1, direction: "descending", limit: 2 },
    })).toEqual({
      name: "rank",
      input: { columnIndex: 1, direction: "descending", limit: 2 },
      output: { ranked: [
        { rowIndex: 0, columnIndex: 1, value: 1200 },
        { rowIndex: 1, columnIndex: 1, value: 900 },
      ] },
    });
  });

  it("compares two approved numeric cells without exposing their surrounding rows", () => {
    const observation = executeAggregateAgentTool(disclosure, {
      name: "compare",
      input: {
        left: { rowIndex: 0, columnIndex: 1 },
        right: { rowIndex: 1, columnIndex: 1 },
      },
    });
    expect(observation).toMatchObject({
      name: "compare",
      output: {
        left: { rowIndex: 0, columnIndex: 1, value: 1200 },
        right: { rowIndex: 1, columnIndex: 1, value: 900 },
        difference: 300,
      },
    });
    if (observation.name !== "compare") throw new Error("unexpected observation");
    expect(observation.output.percentDifference).toBeCloseTo(33.3333333333);
  });

  it("summarizes one approved numeric column deterministically", () => {
    expect(executeAggregateAgentTool(disclosure, {
      name: "column-summary",
      input: { columnIndex: 1 },
    })).toEqual({
      name: "column-summary",
      input: { columnIndex: 1 },
      output: {
        count: 3,
        sum: 2700,
        average: 900,
        minimum: { rowIndex: 2, columnIndex: 1, value: 600 },
        maximum: { rowIndex: 0, columnIndex: 1, value: 1200 },
      },
    });
  });

  it("rejects unknown authority, invalid coordinates, and non-numeric operands", () => {
    expect(() => executeAggregateAgentTool(disclosure, {
      name: "execute-sql", input: { sql: "SELECT *" },
    })).toThrow();
    expect(() => executeAggregateAgentTool(disclosure, {
      name: "rank", input: { columnIndex: 1, direction: "descending", limit: 50 },
    })).toThrow();
    expect(() => executeAggregateAgentTool(disclosure, {
      name: "rank", input: { columnIndex: 0, direction: "descending", limit: 2 },
    })).toThrow("numeric");
    expect(() => executeAggregateAgentTool(disclosure, {
      name: "compare",
      input: { left: { rowIndex: 4, columnIndex: 1 }, right: { rowIndex: 1, columnIndex: 1 } },
    })).toThrow("approved numeric cell");
  });

  it("never emits a reference outside the approved disclosure", () => {
    for (const columnIndex of [1, 2]) {
      const observation = executeAggregateAgentTool(disclosure, {
        name: "rank", input: { columnIndex, direction: "ascending", limit: 10 },
      });
      if (observation.name !== "rank") throw new Error("unexpected observation");
      for (const reference of observation.output.ranked) {
        expect(reference.rowIndex).toBeLessThan(disclosure.rows.length);
        expect(reference.columnIndex).toBeLessThan(disclosure.columns.length);
        expect(reference.value).toBe(disclosure.rows[reference.rowIndex]?.[reference.columnIndex]);
      }
    }
  });
});
