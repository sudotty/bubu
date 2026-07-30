import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { BookOpen, Database, Download, FilePenLine, FolderSync, MoreHorizontal, Plus, Settings, Sparkles, Trash2, UsersRound } from "lucide-react";
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
import { RemoteMcpSettings } from "./RemoteMcpSettings.js";
import { SettingsHealthOverview } from "./SettingsHealthOverview.js";
import { DatasetNameDialog } from "./DatasetNameDialog.js";
import { DatasetVersions } from "./DatasetVersions.js";
import { ContextMenu } from "./ContextMenu.js";
import { PromptTemplateSettings } from "./PromptTemplateSettings.js";
import { DataCleanDialog } from "./DataCleanDialog.js";
import type { WorkspaceTaskId } from "@bubu/product-core";
import { recordProductMetric } from "./product-metrics.js";
import { RecurringWorkCenter } from "./RecurringWorkCenter.js";
import { KnowledgeWorkspace } from "./KnowledgeWorkspace.js";
import { HubSettings } from "./HubSettings.js";
import { OnboardingChecklist } from "./OnboardingChecklist.js";
import type { RecommendedFirstTask } from "@bubu/product-core";
import { initialAppNavigation, reduceAppNavigation, type AppView, type SettingsSection } from "./app-navigation.js";

const numberFormat = new Intl.NumberFormat("zh-CN");
const cadenceLabels: Record<DatasetGroup["cadence"], string> = {
  "one-off": "单次主题",
  daily: "每日更新",
  weekly: "每周更新",
  monthly: "每月更新",
  "dataset-version": "数据更新时",
};

type ContactMenuState =
  | { readonly kind: "dataset"; readonly dataset: DatasetSummary; readonly x: number; readonly y: number; readonly returnFocus: HTMLElement }
  | { readonly kind: "group"; readonly group: DatasetGroup; readonly x: number; readonly y: number; readonly returnFocus: HTMLElement };

function messageFrom(error: unknown): string {
  return operationErrorMessage(error, "操作失败，请重试");
}

