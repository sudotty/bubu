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
import { ConversationWorkbench } from "./ConversationWorkbench.js";
import { ArtifactInspector } from "./ArtifactInspector.js";
import { DatasetLineagePanel } from "./DatasetLineagePanel.js";
import { emptyWorkspaceTaskStarters, type WorkspaceTaskId } from "@bubu/product-core";

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

function DatasetContextInspector({ dataset, preview, onDatasetMaterialized }: { readonly dataset: DatasetSummary; readonly preview: PreviewState; readonly onDatasetMaterialized: (dataset: DatasetSummary) => void }) {
  return <div className="dataset-context-inspector">
    <header className="preview-header">
      <div><p className="hero-kicker">数据上下文</p><h3>数据结构与健康</h3></div>
      <span>版本 {dataset.version}</span>
    </header>
    {dataset.sourceKind === "derived" && <DatasetLineagePanel dataset={dataset} onRecomputed={onDatasetMaterialized} />}
    {preview.kind === "loading" && <p className="empty-copy">正在读取本地预览与列画像…</p>}
    {preview.kind === "failed" && <p className="error-text">{preview.message}</p>}
    {preview.kind === "loaded" && <section className="context-preview" aria-label="本地数据预览">
      <div className="context-preview-heading"><strong>前 {preview.value.rows.length} 行</strong><small>共 {numberFormat.format(preview.value.totalRows)} 行</small></div>
      <div className="table-scroll">
        <table>
          <thead><tr>{preview.value.columns.map((column) => <th key={column.ordinal}><span>{column.name}</span><small>{typeLabels[column.inferredType]}</small></th>)}</tr></thead>
          <tbody>{preview.value.rows.map((row, rowIndex) => <tr key={`${preview.value.offset + rowIndex}`}>{preview.value.columns.map((column, columnIndex) => <td key={column.ordinal}>{row[columnIndex] == null ? <span className="null-value">—</span> : String(row[columnIndex])}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>}
    <DatasetQualityPanel datasetId={dataset.id} versionId={dataset.versionId} />
  </div>;
}

export function EmptyWorkspace({
  readiness,
  onImport,
  onImportDemo,
  importing,
  demoImporting,
  onStartTask,
}: {
  readonly readiness: ReadinessState;
  readonly onImport: () => void;
  readonly onImportDemo: () => void;
  readonly importing: boolean;
  readonly demoImporting: boolean;
  readonly onStartTask: (taskId: WorkspaceTaskId) => void;
}) {
  const busy = importing || demoImporting;
  return (
    <>
      <div className="hero-card">
        <p className="hero-kicker">本地优先工作区</p>
        <h3>导入表格，把数据变成可追溯的数据对象。</h3>
        <p>CSV 与 Excel 会在 Go 数据内核中事务化转换为本地表。这里只显示文件名、结构和本地画像，不会自动发送原始行。</p>
        <div className="hero-actions">
          <button type="button" className="primary-action" onClick={onImport} disabled={busy}>
            {importing ? "正在导入…" : "选择 Excel 或 CSV"}
          </button>
          <button type="button" className="secondary-action" onClick={onImportDemo} disabled={busy}>
            {demoImporting ? "正在创建示例…" : "打开零售经营示例"}
          </button>
        </div>
        <small className="demo-workspace-note">示例包含 3 个数据对象 · 2 条已确认关系 · 1 个每周业务主题</small>
      </div>
      <section className="workspace-task-map" aria-label="从任务开始">
        <header><div><p className="hero-kicker">从任务开始</p><h3>选择你要完成的工作</h3></div><small>已实现任务可以直接用本地示例开始</small></header>
        <div>
          {emptyWorkspaceTaskStarters.map((task) => task.status === "implemented" ? (
            <button type="button" key={task.id} className="workspace-task-card" onClick={() => onStartTask(task.id)} disabled={busy}>
              <span><strong>{task.label}</strong><small>已实现</small></span>
              <p>{task.description}</p>
              <b>{task.actionLabel}</b>
            </button>
          ) : (
            <article key={task.id} className="workspace-task-card workspace-task-planned" aria-disabled="true">
              <span><strong>{task.label}</strong><small>计划中</small></span>
              <p>{task.description}</p>
              <b>尚不可执行</b>
            </article>
          ))}
        </div>
      </section>
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
  pendingMapping,
  onApplyMapping,
  onCancelMapping,
  onDatasetMaterialized,
}: {
  readonly dataset: DatasetSummary;
  readonly preview: PreviewState;
  readonly replacing: boolean;
  readonly pendingMapping: MappingRequired | undefined;
  readonly onApplyMapping: (input: DatasetReplacementMappingInput) => void;
  readonly onCancelMapping: () => void;
  readonly onDatasetMaterialized: (dataset: DatasetSummary) => void;
}) {
  return (
    <>
      {pendingMapping && (
        <SchemaMappingPanel
          key={pendingMapping.replacementToken}
          request={pendingMapping}
          busy={replacing}
          onApply={onApplyMapping}
          onCancel={onCancelMapping}
        />
      )}

      <ConversationWorkbench
        target={{ kind: "dataset", id: dataset.id }}
        title="数据对话"
        subtitle="每条对话都是一个可审查的数据任务。"
        inspector={(threadId, view, closePane) => <ArtifactInspector target={{ kind: "dataset", id: dataset.id }} threadId={threadId} initialView={view} fallback={<DatasetContextInspector dataset={dataset} preview={preview} onDatasetMaterialized={onDatasetMaterialized} />} onReturnToConversation={closePane} onDatasetMaterialized={onDatasetMaterialized} />}
      >
        {(threadId, createThread, openArtifact) => <DatasetAnalysis dataset={dataset} preview={preview.kind === "loaded" ? preview.value : undefined} threadId={threadId} onCreateThread={createThread} onOpenArtifact={openArtifact} />}
      </ConversationWorkbench>
    </>
  );
}
