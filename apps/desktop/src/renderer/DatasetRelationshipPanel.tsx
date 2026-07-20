import { useEffect, useState } from "react";
import type {
  DatasetGroup,
  DatasetQualityReport,
  DatasetRelationshipSaveInput,
  GroupRelationshipOverview,
  RelationshipEndpoint,
} from "../shared/product-api.js";

type RelationshipState =
  | { readonly kind: "loading" }
  | {
      readonly kind: "loaded";
      readonly overview: GroupRelationshipOverview;
      readonly qualityByDataset: Readonly<Record<string, DatasetQualityReport>>;
    }
  | { readonly kind: "failed"; readonly message: string };

const issueLabels = {
  "missing-column": "当前版本缺少列",
  "type-mismatch": "当前版本列类型不兼容",
  "right-not-unique": "右侧当前版本不再是非空唯一键",
} as const;

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : "读取关系失败";
}

function memberName(group: DatasetGroup, datasetId: string): string {
  return group.members.find(({ id }) => id === datasetId)?.displayName ?? "未知数据联系人";
}

function endpointLabel(group: DatasetGroup, endpoint: RelationshipEndpoint): string {
  return `${memberName(group, endpoint.datasetId)} · ${endpoint.column}`;
}

export function DatasetRelationshipPanel({ group }: { readonly group: DatasetGroup }) {
  const [state, setState] = useState<RelationshipState>({ kind: "loading" });
  const [leftDatasetId, setLeftDatasetId] = useState(group.members[0]?.id ?? "");
  const [rightDatasetId, setRightDatasetId] = useState(group.members[1]?.id ?? "");
  const [leftColumn, setLeftColumn] = useState("");
  const [rightColumn, setRightColumn] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();

  async function load(active: () => boolean = () => true): Promise<void> {
    try {
      const [overview, qualityEntries] = await Promise.all([
        window.bubu.datasetRelationships.overview(group.id),
        Promise.all(group.members.map(async ({ id }) => [id, await window.bubu.datasets.quality(id)] as const)),
      ]);
      if (!active()) return;
      const qualityByDataset = Object.fromEntries(qualityEntries);
      setState({ kind: "loaded", overview, qualityByDataset });
      const initialLeft = group.members[0]?.id ?? "";
      const initialRight = group.members.find(({ id }) => id !== initialLeft)?.id ?? "";
      setLeftDatasetId(initialLeft);
      setRightDatasetId(initialRight);
      setLeftColumn(qualityByDataset[initialLeft]?.columns[0]?.name ?? "");
      setRightColumn(qualityByDataset[initialRight]?.columns[0]?.name ?? "");
    } catch (error) {
      if (active()) setState({ kind: "failed", message: messageFrom(error) });
    }
  }

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    setNotice(undefined);
    void load(() => active);
    return () => { active = false; };
  }, [group.id, group.updatedAt]);

  async function save(input: DatasetRelationshipSaveInput): Promise<void> {
    setBusy(true);
    setNotice(undefined);
    try {
      await window.bubu.datasetRelationships.save(input);
      await load();
      setNotice("关系已保存在本地，并会在后续群组计划中作为结构提示发送给模型");
    } catch (error) {
      setNotice(messageFrom(error));
    } finally {
      setBusy(false);
    }
  }

  async function remove(relationshipId: string): Promise<void> {
    setBusy(true);
    try {
      await window.bubu.datasetRelationships.remove(relationshipId);
      await load();
      setNotice("关系已删除");
    } catch (error) {
      setNotice(messageFrom(error));
    } finally {
      setBusy(false);
    }
  }

  if (state.kind === "loading") return <section className="relationship-panel">正在本地发现可复用关系…</section>;
  if (state.kind === "failed") return <section className="relationship-panel error-text">{state.message}</section>;
  const { overview, qualityByDataset } = state;
  const leftColumns = qualityByDataset[leftDatasetId]?.columns ?? [];
  const rightColumns = qualityByDataset[rightDatasetId]?.columns ?? [];
  const selectedLeftColumn = leftColumns.some(({ name }) => name === leftColumn) ? leftColumn : leftColumns[0]?.name ?? "";
  const selectedRightColumn = rightColumns.some(({ name }) => name === rightColumn) ? rightColumn : rightColumns[0]?.name ?? "";

  return (
    <section className="relationship-panel" aria-label="可复用数据关系">
      <header className="preview-header">
        <div><p className="hero-kicker">可复用的等值关系</p><h3>数据关系</h3></div>
        <span>{overview.relationships.length} 条已保存</span>
      </header>
      <p className="quality-copy">左侧可以多行匹配，右侧必须是当前版本中的非空唯一键。每次替换数据后都会重新验证，不满足时会标记失效。</p>
      {notice && <div className="notice" role="status">{notice}</div>}

      <div className="relationship-list">
        {overview.relationships.map((relationship) => (
          <div className={`relationship-row relationship-${relationship.status}`} key={relationship.id}>
            <span>{endpointLabel(group, relationship.left)}</span>
            <strong>→ lookup →</strong>
            <span>{endpointLabel(group, relationship.right)}</span>
            <small>{relationship.issue ? issueLabels[relationship.issue] : "当前版本有效"}</small>
            <button type="button" disabled={busy} onClick={() => void remove(relationship.id)}>删除</button>
          </div>
        ))}
        {overview.relationships.length === 0 && <p className="empty-copy">尚未保存数据关系。</p>}
      </div>

      {overview.candidates.length > 0 && (
        <div className="relationship-candidates">
          <h4>本地发现</h4>
          {overview.candidates.slice(0, 20).map((candidate) => (
            <button
              type="button"
              disabled={busy}
              key={`${candidate.left.datasetId}-${candidate.left.column}-${candidate.right.datasetId}-${candidate.right.column}`}
              onClick={() => void save({ left: candidate.left, right: candidate.right })}
            >
              <span>{endpointLabel(group, candidate.left)}</span><strong>→</strong><span>{endpointLabel(group, candidate.right)}</span><small>同名列 · 右侧唯一，点击保存</small>
            </button>
          ))}
        </div>
      )}

      <div className="manual-relationship">
        <h4>手动定义 lookup</h4>
        <div className="relationship-editor-grid">
          <select value={leftDatasetId} onChange={(event) => { setLeftDatasetId(event.target.value); setLeftColumn(""); }}>
            {group.members.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}
          </select>
          <select value={selectedLeftColumn} onChange={(event) => setLeftColumn(event.target.value)}>
            {leftColumns.map(({ name }) => <option key={name} value={name}>{name}</option>)}
          </select>
          <span>多对一 →</span>
          <select value={rightDatasetId} onChange={(event) => { setRightDatasetId(event.target.value); setRightColumn(""); }}>
            {group.members.map((member) => <option key={member.id} value={member.id} disabled={member.id === leftDatasetId}>{member.displayName}</option>)}
          </select>
          <select value={selectedRightColumn} onChange={(event) => setRightColumn(event.target.value)}>
            {rightColumns.map(({ name }) => <option key={name} value={name}>{name}</option>)}
          </select>
          <button
            type="button"
            className="secondary-action"
            disabled={busy || leftDatasetId === rightDatasetId || !selectedLeftColumn || !selectedRightColumn}
            onClick={() => void save({
              left: { datasetId: leftDatasetId, column: selectedLeftColumn },
              right: { datasetId: rightDatasetId, column: selectedRightColumn },
            })}
          >保存关系</button>
        </div>
      </div>
    </section>
  );
}
