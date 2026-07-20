import { useEffect, useMemo, useRef, useState } from "react";
import { Database, Plus, Settings, UsersRound } from "lucide-react";
import type {
  DatasetGroup,
  DatasetReplacementMappingInput,
  DatasetSummary,
  OperationId,
} from "../shared/product-api.js";
import { ProviderSettings } from "./ProviderSettings.js";
import { DataProtectionPanel } from "./DataProtectionPanel.js";
import { DatasetGroupWorkspace } from "./DatasetGroupWorkspace.js";
import {
  DatasetWorkspace,
  EmptyWorkspace,
  type MappingRequired,
  type PreviewState,
  type ReadinessState,
} from "./DatasetWorkspace.js";
import { createOperationId, operationErrorMessage } from "./operation.js";
import { McpSettings } from "./McpSettings.js";
import { SettingsHealthOverview } from "./SettingsHealthOverview.js";

const numberFormat = new Intl.NumberFormat("zh-CN");

function messageFrom(error: unknown): string {
  return operationErrorMessage(error, "操作失败，请重试");
}

export function App() {
  const [view, setView] = useState<"datasets" | "groups" | "settings">("datasets");
  const [settingsSection, setSettingsSection] = useState<"models" | "connectors" | "privacy">("models");
  const [readiness, setReadiness] = useState<ReadinessState>({ kind: "loading" });
  const [datasets, setDatasets] = useState<readonly DatasetSummary[]>([]);
  const [groups, setGroups] = useState<readonly DatasetGroup[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>();
  const [selectedGroupId, setSelectedGroupId] = useState<string>();
  const [preview, setPreview] = useState<PreviewState>({ kind: "empty" });
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [lifecycleAction, setLifecycleAction] = useState<"export" | "delete">();
  const [pendingMapping, setPendingMapping] = useState<MappingRequired>();
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [notice, setNotice] = useState<string>();
  const [activeOperationId, setActiveOperationId] = useState<OperationId>();
  const conversationRef = useRef<HTMLDivElement>(null);

  function startOperation(): OperationId {
    const operationId = createOperationId();
    setActiveOperationId(operationId);
    return operationId;
  }

  function finishOperation(operationId: OperationId): void {
    setActiveOperationId((current) => current === operationId ? undefined : current);
  }

  async function cancelActiveOperation(): Promise<void> {
    if (!activeOperationId) return;
    const result = await window.bubu.operations.cancel(activeOperationId);
    setNotice(result.cancelled ? "正在取消当前操作…" : "操作已经结束，无需取消");
  }

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

  useEffect(() => {
    conversationRef.current?.scrollTo({ top: 0 });
  }, [view, selectedDatasetId, selectedGroupId]);

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
    const operationId = startOperation();
    setImporting(true);
    setNotice(undefined);
    try {
      const result = await window.bubu.datasets.importFiles(operationId);
      if (result.datasets.length === 0) return;
      const nextDatasets = await window.bubu.datasets.list();
      setDatasets(nextDatasets);
      setSelectedDatasetId(result.datasets[0]?.id);
      setNotice(`已导入 ${result.datasets.length} 个数据联系人`);
    } catch (error) {
      setNotice(messageFrom(error));
    } finally {
      setImporting(false);
      finishOperation(operationId);
    }
  }

  async function replaceFile(datasetId: string) {
    const operationId = startOperation();
    setReplacing(true);
    setNotice(undefined);
    try {
      const result = await window.bubu.datasets.replace(datasetId, operationId);
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
      finishOperation(operationId);
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
    const operationId = startOperation();
    setReplacing(true);
    setNotice(undefined);
    setPendingMapping(undefined);
    try {
      const result = await window.bubu.datasets.applyReplacementMapping(input, operationId);
      if (result.status !== "replaced") throw new Error("映射没有生成新的数据版本，请重新选择文件");
      await activateReplacement(result.dataset);
    } catch (error) {
      setNotice(`${messageFrom(error)}。映射会话已结束，请重新选择替换文件。`);
    } finally {
      setReplacing(false);
      finishOperation(operationId);
    }
  }

  async function exportDataset(datasetId: string) {
    const operationId = startOperation();
    setLifecycleAction("export");
    setNotice(undefined);
    try {
      const result = await window.bubu.datasets.export(datasetId, operationId);
      if (result.status === "exported") {
        setNotice(`已导出 ${result.fileName}（${numberFormat.format(result.rowCount)} 行），文本公式已做 Excel 安全处理。`);
      }
    } catch (error) {
      setNotice(messageFrom(error));
    } finally {
      setLifecycleAction(undefined);
      finishOperation(operationId);
    }
  }

  async function deleteDataset(datasetId: string) {
    setLifecycleAction("delete");
    setNotice(undefined);
    try {
      const result = await window.bubu.datasets.delete(datasetId);
      if (result.status === "cancelled") return;
      const [nextDatasets, nextGroups] = await Promise.all([
        window.bubu.datasets.list(),
        window.bubu.datasetGroups.list(),
      ]);
      setDatasets(nextDatasets);
      setGroups(nextGroups);
      setSelectedDatasetId(nextDatasets[0]?.id);
      setSelectedGroupId((current) =>
        nextGroups.some(({ id }) => id === current) ? current : nextGroups[0]?.id,
      );
      const groupImpact = result.removedGroupIds.length + result.updatedGroupIds.length;
      setNotice(`本地数据及全部版本已永久删除${groupImpact > 0 ? `，并修复了 ${groupImpact} 个相关群组` : ""}。`);
    } catch (error) {
      setNotice(messageFrom(error));
    } finally {
      setLifecycleAction(undefined);
    }
  }

  async function reloadCatalogAfterRestore(): Promise<void> {
    const [nextDatasets, nextGroups] = await Promise.all([
      window.bubu.datasets.list(),
      window.bubu.datasetGroups.list(),
    ]);
    setDatasets(nextDatasets);
    setGroups(nextGroups);
    setSelectedDatasetId(nextDatasets[0]?.id);
    setSelectedGroupId(nextGroups[0]?.id);
    setPendingMapping(undefined);
  }

  return (
    <main className={`shell ${view === "settings" ? "shell-settings" : ""}`}>
      <aside className="rail" aria-label="主导航">
        <div className="brand-mark" aria-hidden="true">B</div>
        <button
          type="button"
          className={`rail-item ${view === "datasets" ? "rail-item-active" : ""}`}
          title="数据联系人"
          aria-label="数据联系人"
          aria-pressed={view === "datasets"}
          onClick={() => setView("datasets")}
        ><Database aria-hidden="true" size={20} strokeWidth={1.9} /></button>
        <button
          type="button"
          className={`rail-item ${view === "groups" ? "rail-item-active" : ""}`}
          title="数据群组"
          aria-label="数据群组"
          aria-pressed={view === "groups"}
          onClick={() => { setView("groups"); setSearch(""); }}
        ><UsersRound aria-hidden="true" size={20} strokeWidth={1.9} /></button>
        <div className="rail-spacer" />
        <button
          type="button"
          className={`rail-item ${view === "settings" ? "rail-item-active" : ""}`}
          title="设置"
          aria-label="设置"
          aria-pressed={view === "settings"}
          onClick={() => setView("settings")}
        ><Settings aria-hidden="true" size={20} strokeWidth={1.9} /></button>
      </aside>

      {view !== "settings" && <section className="contacts">
        <header className="contacts-header">
          <div>
            <p className="eyebrow">{view === "groups" ? "数据群组" : "本地数据助手"}</p>
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
            {view !== "groups" && importing ? "…" : <Plus aria-hidden="true" size={19} strokeWidth={2.2} />}
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
              <span className="contact-avatar"><Plus aria-hidden="true" size={18} /></span>
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
              <span className="contact-avatar"><Plus aria-hidden="true" size={18} /></span>
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
      </section>}

      <section className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">{view === "settings" ? "安全本地配置" : view === "groups" ? "本地群组工作区" : "默认保持私密"}</p>
            <h2>{view === "settings" ? "设置" : view === "groups" ? selectedGroup?.name ?? "创建数据群组" : selectedDataset?.displayName ?? "本地 AI 数据工作台"}</h2>
          </div>
          <span className="mode-pill">
            {readiness.kind === "loaded" && readiness.value.status === "ready" ? "本地服务就绪" : "本地模式"}
          </span>
        </header>

        <div ref={conversationRef} className={`conversation ${view === "settings" ? "conversation-settings" : ""}`}>
          {view === "settings" && <section className="settings-workbench" aria-label="设置工作台">
            <SettingsHealthOverview onNavigate={setSettingsSection} />
            <nav className="settings-nav" aria-label="设置分类">
              <p className="hero-kicker">设置分类</p>
              <button type="button" className={settingsSection === "models" ? "settings-nav-active" : ""} aria-current={settingsSection === "models" ? "page" : undefined} onClick={() => setSettingsSection("models")}>模型与提供商<small>连接与默认模型</small></button>
              <button type="button" className={settingsSection === "connectors" ? "settings-nav-active" : ""} aria-current={settingsSection === "connectors" ? "page" : undefined} onClick={() => setSettingsSection("connectors")}>本地连接器<small>MCP 与单次授权</small></button>
              <button type="button" className={settingsSection === "privacy" ? "settings-nav-active" : ""} aria-current={settingsSection === "privacy" ? "page" : undefined} onClick={() => setSettingsSection("privacy")}>隐私与恢复<small>审计、备份、恢复</small></button>
            </nav>
            <div className="settings-content">
              <header className="settings-content-context"><small>当前设置</small><strong>{settingsSection === "models" ? "模型与提供商" : settingsSection === "connectors" ? "本地连接器" : "隐私与恢复"}</strong><span>{settingsSection === "models" ? "先在列表选择配置，再在详情区编辑、测试或设为当前。" : settingsSection === "connectors" ? "保存连接不会启动进程；发现、读取与调用仍分别批准。" : "查看本地审计，并创建或恢复独立的数据快照。"}</span></header>
              {settingsSection === "models" && <ProviderSettings />}
              {settingsSection === "connectors" && <McpSettings />}
              {settingsSection === "privacy" && <DataProtectionPanel onRestored={reloadCatalogAfterRestore} />}
            </div>
          </section>}
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
          {view === "datasets" && activeOperationId && (
            <div className="notice operation-notice" role="status">
              <span>当前任务正在运行。取消后，已提交的原子事务不会留下半成品。</span>
              <button type="button" className="secondary-action" onClick={() => void cancelActiveOperation()}>
                取消当前操作
              </button>
            </div>
          )}
          {view === "datasets" && !selectedDataset && (
            <EmptyWorkspace readiness={readiness} onImport={() => void importFiles()} importing={importing} />
          )}
          {view === "datasets" && selectedDataset && (
            <DatasetWorkspace
              dataset={selectedDataset}
              preview={preview}
              replacing={replacing}
              lifecycleAction={lifecycleAction}
              pendingMapping={pendingMapping}
              onReplace={() => void replaceFile(selectedDataset.id)}
              onExport={() => void exportDataset(selectedDataset.id)}
              onDelete={() => void deleteDataset(selectedDataset.id)}
              onApplyMapping={(input) => void applyReplacementMapping(input)}
              onCancelMapping={() => setPendingMapping(undefined)}
            />
          )}
        </div>

      </section>
    </main>
  );
}
