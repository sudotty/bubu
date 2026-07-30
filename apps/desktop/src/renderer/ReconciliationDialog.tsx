import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, Download, Scale, ShieldCheck, X } from "lucide-react";
import type { DatasetGroup, DatasetPreview, ReconciliationArtifact, ReconciliationDefinition, ReconciliationPlan, ReconciliationProposal, ReconciliationReplayEvent } from "../shared/product-api.js";
import { createOperationId, operationErrorMessage } from "./operation.js";
import { recordProductMetric } from "./product-metrics.js";

const numberFormat = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 4 });
const categoryLabels = { matched: "已匹配", "tolerance-matched": "容差匹配", "left-unmatched": "左侧未匹配", "right-unmatched": "右侧未匹配", "left-duplicate": "左侧重复", "right-duplicate": "右侧重复", conflict: "冲突", pending: "未决" } as const;
const replayStatusLabels = { pending: "等待执行", running: "执行中", succeeded: "已完成", paused: "需要审查", failed: "执行失败", cancelled: "已取消" } as const;
const replayReasonLabels = { "schema-drift": "来源列结构已变化", "cardinality-change": "重复或未决数量超出受审基线", "control-total-change": "控制总额差异超出受审基线", "quality-change": "来源质量分低于受审基线", "stale-source": "已被更新的来源版本取代", "execution-error": "本地执行失败", cancelled: "用户已取消" } as const;