export function App() {
  const [navigation, dispatchNavigation] = useReducer(reduceAppNavigation, initialAppNavigation);
  const { view, settingsSection, selectedDatasetId, selectedGroupId } = navigation;
  const setView = (value: AppView) => dispatchNavigation({ type: "navigate", view: value });
  const setSettingsSection = (value: SettingsSection) => dispatchNavigation({ type: "open-settings", section: value });
  const setSelectedDatasetId = (id: string | undefined) => dispatchNavigation({ type: "select-dataset", id });
  const setSelectedGroupId = (id: string | undefined) => dispatchNavigation({ type: "select-group", id });
  const [readiness, setReadiness] = useState<ReadinessState>({ kind: "loading" });
  const [datasets, setDatasets] = useState<readonly DatasetSummary[]>([]);
  const [groups, setGroups] = useState<readonly DatasetGroup[]>([]);
  const [preview, setPreview] = useState<PreviewState>({ kind: "empty" });
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [demoImporting, setDemoImporting] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [lifecycleAction, setLifecycleAction] = useState<"export" | "delete">();
  const [pendingMapping, setPendingMapping] = useState<MappingRequired>();
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [notice, setNotice] = useState<string>();
  const [activeOperationId, setActiveOperationId] = useState<OperationId>();
  const [renamingDatasets, setRenamingDatasets] = useState<readonly DatasetSummary[]>([]);
  const [renamingBusy, setRenamingBusy] = useState(false);
  const [contactMenu, setContactMenu] = useState<ContactMenuState>();
  const [versionOpenRequest, setVersionOpenRequest] = useState(0);
  const [groupEditRequest, setGroupEditRequest] = useState(0);
  const [dataCleanOpen, setDataCleanOpen] = useState(false);
  const [dataCleanInitialTemplate, setDataCleanInitialTemplate] = useState<"monthly-prep" | "append-exports">("monthly-prep");
  const [reconciliationOpenRequest, setReconciliationOpenRequest] = useState(0);
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
        dispatchNavigation({ type: "initialize-catalog", datasetId: nextDatasets[0]?.id, groupId: nextGroups[0]?.id });
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
  }, [view, selectedDatasetId, selectedGroupId, settingsSection]);

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
      setRenamingDatasets(result.datasets);
      setNotice(`已导入 ${result.datasets.length} 个数据对象`);
    } catch (error) {
      setNotice(messageFrom(error));
    } finally {
      setImporting(false);
      finishOperation(operationId);
    }
  }

  async function importDemoWorkspace(taskId?: WorkspaceTaskId) {
    const operationId = startOperation();
    setDemoImporting(true);
    setNotice(undefined);
    recordProductMetric({ name: "workspace_demo_opened", targetKind: "dataset", outcome: "started" });
    try {
      const reconciliationTask = taskId === "compare" || taskId === "reconcile";
      const mergeTask = taskId === "merge";
      const result = await window.bubu.datasets.importDemo(reconciliationTask ? "reconciliation-cases" : mergeTask ? "merge-exports" : "retail-operations", operationId);
      const [nextDatasets, nextGroups] = await Promise.all([
        window.bubu.datasets.list(),
        window.bubu.datasetGroups.list(),
      ]);
      setDatasets(nextDatasets);
      setGroups(nextGroups);
      setSelectedDatasetId(result.datasets[0]?.id);
      setSelectedGroupId(result.group.id);
      setNotice(reconciliationTask ? "对账示例已创建：销售/退款与订单/付款共 4 个数据对象；付款重复键留待 Reconcile 审查。" : mergeTask ? "Merge 示例已创建：3 个同结构周期订单对象；请选择第二来源并审查 Append 影响。" : "零售经营示例已创建：3 个数据对象、2 条已确认关系和 1 个每周业务主题。");
      recordProductMetric({ name: "workspace_demo_opened", targetKind: "dataset", outcome: "succeeded", rowCount: result.datasets.reduce((total, dataset) => total + dataset.rowCount, 0), columnCount: result.datasets.reduce((total, dataset) => total + dataset.columnCount, 0) });
      if (taskId === "clean") setDataCleanOpen(true);
      if (mergeTask) { setDataCleanInitialTemplate("append-exports"); setDataCleanOpen(true); }
      if (taskId === "repeat") setNotice("示例已准备好。先完成一次 Clean，再在数据版本更新后查看本地自动重算与恢复证据。");
      if (reconciliationTask) { setView("groups"); setReconciliationOpenRequest((value) => value + 1); }
    } catch (error) {
      setNotice(messageFrom(error));
      recordProductMetric({ name: "workspace_demo_opened", targetKind: "dataset", outcome: "failed" });
    } finally {
      setDemoImporting(false);
      finishOperation(operationId);
    }
  }

  function runOnboardingAction(kind: RecommendedFirstTask["kind"]): void {
    if (kind === "import") { void importFiles(); return; }
    if (kind === "clean" || kind === "merge") {
      setView("datasets");
      setDataCleanInitialTemplate(kind === "merge" ? "append-exports" : "monthly-prep");
      setDataCleanOpen(true);
      return;
    }
    if (kind === "reconcile" && groups.length > 0) {
      setView("groups");
      setSelectedGroupId(selectedGroupId ?? groups[0]?.id);
      setReconciliationOpenRequest((value) => value + 1);
      return;
    }
    if (kind === "create-topic") {
      setView("groups");
      setSelectedGroupId(undefined);
      setNotice("先选择至少两个数据对象，确认业务主题与更新节奏；BuBu 不会仅凭同名字段猜测关系。");
      return;
    }
    setView("datasets");
    setNotice("建议已就绪：创建一个数据任务，选择问题起点并审查本地查询计划。");
    requestAnimationFrame(() => conversationRef.current?.scrollTo({ top: conversationRef.current.scrollHeight, behavior: "smooth" }));
  }

  async function saveDatasetNames(names: ReadonlyMap<string, string>): Promise<void> {
    setRenamingBusy(true);
    setNotice(undefined);
    try {
      for (const dataset of renamingDatasets) {
        const displayName = names.get(dataset.id)?.trim();
        if (!displayName || displayName === dataset.displayName) continue;
        await window.bubu.datasets.rename({ datasetId: dataset.id, displayName });
      }
      const [nextDatasets, nextGroups] = await Promise.all([
        window.bubu.datasets.list(),
        window.bubu.datasetGroups.list(),
      ]);
      setDatasets(nextDatasets);
      setGroups(nextGroups);
      setRenamingDatasets([]);
      setNotice("数据对象名称已保存，可以直接开始分析。");
    } catch (error) {
      setNotice(messageFrom(error));
    } finally {
      setRenamingBusy(false);
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

  async function showMaterializedDataset(dataset: DatasetSummary) {
    const [nextDatasets, nextPreview] = await Promise.all([
      window.bubu.datasets.list(),
      window.bubu.datasets.preview({ datasetId: dataset.id, limit: 50, offset: 0 }),
    ]);
    setDatasets(nextDatasets);
    setSelectedDatasetId(dataset.id);
    setPreview({ kind: "loaded", value: nextPreview });
    setView("datasets");
    setNotice(`“${dataset.displayName}”已保存为可继续分析的数据对象 · 版本 ${dataset.version}`);
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
      setSelectedGroupId(nextGroups.some(({ id }) => id === selectedGroupId) ? selectedGroupId : nextGroups[0]?.id);
      const groupImpact = result.removedGroupIds.length + result.updatedGroupIds.length;
      setNotice(`本地数据及全部版本已永久删除${groupImpact > 0 ? `，并修复了 ${groupImpact} 个相关业务主题` : ""}。`);
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
    <main className={`shell ${view === "settings" ? "shell-settings" : view === "knowledge" ? "shell-knowledge" : ""}`}>
      <aside className="rail" aria-label="主导航">
        <div className="brand-mark" aria-hidden="true">B</div>
        <button
          type="button"
          className={`rail-item ${view === "datasets" ? "rail-item-active" : ""}`}
          title="数据对象"
          data-label="数据对象"
          aria-label="数据对象"
          aria-pressed={view === "datasets"}
          onClick={() => setView("datasets")}
        ><Database aria-hidden="true" size={20} strokeWidth={1.9} /></button>
        <button
          type="button"
          className={`rail-item ${view === "groups" ? "rail-item-active" : ""}`}
          title="业务主题"
          data-label="业务主题"
          aria-label="业务主题"
          aria-pressed={view === "groups"}
          onClick={() => { setView("groups"); setSearch(""); }}
        ><UsersRound aria-hidden="true" size={20} strokeWidth={1.9} /></button>
        <button
          type="button"
          className={`rail-item ${view === "knowledge" ? "rail-item-active" : ""}`}
          title="业务知识"
          data-label="业务知识"
          aria-label="业务知识"
          aria-pressed={view === "knowledge"}
          onClick={() => setView("knowledge")}
        ><BookOpen aria-hidden="true" size={20} strokeWidth={1.9} /></button>
        <div className="rail-spacer" />
        <button
          type="button"
          className={`rail-item ${view === "settings" ? "rail-item-active" : ""}`}
          title="设置"
          data-label="设置"
          aria-label="设置"
          aria-pressed={view === "settings"}
          onClick={() => setView("settings")}
        ><Settings aria-hidden="true" size={20} strokeWidth={1.9} /></button>
      </aside>

      {(view === "datasets" || view === "groups") && <section className="object-browser">
        <header className="object-browser-header">
          <div>
            <p className="eyebrow">{view === "groups" ? "业务主题" : "本地数据助手"}</p>
            <h1>{view === "groups" ? "业务主题" : "BuBu"}</h1>
          </div>
          <button
            type="button"
            className="add-button"
            onClick={() => view === "groups" ? setSelectedGroupId(undefined) : void importFiles()}
            disabled={view !== "groups" && importing}
            aria-label={view === "groups" ? "创建业务主题" : "导入 Excel 或 CSV"}
            title={view === "groups" ? "创建业务主题" : "导入 Excel 或 CSV"}
          >
            {view !== "groups" && importing ? "…" : <Plus aria-hidden="true" size={19} strokeWidth={2.2} />}
          </button>
        </header>
        <label className="search-field">
          <span className="sr-only">搜索数据对象</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={view === "groups" ? "搜索业务主题" : "搜索数据对象"}
          />
        </label>

        <div className="contact-list" aria-busy={catalogLoading}>
          {catalogLoading && <p className="empty-copy">正在读取本地数据目录…</p>}
          {view !== "groups" && !catalogLoading && filteredDatasets.length === 0 && (
            <div className="empty-contact">
              <span className="contact-avatar"><Plus aria-hidden="true" size={18} /></span>
              <strong>{datasets.length === 0 ? "导入第一个表格" : "没有匹配的数据"}</strong>
              <small>{datasets.length === 0 ? "CSV 与 XLSX 会转换为本地表" : "尝试其他关键词"}</small>
              {datasets.length === 0 && <button type="button" className="secondary-action" onClick={() => void importFiles()} disabled={importing}>{importing ? "正在导入…" : "选择文件"}</button>}
            </div>
          )}
          {view !== "groups" && filteredDatasets.map((dataset) => (
            <button
              type="button"
              className={`contact-card ${dataset.id === selectedDatasetId ? "contact-card-active" : ""}`}
              key={dataset.id}
              onClick={() => setSelectedDatasetId(dataset.id)}
              onContextMenu={(event) => {
                event.preventDefault();
                setContactMenu({ kind: "dataset", dataset, x: event.clientX, y: event.clientY, returnFocus: event.currentTarget });
              }}
            >
              <span className="contact-avatar">{dataset.sourceKind === "derived" ? "D" : dataset.sourceKind === "xlsx" ? "X" : "C"}</span>
              <span>
                <strong>{dataset.displayName}</strong>
                <small>{dataset.sourceKind === "derived" ? "派生 · " : ""}{numberFormat.format(dataset.rowCount)} 行 · 版本 {dataset.version}</small>
              </span>
              <time>{new Date(dataset.importedAt).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}</time>
            </button>
          ))}
          {view === "groups" && !catalogLoading && filteredGroups.length === 0 && (
            <div className="empty-contact">
              <span className="contact-avatar"><Plus aria-hidden="true" size={18} /></span>
              <strong>创建第一个业务主题</strong>
              <small>组合 2–8 个数据对象</small>
              <button type="button" className="secondary-action" onClick={() => setSelectedGroupId(undefined)}>配置主题</button>
            </div>
          )}
          {view === "groups" && filteredGroups.map((group) => (
            <button
              type="button"
              className={`contact-card ${group.id === selectedGroupId ? "contact-card-active" : ""}`}
              key={group.id}
              onClick={() => setSelectedGroupId(group.id)}
              onContextMenu={(event) => {
                event.preventDefault();
                setContactMenu({ kind: "group", group, x: event.clientX, y: event.clientY, returnFocus: event.currentTarget });
              }}
            >
              <span className="contact-avatar">G</span>
              <span><strong>{group.name}</strong><small>{cadenceLabels[group.cadence]} · {group.members.length} 个数据对象</small></span>
            </button>
          ))}
        </div>
        <p className="local-note">{view === "groups" ? "主题保存对象关系与业务节奏 · 不复制原始数据" : "数据对象保存在本地 · 原始数据不会自动出站"}</p>
      </section>}

      <section className="workspace">
        <header className="workspace-header">
          <div className="workspace-identity">
            {view !== "settings" && <span className="workspace-avatar" aria-hidden="true">{view === "knowledge" ? "K" : view === "groups" ? "G" : selectedDataset?.sourceKind === "derived" ? "D" : selectedDataset?.sourceKind === "xlsx" ? "X" : "C"}</span>}
            <div>
              <p className="eyebrow">{view === "settings" ? "安全本地配置" : view === "knowledge" ? "版本化本地语料" : view === "groups" ? "业务数据主题" : "本地数据对象"}</p>
              <h2>{view === "settings" ? "设置" : view === "knowledge" ? "业务知识" : view === "groups" ? selectedGroup?.name ?? "创建业务主题" : selectedDataset?.displayName ?? "本地 AI 数据工作台"}</h2>
              {selectedDataset && view === "datasets" && <small>{selectedDataset.sourceName} · {numberFormat.format(selectedDataset.rowCount)} 行 · {selectedDataset.columnCount} 列</small>}
              {selectedGroup && view === "groups" && <small>{selectedGroup.description || `${selectedGroup.members.length} 个数据对象`} · {cadenceLabels[selectedGroup.cadence]}</small>}
            </div>
          </div>
          <div className="workspace-actions">
            {view === "datasets" && selectedDataset && <>
              <button type="button" className="secondary-action workspace-clean-action" disabled={preview.kind !== "loaded"} onClick={() => setDataCleanOpen(true)}><Sparkles size={15} />清理数据</button>
              <DatasetVersions dataset={selectedDataset} openRequest={versionOpenRequest} />
              <button type="button" className="dataset-menu-trigger" aria-label={`${selectedDataset.displayName} 的数据对象操作`} title="更多数据对象操作" onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setContactMenu({ kind: "dataset", dataset: selectedDataset, x: rect.right - 216, y: rect.bottom + 5, returnFocus: event.currentTarget }); }}><MoreHorizontal size={18} /></button>
            </>}
            {view === "groups" && selectedGroup && <span className="mode-pill">{cadenceLabels[selectedGroup.cadence]}</span>}
            <span className="service-presence" title={readiness.kind === "loaded" && readiness.value.status === "ready" ? "本地服务就绪" : "本地模式"}>
              <i />{readiness.kind === "loaded" && readiness.value.status === "ready" ? "本地服务运行中" : "本地服务启动中"}
            </span>
          </div>
        </header>

        <div ref={conversationRef} className={`conversation ${view === "settings" ? "conversation-settings" : ""}`}>
          {view === "datasets" && datasets.length > 0 && <OnboardingChecklist datasets={datasets} groups={groups} onAction={runOnboardingAction} onPrivacy={() => { setView("settings"); setSettingsSection("privacy"); }} />}
          {(view === "datasets" || view === "groups") && (datasets.length > 0 || groups.length > 0) && <RecurringWorkCenter datasets={datasets} groups={groups} onMappingRequired={setPendingMapping} onDatasetReplaced={activateReplacement} onOpen={(target, openReconciliation) => { setView(target.kind === "group" ? "groups" : "datasets"); if (target.kind === "group") { setSelectedGroupId(target.id); if (openReconciliation) setReconciliationOpenRequest((value) => value + 1); } else setSelectedDatasetId(target.id); }} />}
          {view === "knowledge" && <KnowledgeWorkspace />}
          {view === "settings" && <section className="settings-workbench" aria-label="设置工作台">
            <aside className="settings-sidebar">
              <nav className="settings-nav" aria-label="设置分类">
                <p className="hero-kicker">设置分类</p>
                <button type="button" className={settingsSection === "models" ? "settings-nav-active" : ""} aria-current={settingsSection === "models" ? "page" : undefined} onClick={() => setSettingsSection("models")}>模型与提供商<small>连接与默认模型</small></button>
                <button type="button" className={settingsSection === "prompts" ? "settings-nav-active" : ""} aria-current={settingsSection === "prompts" ? "page" : undefined} onClick={() => setSettingsSection("prompts")}>分析与输出<small>处理与表达偏好</small></button>
                <button type="button" className={settingsSection === "connectors" ? "settings-nav-active" : ""} aria-current={settingsSection === "connectors" ? "page" : undefined} onClick={() => setSettingsSection("connectors")}>本地连接器<small>MCP 与单次授权</small></button>
                <button type="button" className={settingsSection === "privacy" ? "settings-nav-active" : ""} aria-current={settingsSection === "privacy" ? "page" : undefined} onClick={() => setSettingsSection("privacy")}>隐私与恢复<small>审计、备份、恢复</small></button>
              </nav>
              <SettingsHealthOverview onNavigate={setSettingsSection} />
            </aside>
            <div className="settings-content">
              <header className="settings-content-context"><small>当前设置</small><strong>{settingsSection === "models" ? "模型与提供商" : settingsSection === "prompts" ? "分析与输出模板" : settingsSection === "connectors" ? "本地连接器" : "隐私与恢复"}</strong><span>{settingsSection === "models" ? "先在列表选择配置，再在详情区编辑、测试或设为当前。" : settingsSection === "prompts" ? "管理计划处理与聚合解读偏好；数据披露、严格输出类型和本地执行权限不会被模板覆盖。" : settingsSection === "connectors" ? "保存连接不会启动进程；发现、读取与调用仍分别批准。" : "查看本地审计，并创建或恢复独立的数据快照。"}</span></header>
              {settingsSection === "models" && <ProviderSettings />}
              {settingsSection === "prompts" && <PromptTemplateSettings />}
              {settingsSection === "connectors" && <><McpSettings /><RemoteMcpSettings /></>}
              {settingsSection === "privacy" && <><DataProtectionPanel onRestored={reloadCatalogAfterRestore} /><HubSettings /></>}
            </div>
          </section>}
          {view === "groups" && (
            <DatasetGroupWorkspace
              group={selectedGroup}
              datasets={datasets}
              editRequest={groupEditRequest}
              reconciliationOpenRequest={reconciliationOpenRequest}
              onSaved={(saved) => {
                setGroups((current) => [saved, ...current.filter(({ id }) => id !== saved.id)]);
                setSelectedGroupId(saved.id);
              }}
              onDeleted={(nextGroups) => {
                setGroups(nextGroups);
                setSelectedGroupId(nextGroups[0]?.id);
              }}
              onDatasetMaterialized={(dataset) => void showMaterializedDataset(dataset)}
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
            <EmptyWorkspace
              readiness={readiness}
              onImport={() => void importFiles()}
              onImportDemo={() => void importDemoWorkspace()}
              importing={importing}
              demoImporting={demoImporting}
              onStartTask={(taskId) => void importDemoWorkspace(taskId)}
            />
          )}
          {view === "datasets" && selectedDataset && (
            <DatasetWorkspace
              dataset={selectedDataset}
              preview={preview}
              replacing={replacing}
              pendingMapping={pendingMapping}
              onApplyMapping={(input) => void applyReplacementMapping(input)}
              onCancelMapping={() => setPendingMapping(undefined)}
              onDatasetMaterialized={(dataset) => void showMaterializedDataset(dataset)}
            />
          )}
        </div>

      </section>
      {renamingDatasets.length > 0 && <DatasetNameDialog datasets={renamingDatasets} busy={renamingBusy} onCancel={() => setRenamingDatasets([])} onSave={(names) => void saveDatasetNames(names)} />}
      {dataCleanOpen && selectedDataset && preview.kind === "loaded" && preview.value.datasetId === selectedDataset.id && <DataCleanDialog dataset={selectedDataset} preview={preview.value} initialTemplateId={dataCleanInitialTemplate} onClose={() => { setDataCleanOpen(false); setDataCleanInitialTemplate("monthly-prep"); }} onMaterialized={(dataset) => void showMaterializedDataset(dataset)} />}
      {contactMenu?.kind === "dataset" && <ContextMenu
        x={contactMenu.x}
        y={contactMenu.y}
        label={`${contactMenu.dataset.displayName} 的数据对象菜单`}
        returnFocus={contactMenu.returnFocus}
        onClose={() => setContactMenu(undefined)}
        items={[
          { label: "重命名数据对象", icon: <FilePenLine size={15} />, onSelect: () => { setSelectedDatasetId(contactMenu.dataset.id); setRenamingDatasets([contactMenu.dataset]); } },
          { label: "查看数据版本", icon: <FolderSync size={15} />, onSelect: () => { setSelectedDatasetId(contactMenu.dataset.id); setVersionOpenRequest((value) => value + 1); } },
          { label: "替换为新文件", icon: <FolderSync size={15} />, onSelect: () => { setSelectedDatasetId(contactMenu.dataset.id); void replaceFile(contactMenu.dataset.id); } },
          { label: "安全导出 CSV", icon: <Download size={15} />, onSelect: () => void exportDataset(contactMenu.dataset.id) },
          { label: "永久删除数据对象", icon: <Trash2 size={15} />, danger: true, disabled: lifecycleAction !== undefined, onSelect: () => void deleteDataset(contactMenu.dataset.id) },
        ]}
      />}
      {contactMenu?.kind === "group" && <ContextMenu
        x={contactMenu.x}
        y={contactMenu.y}
        label={`${contactMenu.group.name} 的业务主题菜单`}
        returnFocus={contactMenu.returnFocus}
        onClose={() => setContactMenu(undefined)}
        items={[
          { label: "打开业务主题", icon: <UsersRound size={15} />, onSelect: () => setSelectedGroupId(contactMenu.group.id) },
          { label: "编辑主题与运行节奏", icon: <Settings size={15} />, onSelect: () => { setSelectedGroupId(contactMenu.group.id); setGroupEditRequest((value) => value + 1); } },
          { label: "创建新业务主题", icon: <Plus size={15} />, onSelect: () => setSelectedGroupId(undefined) },
        ]}
      />}
    </main>
  );
}
