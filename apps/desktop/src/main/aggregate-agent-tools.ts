import {
  parseAggregateAgentToolCall,
  parseAggregateAgentToolObservation,
  type AggregateAgentToolObservation,
  type AggregateDisclosure,
} from "@bubu/contracts";

interface NumericCell {
  readonly rowIndex: number;
  readonly columnIndex: number;
  readonly value: number;
}

function numericCell(
  disclosure: AggregateDisclosure,
  reference: { readonly rowIndex: number; readonly columnIndex: number },
): NumericCell {
  const value = disclosure.rows[reference.rowIndex]?.[reference.columnIndex];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Agent tools can reference only an approved numeric cell");
  }
  return { ...reference, value };
}

function numericColumn(disclosure: AggregateDisclosure, columnIndex: number): readonly NumericCell[] {
  if (!disclosure.columns[columnIndex]) throw new Error("Agent tool column is outside the approved disclosure");
  const cells = disclosure.rows.flatMap((row, rowIndex) => {
    const value = row[columnIndex];
    return typeof value === "number" && Number.isFinite(value)
      ? [{ rowIndex, columnIndex, value }]
      : [];
  });
  if (cells.length === 0) throw new Error("Agent tools require an approved numeric column");
  return cells;
}

export function executeAggregateAgentTool(
  disclosure: AggregateDisclosure,
  value: unknown,
): AggregateAgentToolObservation {
  const call = parseAggregateAgentToolCall(value);
  if (call.name === "rank") {
    const direction = call.input.direction === "ascending" ? 1 : -1;
    const ranked = [...numericColumn(disclosure, call.input.columnIndex)]
      .sort((left, right) => direction * (left.value - right.value) || left.rowIndex - right.rowIndex)
      .slice(0, call.input.limit);
    return parseAggregateAgentToolObservation({
      name: call.name,
      input: call.input,
      output: { ranked },
    });
  }
  if (call.name === "compare") {
    const left = numericCell(disclosure, call.input.left);
    const right = numericCell(disclosure, call.input.right);
    const difference = left.value - right.value;
    return parseAggregateAgentToolObservation({
      name: call.name,
      input: call.input,
      output: {
        left,
        right,
        difference,
        percentDifference: right.value === 0 ? null : difference / Math.abs(right.value) * 100,
      },
    });
  }
  const cells = numericColumn(disclosure, call.input.columnIndex);
  const first = cells[0];
  if (!first) throw new Error("Agent tools require an approved numeric column");
  const sum = cells.reduce((total, cell) => total + cell.value, 0);
  const minimum = cells.slice(1).reduce((best, cell) => cell.value < best.value ? cell : best, first);
  const maximum = cells.slice(1).reduce((best, cell) => cell.value > best.value ? cell : best, first);
  return parseAggregateAgentToolObservation({
    name: call.name,
    input: call.input,
    output: {
      count: cells.length,
      sum,
      average: sum / cells.length,
      minimum,
      maximum,
    },
  });
}
