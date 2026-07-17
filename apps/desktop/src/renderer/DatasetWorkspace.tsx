import type {
  DatasetPreview,
  DatasetReplacementMappingInput,
  DatasetReplacementSelectionResult,
  DatasetSummary,
  ProductReadiness,
} from "../shared/product-api.js";
import { DatasetAnalysis } from "./DatasetAnalysis.js";
import { DatasetQualityPanel } from "./DatasetQualityPanel.js";
import { SchemaMappingPanel } from "./SchemaMappingPanel.js";

export type MappingRequired = Extract<DatasetReplacementSelectionResult, { readonly status: "mapping-required" }>;

export type ReadinessState =
  | { readonly kind: "loading" }
  | { readonly kind: "loaded"; readonly value: ProductReadiness }
  | { readonly kind: "failed"; readonly message: string };

export type PreviewState =
  | { readonly kind: "empty" }
  | { readonly kind: "loading" }
  | { readonly kind: "loaded"; readonly value: DatasetPreview }
  | { readonly kind: "failed"; readonly message: string };

const numberFormat = new Intl.NumberFormat("zh-CN");
const typeLabels = {
  null: "空值",
  boolean: "布尔",
  integer: "整数",
  real: "数值",
  datetime: "日期时间",
  text: "文本",
} as const;

export function EmptyWorkspace({
  readiness,
  onImport,
  importing,
}: {
  readonly readiness: ReadinessState;
  readonly onImport: () => void;
  readonly importing: boolean;
}) {
  return (
    <>
      <div className="hero-card">
        <p className="hero-kicker">LOCAL-FIRST WORKSPACE</p>
        <h3>导入表格，把数据变成可以聊天的联系人。</h3>
        <p>CSV 与 Excel 会在 Go 数据内核中事务化转换为本地表。这里只显示文件名、结构和本地画像，不会自动发送原始行。</p>
        <button type="button" className="primary-action" onClick={onImport} disabled={importing}>
          {importing ? "正在导入…" : "选择 Excel 或 CSV"}
        </button>
      </div>
      <section className="status-panel" aria-live="polite">
        <div className="status-heading">
          <h3>本地运行状态</h3>
          <span className={`status-dot status-${readiness.kind}`} />
        </div>
        {readiness.kind === "loading" && <p>正在启动本地服务…</p>}
        {readiness.kind === "failed" && <p className="error-text">{readiness.message}</p>}
        {readiness.kind === "loaded" && (
          <div className="service-grid">
            {readiness.value.services.map((service) => (
              <article className="service-card" key={service.name}>
                <div>
                  <strong>{service.name === "data-core" ? "Go 数据内核" : "Node AI 运行时"}</strong>
                  <span className={`service-state service-${service.status}`}>{service.status}</span>
                </div>
                <small>{service.capabilities.join(" · ") || service.message || "等待服务能力"}</small>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export function DatasetWorkspace({
  dataset,
  preview,
  replacing,
  lifecycleAction,
  pendingMapping,
  onReplace,
  onExport,
  onDelete,
  onApplyMapping,
  onCancelMapping,
}: {
  readonly dataset: DatasetSummary;
  readonly preview: PreviewState;
  readonly replacing: boolean;
  readonly lifecycleAction: "export" | "delete" | undefined;
  readonly pendingMapping: MappingRequired | undefined;
  readonly onReplace: () => void;
  readonly onExport: () => void;
  readonly onDelete: () => void;
  readonly onApplyMapping: (input: DatasetReplacementMappingInput) => void;
  readonly onCancelMapping: () => void;
}) {
  const busy = replacing || lifecycleAction !== undefined;
  return (
    <>
      <section className="dataset-summary">
        <div>
          <p className="hero-kicker">DATASET CONTACT · VERSION {dataset.version}</p>
          <h3>{dataset.displayName}</h3>
          <p>{dataset.sourceName} · 数据已经物化到本地 SQLite，源文件路径不会写入目录。</p>
        </div>
        <div className="dataset-actions">
          <div className="dataset-metrics">
            <span><strong>{numberFormat.format(dataset.rowCount)}</strong> 行</span>
            <span><strong>{dataset.columnCount}</strong> 列</span>
            <span><strong>{dataset.sourceKind.toUpperCase()}</strong> 来源</span>
          </div>
          <div className="dataset-action-row">
            <button type="button" className="secondary-action" onClick={onExport} disabled={busy}>
              {lifecycleAction === "export" ? "正在导出…" : "安全导出 CSV"}
            </button>
            <button type="button" className="secondary-action" onClick={onReplace} disabled={busy}>
              {replacing ? "正在检查…" : "替换数据版本"}
            </button>
            <button type="button" className="danger-action" onClick={onDelete} disabled={busy}>
              {lifecycleAction === "delete" ? "正在删除…" : "永久删除"}
            </button>
          </div>
        </div>
      </section>

      {pendingMapping && (
        <SchemaMappingPanel
          key={pendingMapping.replacementToken}
          request={pendingMapping}
          busy={replacing}
          onApply={onApplyMapping}
          onCancel={onCancelMapping}
        />
      )}

      {preview.kind === "loading" && <div className="preview-state">正在读取本地预览与列画像…</div>}
      {preview.kind === "failed" && <div className="preview-state error-text">{preview.message}</div>}
      {preview.kind === "loaded" && (
        <section className="preview-panel">
          <header className="preview-header">
            <div><p className="hero-kicker">LOCAL PREVIEW</p><h3>前 {preview.value.rows.length} 行</h3></div>
            <span>共 {numberFormat.format(preview.value.totalRows)} 行</span>
          </header>
          <div className="table-scroll">
            <table>
              <thead><tr>{preview.value.columns.map((column) => (
                <th key={column.ordinal}><span>{column.name}</span><small>{typeLabels[column.inferredType]}</small></th>
              ))}</tr></thead>
              <tbody>{preview.value.rows.map((row, rowIndex) => (
                <tr key={`${preview.value.offset + rowIndex}`}>
                  {preview.value.columns.map((column, columnIndex) => (
                    <td key={column.ordinal}>{row[columnIndex] == null ? <span className="null-value">—</span> : String(row[columnIndex])}</td>
                  ))}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}
      <DatasetQualityPanel datasetId={dataset.id} versionId={dataset.versionId} />
      <DatasetAnalysis datasetId={dataset.id} datasetName={dataset.displayName} />
    </>
  );
}
