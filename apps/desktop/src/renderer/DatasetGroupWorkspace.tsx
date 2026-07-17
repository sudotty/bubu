import { useEffect, useState } from "react";
import type { DatasetGroup, DatasetSummary } from "../shared/product-api.js";
import { DatasetGroupAnalysis } from "./DatasetGroupAnalysis.js";
import { DatasetRelationshipPanel } from "./DatasetRelationshipPanel.js";

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : "数据群组操作失败";
}

export function DatasetGroupWorkspace({
  group,
  datasets,
  onSaved,
  onDeleted,
}: {
  readonly group: DatasetGroup | undefined;
  readonly datasets: readonly DatasetSummary[];
  readonly onSaved: (group: DatasetGroup) => void;
  readonly onDeleted: (groups: readonly DatasetGroup[]) => void;
}) {
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    setName(group?.name ?? "");
    setSelectedIds(group?.members.map(({ id }) => id) ?? []);
    setNotice(undefined);
  }, [group]);

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
      <header className="group-hero">
        <div>
          <p className="hero-kicker">DATASET GROUP · LOCAL ONLY</p>
          <h3>{group?.name ?? "创建数据群组"}</h3>
          <p>把 2–8 个数据联系人放进同一个群组，成员始终指向各自最新的不可变版本。群组本身不复制原始数据。</p>
        </div>
        {group && <span className="mode-pill">{group.members.length} 个成员</span>}
      </header>
      {notice && <div className="notice" role="status">{notice}</div>}
      <div className="group-editor">
        <label>
          <span>群组名称</span>
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="例如：销售与目标对比" />
        </label>
        <fieldset>
          <legend>选择数据联系人（{selectedIds.length}/8）</legend>
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
      {group && <DatasetRelationshipPanel group={group} />}
      {group && <DatasetGroupAnalysis group={group} />}
    </section>
  );
}
