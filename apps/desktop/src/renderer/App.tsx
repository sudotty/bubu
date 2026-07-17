import { useEffect, useMemo, useState } from "react";
import type {
  DatasetGroup,
  DatasetPreview,
  DatasetReplacementMappingInput,
  DatasetReplacementSelectionResult,
  DatasetSummary,
  ProductReadiness,
} from "../shared/product-api.js";
import { ProviderSettings } from "./ProviderSettings.js";
import { DatasetAnalysis } from "./DatasetAnalysis.js";
import { DatasetGroupWorkspace } from "./DatasetGroupWorkspace.js";
import { SchemaMappingPanel } from "./SchemaMappingPanel.js";

type MappingRequired = Extract<DatasetReplacementSelectionResult, { readonly status: "mapping-required" }>;

type ReadinessState =
  | { readonly kind: "loading" }
  | { readonly kind: "loaded"; readonly value: ProductReadiness }
  | { readonly kind: "failed"; readonly message: string };

type PreviewState =
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

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : "操作失败，请重试";
}

export function App() {
  const [view, setView] = useState<"datasets" | "groups" | "settings">("datasets");
  const [readiness, setReadiness] = useState<ReadinessState>({ kind: "loading" });
  const [datasets, setDatasets] = useState<readonly DatasetSummary[]>([]);
  const [groups, setGroups] = useState<readonly DatasetGroup[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>();
  const [selectedGroupId, setSelectedGroupId] = useState<string>();
  const [preview, setPreview] = useState<PreviewState>({ kind: "empty" });
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [pendingMapping, setPendingMapping] = useState<MappingRequired>();
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    let active = true;
    void Promise.all([window.bubu.system.getReadiness(), window.bubu.datasets.list(), window.bubu.datasetGroups.list()])
      .then(([nextReadiness, nextDatasets, nextGroups]) => {
        if (!active) return;
        setReadiness({ kind: "loaded", value: nextReadiness });
        setDatasets(nextDatasets);
        setGroups(nextGroups);
        setSelectedDatasetId(nextDatasets[0]?.id);
        setSelectedGroupId(nextGroups[0]?.id);
        setCatalogLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message = messageFrom(error);
        setReadiness({ kind: "failed", message });
        setCatalogLoading(false);
        setNotice(message);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedDatasetId) {
      setPreview({ kind: "empty" });
      return;
    }
    let active = true;
    setPreview({ kind: "loading" });
    void window.bubu.datasets
      .preview({ datasetId: selectedDatasetId, limit: 50, offset: 0 })
      .then((value) => {
        if (active) setPreview({ kind: "loaded", value });
      })
      .catch((error: unknown) => {
        if (active) setPreview({ kind: "failed", message: messageFrom(error) });
      });
    return () => {
      active = false;
    };
  }, [selectedDatasetId]);

  useEffect(() => {
    setPendingMapping(undefined);
  }, [selectedDatasetId]);

  const selectedDataset = datasets.find((dataset) => dataset.id === selectedDatasetId);
  const selectedGroup = groups.find((group) => group.id === selectedGroupId);
  const filteredDatasets = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("zh-CN");
    if (!query) return datasets;
    return datasets.filter((dataset) =>
      `${dataset.displayName} ${dataset.sourceName}`.toLocaleLowerCase("zh-CN").includes(query),
    );
  }, [datasets, search]);
  const filteredGroups = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("zh-CN");
    if (!query) return groups;
    return groups.filter((group) =>
      `${group.name} ${group.members.map(({ displayName }) => displayName).join(" ")}`
        .toLocaleLowerCase("zh-CN")
        .includes(query),
    );
  }, [groups, search]);

  async function importFiles() {
    setImporting(true);
    setNotice(undefined);
    try {
      const result = await window.bubu.datasets.importFiles();
      if (result.datasets.length === 0) return;
      const nextDatasets = await window.bubu.datasets.list();
      setDatasets(nextDatasets);
      setSelectedDatasetId(result.datasets[0]?.id);
      setNotice(`已导入 ${result.datasets.length} 个数据联系人`);
    } catch (error) {
      setNotice(messageFrom(error));
    } finally {
      setImporting(false);
    }
  }

  async function replaceFile(datasetId: string) {
    setReplacing(true);
    setNotice(undefined);
    try {
      const result = await window.bubu.datasets.replace(datasetId);
      if (result.status === "cancelled") return;
      if (result.status === "mapping-required") {
        const details = [
          result.drift.missingColumns.length > 0
            ? `缺少：${result.drift.missingColumns.join("、")}`
            : undefined,
          result.drift.addedColumns.length > 0
            ? `新增：${result.drift.addedColumns.join("、")}`
            : undefined,
          result.drift.reordered ? "列顺序发生变化" : undefined,
        ].filter((value): value is string => value !== undefined);
        setPendingMapping(result);
        setNotice(`没有覆盖当前数据。请确认列映射（${details.join("；")}）。`);
        return;
      }
      await activateReplacement(result.dataset);
    } catch (error) {
      setNotice(messageFrom(error));
    } finally {
      setReplacing(false);
    }
  }

  async function activateReplacement(dataset: DatasetSummary) {
    const [nextDatasets, nextPreview, nextGroups] = await Promise.all([
      window.bubu.datasets.list(),
      window.bubu.datasets.preview({ datasetId: dataset.id, limit: 50, offset: 0 }),
      window.bubu.datasetGroups.list(),
    ]);
    setDatasets(nextDatasets);
    setGroups(nextGroups);
    setSelectedDatasetId(dataset.id);
    setPreview({ kind: "loaded", value: nextPreview });
    setPendingMapping(undefined);
    setNotice(`已创建版本 ${dataset.version}，旧版本仍保留在本地。`);
  }

  async function applyReplacementMapping(input: DatasetReplacementMappingInput) {
    setReplacing(true);
    setNotice(undefined);
    setPendingMapping(undefined);
    try {
      const result = await window.bubu.datasets.applyReplacementMapping(input);
      if (result.status !== "replaced") throw new Error("映射没有生成新的数据版本，请重新选择文件");
      await activateReplacement(result.dataset);
    } catch (error) {
      setNotice(`${messageFrom(error)}。映射会话已结束，请重新选择替换文件。`);
    } finally {
      setReplacing(false);
    }
  }

  return (
    <main className="shell">
      <aside className="rail" aria-label="主导航">
        <div className="brand-mark" aria-hidden="true">B</div>
        <button
          type="button"
          className={`rail-item ${view === "datasets" ? "rail-item-active" : ""}`}
          title="数据联系人"
          onClick={() => setView("datasets")}
        >▦</button>
        <button
          type="button"
          className={`rail-item ${view === "groups" ? "rail-item-active" : ""}`}
          title="数据群组"
          onClick={() => { setView("groups"); setSearch(""); }}
        >◎</button>
        <div className="rail-spacer" />
        <button
          type="button"
          className={`rail-item ${view === "settings" ? "rail-item-active" : ""}`}
          title="模型设置"
          onClick={() => setView("settings")}
        >⚙</button>
      </aside>

      <section className="contacts">
        <header className="contacts-header">
          <div>
            <p className="eyebrow">{view === "groups" ? "DATA GROUPS" : "LOCAL DATA AGENT"}</p>
            <h1>{view === "groups" ? "群组" : "BuBu"}</h1>
          </div>
          <button
            type="button"
            className="add-button"
            onClick={() => view === "groups" ? setSelectedGroupId(undefined) : void importFiles()}
            disabled={view !== "groups" && importing}
            aria-label={view === "groups" ? "创建数据群组" : "导入 Excel 或 CSV"}
            title={view === "groups" ? "创建数据群组" : "导入 Excel 或 CSV"}
          >
            {view !== "groups" && importing ? "…" : "＋"}
          </button>
        </header>
        <label className="search-field">
          <span className="sr-only">搜索数据联系人</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={view === "groups" ? "搜索数据群组" : "搜索数据联系人"}
          />
        </label>

        <div className="contact-list" aria-busy={catalogLoading}>
          {catalogLoading && <p className="empty-copy">正在读取本地数据目录…</p>}
          {view !== "groups" && !catalogLoading && filteredDatasets.length === 0 && (
            <div className="empty-contact">
              <span className="contact-avatar">＋</span>
              <strong>{datasets.length === 0 ? "导入第一个表格" : "没有匹配的数据"}</strong>
              <small>{datasets.length === 0 ? "CSV 与 XLSX 会转换为本地表" : "尝试其他关键词"}</small>
            </div>
          )}
          {view !== "groups" && filteredDatasets.map((dataset) => (
            <button
              type="button"
              className={`contact-card ${dataset.id === selectedDatasetId ? "contact-card-active" : ""}`}
              key={dataset.id}
              onClick={() => setSelectedDatasetId(dataset.id)}
            >
              <span className="contact-avatar">{dataset.sourceKind === "xlsx" ? "X" : "C"}</span>
              <span>
                <strong>{dataset.displayName}</strong>
                <small>{numberFormat.format(dataset.rowCount)} 行 · {dataset.columnCount} 列</small>
              </span>
            </button>
          ))}
          {view === "groups" && !catalogLoading && filteredGroups.length === 0 && (
            <div className="empty-contact">
              <span className="contact-avatar">＋</span>
              <strong>创建第一个数据群组</strong>
              <small>选择 2–8 个数据联系人</small>
            </div>
          )}
          {view === "groups" && filteredGroups.map((group) => (
            <button
              type="button"
              className={`contact-card ${group.id === selectedGroupId ? "contact-card-active" : ""}`}
              key={group.id}
              onClick={() => setSelectedGroupId(group.id)}
            >
              <span className="contact-avatar">G</span>
              <span><strong>{group.name}</strong><small>{group.members.length} 个数据联系人</small></span>
            </button>
          ))}
        </div>
        <p className="local-note">{view === "groups" ? "群组只保存成员关系 · 不复制原始数据" : "默认本地模式 · 原始数据不会自动出站"}</p>
      </section>

      <section className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">{view === "settings" ? "SECURE LOCAL CONFIG" : view === "groups" ? "LOCAL GROUP WORKSPACE" : "PRIVATE BY DEFAULT"}</p>
            <h2>{view === "settings" ? "模型设置" : view === "groups" ? selectedGroup?.name ?? "创建数据群组" : selectedDataset?.displayName ?? "本地 AI 数据工作台"}</h2>
          </div>
          <span className="mode-pill">
            {readiness.kind === "loaded" && readiness.value.status === "ready" ? "本地服务就绪" : "本地模式"}
          </span>
        </header>

        <div className="conversation">
          {view === "settings" && <ProviderSettings />}
          {view === "groups" && (
            <DatasetGroupWorkspace
              group={selectedGroup}
              datasets={datasets}
              onSaved={(saved) => {
                setGroups((current) => [saved, ...current.filter(({ id }) => id !== saved.id)]);
                setSelectedGroupId(saved.id);
              }}
              onDeleted={(nextGroups) => {
                setGroups(nextGroups);
                setSelectedGroupId(nextGroups[0]?.id);
              }}
            />
          )}
          {view === "datasets" && notice && <div className="notice" role="status">{notice}</div>}
          {view === "datasets" && !selectedDataset && (
            <EmptyWorkspace readiness={readiness} onImport={() => void importFiles()} importing={importing} />
          )}
          {view === "datasets" && selectedDataset && (
            <DatasetWorkspace
              dataset={selectedDataset}
              preview={preview}
              replacing={replacing}
              pendingMapping={pendingMapping}
              onReplace={() => void replaceFile(selectedDataset.id)}
              onApplyMapping={(input) => void applyReplacementMapping(input)}
              onCancelMapping={() => setPendingMapping(undefined)}
            />
          )}
        </div>

      </section>
    </main>
  );
}

