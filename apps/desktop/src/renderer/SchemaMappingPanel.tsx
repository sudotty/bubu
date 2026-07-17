import { useState } from "react";
import type {
  DatasetReplacementMappingInput,
  DatasetReplacementSelectionResult,
} from "../shared/product-api.js";

type MappingRequired = Extract<DatasetReplacementSelectionResult, { readonly status: "mapping-required" }>;

export function SchemaMappingPanel({
  request,
  busy,
  onApply,
  onCancel,
}: {
  readonly request: MappingRequired;
  readonly busy: boolean;
  readonly onApply: (input: DatasetReplacementMappingInput) => void;
  readonly onCancel: () => void;
}) {
  const [selections, setSelections] = useState<Readonly<Record<string, string>>>(() =>
    Object.fromEntries(
      request.drift.currentColumns.map((column) => [
        column,
        request.drift.incomingColumns.includes(column) ? column : "",
      ]),
    ),
  );
  const selectedIncoming = new Set(Object.values(selections).filter(Boolean));
  const complete = request.drift.currentColumns.every((column) => selections[column])
    && selectedIncoming.size === request.drift.currentColumns.length;

  return (
    <section className="mapping-panel" aria-label="替换列映射">
      <header className="preview-header">
        <div>
          <p className="hero-kicker">SCHEMA DRIFT · LOCAL ONLY</p>
          <h3>确认新文件的列对应关系</h3>
        </div>
        <span>{request.drift.currentColumns.length} 个目标列</span>
      </header>
      <p>左侧是当前稳定结构，右侧是新文件列。每个新文件列只能使用一次；未选择的新增列会被忽略。</p>
      <div className="mapping-list">
        {request.drift.currentColumns.map((currentColumn) => (
          <label className="mapping-row" key={currentColumn}>
            <span>{currentColumn}</span>
            <select
              value={selections[currentColumn] ?? ""}
              onChange={(event) => {
                const incomingColumn = event.target.value;
                setSelections((current) => ({ ...current, [currentColumn]: incomingColumn }));
              }}
              disabled={busy}
            >
              <option value="">选择新文件列</option>
              {request.drift.incomingColumns.map((incomingColumn) => (
                <option
                  key={incomingColumn}
                  value={incomingColumn}
                  disabled={selectedIncoming.has(incomingColumn) && selections[currentColumn] !== incomingColumn}
                >
                  {incomingColumn}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="plan-actions">
        <button
          type="button"
          className="primary-action"
          disabled={!complete || busy}
          onClick={() => onApply({
            replacementToken: request.replacementToken,
            mappings: request.drift.currentColumns.map((currentColumn) => ({
              currentColumn,
              incomingColumn: selections[currentColumn] ?? "",
            })),
          })}
        >
          {busy ? "正在创建新版本…" : "确认映射并创建新版本"}
        </button>
        <button type="button" className="secondary-action" disabled={busy} onClick={onCancel}>取消</button>
      </div>
    </section>
  );
}
