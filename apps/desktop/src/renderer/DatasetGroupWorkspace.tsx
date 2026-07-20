import { CalendarClock, Settings2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DatasetGroup, DatasetSummary } from "../shared/product-api.js";
import { DatasetGroupAnalysis } from "./DatasetGroupAnalysis.js";
import { DatasetRelationshipPanel } from "./DatasetRelationshipPanel.js";
import { ConversationWorkbench } from "./ConversationWorkbench.js";
import { ArtifactInspector } from "./ArtifactInspector.js";

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : "数据群组操作失败";
}

export function DatasetGroupWorkspace({
  group,
  datasets,
  editRequest,
  onSaved,
  onDeleted,
}: {
  readonly group: DatasetGroup | undefined;
  readonly datasets: readonly DatasetSummary[];
  readonly editRequest: number;
  readonly onSaved: (group: DatasetGroup) => void;
  readonly onDeleted: (groups: readonly DatasetGroup[]) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cadence, setCadence] = useState<DatasetGroup["cadence"]>("one-off");
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const editorRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    setName(group?.name ?? "");
    setDescription(group?.description ?? "");
    setCadence(group?.cadence ?? "one-off");
    setSelectedIds(group?.members.map(({ id }) => id) ?? []);
    setNotice(undefined);
  }, [group]);

  useEffect(() => {
    if (editRequest === 0) return;
    if (editorRef.current) editorRef.current.open = true;
    requestAnimationFrame(() => editorRef.current?.querySelector<HTMLInputElement>("input")?.focus());
  }, [editRequest]);

  function toggleDataset(datasetId: string): void {
    setSelectedIds((current) =>
      current.includes(datasetId)
        ? current.filter((id) => id !== datasetId)
        : current.length >= 8
          ? current
          : [...current, datasetId],
    );
  }

  async function save(): Promise<void> {
    setBusy(true);
    setNotice(undefined);
    try {
      const saved = await window.bubu.datasetGroups.save({
        ...(group === undefined ? {} : { id: group.id }),
        name,
        description,
        cadence,
        datasetIds: [...selectedIds],
      });
      onSaved(saved);
      setNotice("数据群组已保存在本地。 ");
    } catch (error) {
      setNotice(messageFrom(error));
    } finally {
      setBusy(false);
    }
  }

  async function remove(): Promise<void> {
    if (!group || !window.confirm(`删除数据群组「${group.name}」？原始数据联系人不会被删除。`)) return;
    setBusy(true);
    try {
      onDeleted(await window.bubu.datasetGroups.remove(group.id));
    } catch (error) {
      setNotice(messageFrom(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="group-workspace">
      <header className="group-topic-strip">
        <div>
          <span className="group-topic-icon"><CalendarClock size={16} /></span>
          <span><strong>{group?.description || "把业务相关的数据对象放进同一个对话上下文"}</strong><small>{group ? `${group.members.length} 个数据对象 · ${cadenceLabel(group.cadence)}` : "选择一次性或周期性业务主题"}</small></span>
        </div>
        {group && <button type="button" className="secondary-action compact-action" onClick={() => { if (editorRef.current) editorRef.current.open = true; }}><Settings2 size={14} />主题设置</button>}
      </header>
      {notice && <div className="notice" role="status">{notice}</div>}
      {group && <ConversationWorkbench target={{ kind: "group", id: group.id }} title="群组对话" subtitle="关联、查询结果和工作流都保存在各自任务中。" inspector={(threadId, view) => <ArtifactInspector initialView={view} workflowCadence={group.cadence} target={{ kind: "group", id: group.id }} threadId={threadId} fallback={<><header className="preview-header"><div><p className="hero-kicker">群组检查器</p><h3>关联与成员</h3></div><span>本地结构</span></header><DatasetRelationshipPanel group={group} /></>} />}>
        {(threadId, createThread, openArtifact) => <DatasetGroupAnalysis group={group} threadId={threadId} onCreateThread={createThread} onOpenArtifact={openArtifact} />}
      </ConversationWorkbench>}
      <details ref={editorRef} className="group-editor" open={group === undefined}>
        <summary>{group ? "编辑业务主题" : "配置业务主题"}</summary>
        <div className="group-editor-body">
        <label>
          <span>业务主题名称</span>
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="例如：华东销售周报" />
        </label>
        <label>
          <span>这组数据要解决什么问题</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={240} rows={2} placeholder="例如：每周汇总门店销售、目标和退款，并把异常发送到当前对话" />
        </label>
        <fieldset className="cadence-picker">
          <legend>业务节奏</legend>
          <div>
            {(["one-off", "daily", "weekly", "monthly", "dataset-version"] as const).map((value) => <label className={cadence === value ? "cadence-selected" : ""} key={value}><input type="radio" name="group-cadence" value={value} checked={cadence === value} onChange={() => setCadence(value)} /><strong>{cadenceLabel(value)}</strong><small>{cadenceDescription(value)}</small></label>)}
          </div>
        </fieldset>
        <fieldset>
          <legend>选择数据对象（{selectedIds.length}/8）</legend>
          {datasets.length === 0 && <p className="empty-copy">请先导入至少两个 CSV 或 Excel 数据联系人。</p>}
          <div className="group-member-picker">
            {datasets.map((dataset) => {
              const checked = selectedIds.includes(dataset.id);
              return (
                <label className={`group-member-option ${checked ? "group-member-selected" : ""}`} key={dataset.id}>
                  <input type="checkbox" checked={checked} onChange={() => toggleDataset(dataset.id)} disabled={!checked && selectedIds.length >= 8} />
                  <span className="contact-avatar">{dataset.sourceKind === "xlsx" ? "X" : "C"}</span>
                  <span><strong>{dataset.displayName}</strong><small>{dataset.rowCount} 行 · 版本 {dataset.version}</small></span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <div className="group-actions">
          <button type="button" className="primary-action" onClick={() => void save()} disabled={busy || name.trim().length === 0 || selectedIds.length < 2}>
            {busy ? "正在保存…" : group ? "保存群组" : "创建群组"}
          </button>
          {group && <button type="button" className="secondary-action" onClick={() => void remove()} disabled={busy}>删除群组</button>}
        </div>
        </div>
      </details>
    </section>
  );
}

function cadenceLabel(cadence: DatasetGroup["cadence"]): string {
  return { "one-off": "一次性", daily: "每天", weekly: "每周", monthly: "每月", "dataset-version": "数据更新时" }[cadence];
}

function cadenceDescription(cadence: DatasetGroup["cadence"]): string {
  return {
    "one-off": "临时分析，按需收尾",
    daily: "适合日清和每日运营",
    weekly: "适合周报和周期复盘",
    monthly: "适合月结与经营汇总",
    "dataset-version": "任一成员替换版本后触发",
  }[cadence];
}