export function ReconciliationDialog({ group, onClose }: { readonly group: DatasetGroup; readonly onClose: () => void }) {
  const [leftId, setLeftId] = useState(group.members[0]?.id ?? "");
  const [rightId, setRightId] = useState(group.members[1]?.id ?? "");
  const [leftPreview, setLeftPreview] = useState<DatasetPreview>();
  const [rightPreview, setRightPreview] = useState<DatasetPreview>();
  const [leftKey, setLeftKey] = useState(""); const [rightKey, setRightKey] = useState("");
  const [leftAmount, setLeftAmount] = useState(""); const [rightAmount, setRightAmount] = useState("");
  const [cardinality, setCardinality] = useState<"one-to-one" | "one-to-many">("one-to-one");
  const [amountTolerance, setAmountTolerance] = useState(0.01);
  const [proposal, setProposal] = useState<ReconciliationProposal>();
  const [artifact, setArtifact] = useState<ReconciliationArtifact>();
  const [artifacts, setArtifacts] = useState<readonly ReconciliationArtifact[]>([]);
  const [replayEvents, setReplayEvents] = useState<readonly ReconciliationReplayEvent[]>([]);
  const [savedDefinition, setSavedDefinition] = useState<ReconciliationDefinition>();
  const [busy, setBusy] = useState<"loading" | "preview" | "execute" | "save" | "replay" | "report" | undefined>("loading");
  const [notice, setNotice] = useState<string>();
  const left = group.members.find(({ id }) => id === leftId); const right = group.members.find(({ id }) => id === rightId);
  const memberIds = useMemo(() => group.members.map(({ id }) => id), [group.members]);

  async function refreshDurableEvidence(): Promise<void> {
    const [nextArtifacts, nextEvents] = await Promise.all([
      window.bubu.reconciliation.artifacts(memberIds),
      window.bubu.reconciliation.replayEvents(memberIds),
    ]);
    setArtifacts(nextArtifacts); setReplayEvents(nextEvents);
  }

  useEffect(() => () => { if (proposal) void window.bubu.reconciliation.dismiss(proposal.approvalToken); }, [proposal]);
  useEffect(() => {
    let active = true;
    void Promise.all([window.bubu.reconciliation.artifacts(memberIds), window.bubu.reconciliation.replayEvents(memberIds)])
      .then(([nextArtifacts, nextEvents]) => { if (active) { setArtifacts(nextArtifacts); setReplayEvents(nextEvents); } })
      .catch((error) => { if (active) setNotice(operationErrorMessage(error, "无法读取历史对账证据")); });
    return () => { active = false; };
  }, [memberIds]);
  useEffect(() => {
    if (!left || !right || left.id === right.id) return;
    let active = true; setBusy("loading"); setProposal(undefined); setArtifact(undefined); setNotice(undefined);
    void Promise.all([window.bubu.datasets.preview({ datasetId: left.id, limit: 1, offset: 0 }), window.bubu.datasets.preview({ datasetId: right.id, limit: 1, offset: 0 })]).then(([nextLeft, nextRight]) => {
      if (!active) return; setLeftPreview(nextLeft); setRightPreview(nextRight);
      setLeftKey(nextLeft.columns[0]?.name ?? ""); setRightKey(nextRight.columns[0]?.name ?? "");
      setLeftAmount(nextLeft.columns.find(({ inferredType }) => inferredType === "real" || inferredType === "integer")?.name ?? nextLeft.columns[0]?.name ?? "");
      setRightAmount(nextRight.columns.find(({ inferredType }) => inferredType === "real" || inferredType === "integer")?.name ?? nextRight.columns[0]?.name ?? "");
    }).catch((error) => { if (active) setNotice(operationErrorMessage(error, "无法读取对账来源结构")); }).finally(() => { if (active) setBusy((current) => current === "loading" ? undefined : current); });
    return () => { active = false; };
  }, [left?.id, right?.id]);

  const plan = useMemo<ReconciliationPlan | undefined>(() => left && right && leftPreview && rightPreview && leftKey && rightKey && leftAmount && rightAmount && left.id !== right.id ? {
    schemaVersion: 1, purpose: `${left.displayName}与${right.displayName}对账`,
    comparison: { schemaVersion: 1, purpose: `${left.displayName}与${right.displayName}比较`, sources: { left: { datasetId: left.id, versionId: left.versionId }, right: { datasetId: right.id, versionId: right.versionId } }, match: { keys: [{ leftColumn: leftKey, rightColumn: rightKey, normalization: ["trim", "case-fold", "collapse-whitespace"] }], cardinality, amountTolerance: { leftColumn: leftAmount, rightColumn: rightAmount, absolute: amountTolerance } }, budgets: { maximumCandidatePairs: 100_000, timeoutMs: 30_000 } },
    controlTotals: [{ id: "gross", leftColumn: leftAmount, rightColumn: rightAmount, aggregation: "sum", tolerance: amountTolerance }], unresolvedPolicy: "review-required",
  } : undefined, [amountTolerance, cardinality, left, leftAmount, leftKey, leftPreview, right, rightAmount, rightKey, rightPreview]);

  async function prepare(): Promise<void> { if (!plan) return; setBusy("preview"); setNotice(undefined); try { const next = await window.bubu.reconciliation.prepare({ plan }, createOperationId()); setProposal(next); recordProductMetric({ name: "reconciliation_previewed", targetKind: "group", outcome: "succeeded" }); } catch (error) { setNotice(operationErrorMessage(error, "无法生成对账预览")); recordProductMetric({ name: "reconciliation_previewed", targetKind: "group", outcome: "failed" }); } finally { setBusy(undefined); } }
  async function execute(): Promise<void> { if (!proposal) return; setBusy("execute"); setNotice(undefined); try { const next = await window.bubu.reconciliation.approve(proposal.approvalToken, createOperationId()); setProposal(undefined); setArtifact(next); setArtifacts((current) => [next, ...current.filter(({ id }) => id !== next.id)].slice(0, 20)); recordProductMetric({ name: "reconciliation_result_ready", targetKind: "group", outcome: "succeeded", rowCount: next.completion.classificationCount, columnCount: 5 }); } catch (error) { setNotice(operationErrorMessage(error, "对账执行失败；没有生成部分结果")); recordProductMetric({ name: "reconciliation_result_ready", targetKind: "group", outcome: "failed" }); } finally { setBusy(undefined); } }
  async function saveDefinition(): Promise<void> { if (!artifact) return; setBusy("save"); setNotice(undefined); try { const definition = await window.bubu.reconciliation.saveDefinition(artifact.id); setSavedDefinition(definition); setNotice("已保存为受审下期任务；来源版本更新后会本地重放，漂移时暂停等待审查。"); } catch (error) { setNotice(operationErrorMessage(error, "无法保存受审下期任务")); } finally { setBusy(undefined); } }
  async function transitionReplay(event: ReconciliationReplayEvent, action: "retry" | "cancel"): Promise<void> { setBusy("replay"); setNotice(undefined); try { if (action === "retry") await window.bubu.reconciliation.retryReplay(event.id); else await window.bubu.reconciliation.cancelReplay(event.id); await refreshDurableEvidence(); setNotice(action === "retry" ? "已重新排队；后台调度会按最新来源重新检查。" : "已取消这次重放。"); } catch (error) { setNotice(operationErrorMessage(error, action === "retry" ? "无法重试这次重放" : "无法取消这次重放")); } finally { setBusy(undefined); } }
  const actionInput = artifact ? { title: artifact.plan.purpose, columns: ["分类", "左侧行", "右侧行", "匹配键", "原因"], rows: artifact.classifications.slice(0, 200).map((item) => [categoryLabels[item.category], item.leftRowNumber ?? null, item.rightRowNumber ?? null, item.key, item.reason]) } : undefined;
  async function copyOrExport(kind: "copy" | "export"): Promise<void> { if (!actionInput) return; if (kind === "copy") { const outcome = await window.bubu.artifacts.copyTable(actionInput); setNotice(`已复制 ${outcome.rowCount} 条当前证据`); return; } const outcome = await window.bubu.artifacts.exportTable(actionInput); setNotice(outcome.status === "exported" ? `已导出 ${outcome.rowCount} 条当前证据` : "已取消导出"); }
  async function exportReportBundle(): Promise<void> {
    if (!artifact || !actionInput) return;
    setBusy("report"); setNotice(undefined);
    try {
      const counts = artifact.counts;
      const outcome = await window.bubu.artifacts.exportReport({
        schemaVersion: 1, kind: "reconciliation", title: artifact.plan.purpose,
        summary: "按受审精确键、容差、基数与控制总额在本地完成的确定性对账。",
        deterministicFacts: [
          { label: "已匹配", value: counts.matched }, { label: "容差匹配", value: counts.toleranceMatched },
          { label: "左侧未匹配", value: counts.leftUnmatched }, { label: "右侧未匹配", value: counts.rightUnmatched },
          { label: "重复", value: counts.leftDuplicate + counts.rightDuplicate }, { label: "冲突", value: counts.conflict }, { label: "未决", value: counts.pending },
          ...artifact.controlTotals.flatMap((total) => [{ label: `${total.id} 左侧总额`, value: total.leftValue }, { label: `${total.id} 右侧总额`, value: total.rightValue }, { label: `${total.id} 差额`, value: total.difference }, { label: `${total.id} 是否平衡`, value: total.balanced }]),
        ],
        tables: [{ name: "异常与匹配证据", columns: actionInput.columns, rows: actionInput.rows }],
        quality: artifact.sources.map((source) => ({ label: `${source.displayName} 质量分`, value: source.qualityScore })),
        exceptions: [counts.leftUnmatched + counts.rightUnmatched > 0 ? `存在 ${counts.leftUnmatched + counts.rightUnmatched} 条未匹配记录。` : "没有未匹配记录。", counts.pending > 0 ? `存在 ${counts.pending} 条未决候选，需要人工处理。` : "没有未决候选。"],
        limitations: [...artifact.limitations, artifact.classifications.length > actionInput.rows.length ? `明细表仅包含当前安全视图前 ${actionInput.rows.length} 条；完整分类仍保存在不可变 Artifact 中。` : "明细表包含全部分类。"],
        lineage: artifact.sources.flatMap((source) => [{ label: `${source.side === "left" ? "左侧" : "右侧"}对象`, value: source.displayName }, { label: `${source.side === "left" ? "左侧" : "右侧"}版本`, value: source.versionId }]),
        runMetadata: [{ label: "Artifact", value: artifact.id }, { label: "计划指纹", value: artifact.planFingerprint }, { label: "审查方式", value: artifact.completion.reviewKind }, { label: "创建时间", value: artifact.createdAt }],
      });
      setNotice(outcome.status === "exported" ? `已生成专业报告包“${outcome.bundleName}” · ${outcome.fileCount} 个文件` : "已取消报告导出");
      recordProductMetric({ name: "artifact_exported", targetKind: "group", outcome: outcome.status === "exported" ? "succeeded" : "cancelled", ...(outcome.status === "exported" ? { rowCount: actionInput.rows.length, columnCount: actionInput.columns.length } : {}) });
      recordProductMetric({ name: "report_bundle_exported", targetKind: "group", outcome: outcome.status === "exported" ? "succeeded" : "cancelled", ...(outcome.status === "exported" ? { rowCount: actionInput.rows.length, columnCount: actionInput.columns.length } : {}) });
    } catch (error) { setNotice(operationErrorMessage(error, "无法生成专业报告包")); }
    finally { setBusy(undefined); }
  }

  return <div className="modal-backdrop" role="presentation"><section className="reconciliation-dialog" role="dialog" aria-modal="true" aria-labelledby="reconciliation-title">
    <header><div><p className="eyebrow">本地确定性核对</p><h3 id="reconciliation-title"><Scale size={19} />Reconcile</h3><small>原始行留在设备；未决候选不会自动确认。</small></div><button type="button" className="icon-button" aria-label="关闭 Reconcile" onClick={onClose}><X size={18} /></button></header>
    {!proposal && !artifact && <div className="reconciliation-builder">
      <div className="reconciliation-source-grid"><label><span>左侧对象</span><select value={leftId} onChange={(event) => setLeftId(event.target.value)}>{group.members.map((item) => <option key={item.id} value={item.id}>{item.displayName} · 版本 {item.version}</option>)}</select></label><label><span>右侧对象</span><select value={rightId} onChange={(event) => setRightId(event.target.value)}>{group.members.map((item) => <option key={item.id} value={item.id}>{item.displayName} · 版本 {item.version}</option>)}</select></label></div>
      {leftId === rightId && <p className="error-text">请选择两个不同的数据对象。</p>}
      <fieldset><legend>规范化精确匹配键</legend><div className="reconciliation-source-grid"><label><span>{left?.displayName} 键</span><select value={leftKey} onChange={(event) => setLeftKey(event.target.value)}>{leftPreview?.columns.map(({ name }) => <option key={name}>{name}</option>)}</select></label><label><span>{right?.displayName} 键</span><select value={rightKey} onChange={(event) => setRightKey(event.target.value)}>{rightPreview?.columns.map(({ name }) => <option key={name}>{name}</option>)}</select></label></div><small>依次执行去首尾空格、大小写折叠和连续空白折叠；不执行模糊匹配。</small></fieldset>
      <fieldset><legend>金额与控制总额</legend><div className="reconciliation-source-grid"><label><span>左侧金额</span><select value={leftAmount} onChange={(event) => setLeftAmount(event.target.value)}>{leftPreview?.columns.map(({ name }) => <option key={name}>{name}</option>)}</select></label><label><span>右侧金额</span><select value={rightAmount} onChange={(event) => setRightAmount(event.target.value)}>{rightPreview?.columns.map(({ name }) => <option key={name}>{name}</option>)}</select></label><label><span>绝对容差</span><input type="number" min={0} step="0.01" value={amountTolerance} onChange={(event) => setAmountTolerance(Math.max(0, Number(event.target.value)))} /></label><label><span>基数</span><select value={cardinality} onChange={(event) => setCardinality(event.target.value as typeof cardinality)}><option value="one-to-one">一对一</option><option value="one-to-many">一对多（左侧键必须唯一）</option></select></label></div></fieldset>
      <div className="reconciliation-actions"><button type="button" className="secondary-action" onClick={onClose}>取消</button><button type="button" className="primary-action" disabled={!plan || busy !== undefined} onClick={() => void prepare()}>{busy ? "正在本地计算…" : "预览对账"}</button></div>
    </div>}
    {proposal && <div className="reconciliation-review"><div className="reconciliation-review-title"><ShieldCheck size={20} /><div><strong>执行前审查</strong><small>批准绑定两个不可变版本、匹配键、容差、基数、控制总额、预算和计划指纹，且只能使用一次。</small></div></div><SourceEvidence proposal={proposal} /><CountGrid proposal={proposal} /><ControlTotals proposal={proposal} /><dl><div><dt>候选对数</dt><dd>{numberFormat.format(proposal.preview.candidatePairs)} / 100,000</dd></div><div><dt>计划指纹</dt><dd><code>{proposal.preview.planFingerprint}</code></dd></div></dl><ul>{proposal.preview.limitations.map((item) => <li key={item}>{item}</li>)}</ul><div className="reconciliation-actions"><button type="button" className="secondary-action" disabled={busy !== undefined} onClick={() => { void window.bubu.reconciliation.dismiss(proposal.approvalToken); setProposal(undefined); }}>返回修改</button><button type="button" className="primary-action" disabled={busy !== undefined} onClick={() => void execute()}>{busy === "execute" ? "正在原子生成…" : "批准并生成 Reconcile Artifact"}</button></div></div>}
    {artifact && <div className="reconciliation-artifact"><div className="reconciliation-complete"><CheckCircle2 size={21} /><div><strong>对账完成</strong><small>Artifact {artifact.id.slice(0, 8)} · {artifact.completion.classificationCount} 条分类 · {artifact.completion.reviewKind === "reviewed-replay" ? "受审任务自动重放" : "一次性审批"} · 完整结果已原子保存</small></div></div><SourceEvidence proposal={{ preview: artifact }} /><CountGrid proposal={{ preview: artifact }} /><ControlTotals proposal={{ preview: artifact }} /><section className="reconciliation-evidence"><header><strong>异常与人工处理证据</strong><div><button type="button" onClick={() => void copyOrExport("copy")}><Copy size={14} />复制当前证据</button><button type="button" onClick={() => void copyOrExport("export")}><Download size={14} />导出 CSV</button></div></header><div className="table-scroll"><table><thead><tr><th>分类</th><th>左侧行</th><th>右侧行</th><th>匹配键</th><th>原因</th></tr></thead><tbody>{artifact.classifications.slice(0, 200).map((item, index) => <tr key={`${item.category}:${index}`}><td>{categoryLabels[item.category]}</td><td>{item.leftRowNumber ?? "—"}</td><td>{item.rightRowNumber ?? "—"}</td><td>{item.key}</td><td>{item.reason}</td></tr>)}</tbody></table></div><small>显示前 {Math.min(200, artifact.classifications.length)} / {artifact.classifications.length} 条；复制和导出仅包含当前安全视图。</small></section>{artifact.completion.reviewKind === "one-use-approval" && <div className="reconciliation-actions"><button type="button" className="secondary-action" disabled={busy !== undefined || savedDefinition?.lastArtifactId === artifact.id} onClick={() => void saveDefinition()}>{savedDefinition?.lastArtifactId === artifact.id ? "已保存为下期任务" : busy === "save" ? "正在保存…" : "保存为受审下期任务"}</button><button type="button" className="primary-action" onClick={() => { setArtifact(undefined); setSavedDefinition(undefined); }}>新建对账</button></div>}</div>}
    {(artifacts.length > 0 || replayEvents.length > 0) && <section className="reconciliation-history" aria-label="长期对账记录"><header><div><strong>长期证据与下期状态</strong><small>Artifact 不可变；重放只在受审规则内自动完成，风险漂移会暂停。</small></div><button type="button" disabled={busy !== undefined} onClick={() => void refreshDurableEvidence()}>刷新</button></header>{replayEvents.length > 0 && <div className="reconciliation-replay-list">{replayEvents.slice(0, 8).map((event) => <article key={event.id} data-status={event.status}><div><strong>{replayStatusLabels[event.status]}</strong><small>任务 {event.definitionId.slice(0, 8)} · 尝试 {event.attempt}/3 · {event.reasonKind ? replayReasonLabels[event.reasonKind] : "来源版本已登记"}</small></div><div>{event.artifactId && <button type="button" onClick={() => void window.bubu.reconciliation.artifact(event.artifactId!).then(setArtifact)}>打开结果</button>}{["paused", "failed", "cancelled"].includes(event.status) && event.attempt < 3 && <button type="button" disabled={busy !== undefined} onClick={() => void transitionReplay(event, "retry")}>重试</button>}{["pending", "paused", "failed"].includes(event.status) && <button type="button" disabled={busy !== undefined} onClick={() => void transitionReplay(event, "cancel")}>取消</button>}</div></article>)}</div>}<div className="reconciliation-artifact-list">{artifacts.slice(0, 8).map((item) => <button type="button" key={item.id} className={artifact?.id === item.id ? "is-active" : ""} onClick={() => setArtifact(item)}><span><strong>{item.plan.purpose}</strong><small>{new Date(item.createdAt).toLocaleString("zh-CN")} · {item.completion.reviewKind === "reviewed-replay" ? "受审重放" : "一次性审批"}</small></span><b>{item.completion.classificationCount} 条</b></button>)}</div></section>}
    {artifact && <div className="reconciliation-actions"><button type="button" className="primary-action" disabled={busy !== undefined} onClick={() => void exportReportBundle()}><Download size={14} />{busy === "report" ? "正在生成报告包…" : "导出专业报告包"}</button></div>}
    {notice && <p className="artifact-action-notice" role="status">{notice}</p>}
  </section></div>;
}