function EmptyWorkspace({
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

function DatasetWorkspace({
  dataset,
  preview,
  replacing,
  pendingMapping,
  onReplace,
  onApplyMapping,
  onCancelMapping,
}: {
  readonly dataset: DatasetSummary;
  readonly preview: PreviewState;
  readonly replacing: boolean;
  readonly pendingMapping: MappingRequired | undefined;
  readonly onReplace: () => void;
  readonly onApplyMapping: (input: DatasetReplacementMappingInput) => void;
  readonly onCancelMapping: () => void;
}) {
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
          <button type="button" className="secondary-action" onClick={onReplace} disabled={replacing}>
            {replacing ? "正在检查…" : "替换数据版本"}
          </button>
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
            <div>
              <p className="hero-kicker">LOCAL PREVIEW</p>
              <h3>前 {preview.value.rows.length} 行</h3>
            </div>
            <span>共 {numberFormat.format(preview.value.totalRows)} 行</span>
          </header>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {preview.value.columns.map((column) => (
                    <th key={column.ordinal}>
                      <span>{column.name}</span>
                      <small>{typeLabels[column.inferredType]}</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.value.rows.map((row, rowIndex) => (
                  <tr key={`${preview.value.offset + rowIndex}`}>
                    {preview.value.columns.map((column, columnIndex) => (
                      <td key={column.ordinal}>{row[columnIndex] == null ? <span className="null-value">—</span> : String(row[columnIndex])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <DatasetAnalysis datasetId={dataset.id} datasetName={dataset.displayName} />
    </>
  );
}