function SourceEvidence({ proposal }: { readonly proposal: Pick<ReconciliationProposal, "preview"> }) { return <div className="reconciliation-sources">{proposal.preview.sources.map((source) => <span key={source.side}><strong>{source.side === "left" ? "左侧" : "右侧"} · {source.displayName}</strong><small>版本 {source.versionId.slice(0, 8)} · {source.rowCount} 行 · 质量 {source.qualityScore}</small></span>)}</div>; }
function CountGrid({ proposal }: { readonly proposal: Pick<ReconciliationProposal, "preview"> }) { const counts = proposal.preview.counts; return <div className="reconciliation-counts">{([["已匹配", counts.matched], ["容差匹配", counts.toleranceMatched], ["左侧未匹配", counts.leftUnmatched], ["右侧未匹配", counts.rightUnmatched], ["重复", counts.leftDuplicate+counts.rightDuplicate], ["冲突", counts.conflict], ["未决", counts.pending]] as const).map(([label, value]) => <span key={label}><strong>{numberFormat.format(value)}</strong>{label}</span>)}</div>; }
function ControlTotals({ proposal }: { readonly proposal: Pick<ReconciliationProposal, "preview"> }) { return <section className="reconciliation-totals"><strong>控制总额</strong>{proposal.preview.controlTotals.map((total) => <div key={total.id}><span>左 {numberFormat.format(total.leftValue)}</span><span>右 {numberFormat.format(total.rightValue)}</span><span>差额 {numberFormat.format(total.difference)}</span><b className={total.balanced ? "is-balanced" : "is-unbalanced"}>{total.balanced ? "平衡" : "不平衡"}</b></div>)}</section>; }
