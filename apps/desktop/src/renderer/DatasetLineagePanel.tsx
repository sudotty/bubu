import { AlertTriangle, CheckCircle2, Clock3, Database, Download, RefreshCw, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type { DerivedDatasetLineage, DerivedDependencyPlan, DerivedRecomputeEvent, DatasetSummary } from "../shared/product-api.js";
import { createOperationId, operationErrorMessage } from "./operation.js";
import { recordProductMetric } from "./product-metrics.js";

const numberFormat = new Intl.NumberFormat("zh-CN");
const reviewLabels = { "reviewed-plan": "既有审查计划", "one-use-approval": "一次性审查批准", "reviewed-recompute": "已审查计划重放" } as const;
const cleanOperationLabels = { select: "选择并重排列", rename: "重命名列", cast: "转换类型", replace: "替换值", derive: "生成派生列", filter: "筛选行", deduplicate: "去除重复行", "fill-missing": "填补缺失值", append: "追加兼容数据", union: "按映射合并数据" } as const;
const qualityRuleLabels = { "row-count": "结果行数", "non-null": "关键列完整度", unique: "键值唯一性", "accepted-values": "允许值范围", "accepted-type": "接受数据类型", "relationship-coverage": "关联覆盖率", "aggregate-variance": "汇总偏差" } as const;
const recomputeStatusLabels = { pending: "等待执行", running: "正在执行", succeeded: "已完成", paused: "需要处理", failed: "执行失败", cancelled: "已取消" } as const;
const recomputeReasonLabels = { "schema-drift": "列结构发生变化", "quality-block": "质量门禁阻断", "stale-source": "上游版本已变化", "execution-error": "确定性执行失败", cancelled: "用户取消" } as const;

export function DatasetLineagePanel({
  dataset,
  onRecomputed,
}: {
  readonly dataset: DatasetSummary;
  readonly onRecomputed: (dataset: DatasetSummary) => void;
}) {
  const [lineage, setLineage] = useState<DerivedDatasetLineage | null>();
  const [dependencies, setDependencies] = useState<DerivedDependencyPlan>();
  const [events, setEvents] = useState<readonly DerivedRecomputeEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    let active = true;
    setLineage(undefined);
    void window.bubu.datasets.lineage(dataset.id)
      .then((value) => { if (active) setLineage(value); })
      .catch((error: unknown) => {
        if (active) setNotice(operationErrorMessage(error, "无法读取派生关系"));
      });
    return () => { active = false; };
  }, [dataset.id, dataset.versionId]);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const [nextEvents, nextDependencies] = await Promise.all([
          window.bubu.datasets.recomputeEvents(dataset.id),
          window.bubu.datasets.dependencies(dataset.id),
        ]);
        if (active) {
          setEvents(nextEvents);
          setDependencies(nextDependencies);
        }
      } catch (error) {
        if (active) setNotice(operationErrorMessage(error, "无法读取自动重算任务"));
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 4_000);
    return () => { active = false; clearInterval(timer); };
  }, [dataset.id, dataset.versionId]);

  async function updateEvent(event: DerivedRecomputeEvent, action: "retry" | "cancel"): Promise<void> {
    setBusy(true);
    setNotice(undefined);
    try {
      const updated = action === "retry"
        ? await window.bubu.datasets.retryRecompute(event.id)
        : await window.bubu.datasets.cancelRecompute(event.id);
      setEvents((current) => current.map((item) => item.id === updated.id ? updated : item));
      if (action === "retry") recordProductMetric({ name: "task_recovery_selected", targetKind: "dataset", outcome: "started" });
      setNotice(action === "retry" ? "已重新加入本地自动重算队列" : "已取消待执行的自动重算");
    } catch (error) {
      setNotice(operationErrorMessage(error, action === "retry" ? "无法重试自动重算" : "无法取消自动重算"));
    } finally {
      setBusy(false);
    }
  }

  async function recompute(): Promise<void> {
    const operationId = createOperationId();
    setBusy(true);
    setNotice(undefined);
    try {
      const result = await window.bubu.datasets.recomputeDerived(dataset.id, operationId);
      setLineage(result.lineage);
      recordProductMetric({ name: "reviewed_rule_replayed", targetKind: "dataset", outcome: "succeeded", rowCount: result.dataset.rowCount, columnCount: result.dataset.columnCount });
      setNotice(`已基于当前上游版本创建版本 ${result.dataset.version}`);
      onRecomputed(result.dataset);
    } catch (error) {
      setNotice(operationErrorMessage(error, "重新计算失败"));
      recordProductMetric({ name: "reviewed_rule_replayed", targetKind: "dataset", outcome: "failed" });
    } finally {
      setBusy(false);
    }
  }

  async function exportCleanReport(): Promise<void> {
    const evidence = lineage?.executionEvidence;
    const impact = evidence?.cleanImpact;
    if (!lineage || lineage.transformationKind !== "data-clean" || !impact) return;
    setBusy(true); setNotice(undefined);
    try {
      const quality = evidence.quality;
      const outcome = await window.bubu.artifacts.exportReport({
        schemaVersion: 1, kind: "clean", title: `${dataset.displayName} Clean 证据`, summary: lineage.purpose,
        deterministicFacts: [{ label: "输入行数", value: impact.sources[0]?.rowCount ?? 0 }, { label: "输出行数", value: impact.resultRowCount }, { label: "输出列数", value: impact.resultColumns.length }, { label: "操作数", value: impact.operations.length }],
        tables: [{ name: "Clean 操作", columns: ["序号", "操作", "处理前行数", "处理后行数", "影响行数"], rows: impact.operations.map((operation) => [operation.ordinal, cleanOperationLabels[operation.kind], operation.beforeRowCount, operation.afterRowCount, operation.affectedRowCount]) }],
        quality: quality ? [{ label: "门禁状态", value: quality.status }, ...quality.results.map((result) => ({ label: qualityRuleLabels[result.kind], value: `${result.passed ? "通过" : "警告"} · ${result.observed}` }))] : [{ label: "门禁状态", value: evidence.qualityGateStatus }],
        exceptions: quality?.results.filter(({ passed }) => !passed).map((result) => `${qualityRuleLabels[result.kind]}：${result.observed}；要求 ${result.expected}`) ?? [],
        limitations: ["报告证明受审 Clean 计划的确定性影响，不包含未显示的原始行值。"],
        lineage: [...lineage.parents.flatMap((parent) => [{ label: `上游对象 · ${parent.displayName}`, value: parent.datasetId }, { label: `上游版本 · ${parent.displayName}`, value: parent.versionId }]), { label: "结果对象", value: dataset.id }, { label: "结果版本", value: dataset.versionId }],
        runMetadata: [{ label: "执行标识", value: evidence.executionId }, { label: "计划指纹", value: lineage.planFingerprint }, { label: "审查方式", value: evidence.reviewKind }, ...(quality ? [{ label: "质量策略指纹", value: quality.policyFingerprint }] : [])],
      });
      setNotice(outcome.status === "exported" ? `已生成专业报告包“${outcome.bundleName}” · ${outcome.fileCount} 个文件` : "已取消报告导出");
      recordProductMetric({ name: "artifact_exported", targetKind: "dataset", outcome: outcome.status === "exported" ? "succeeded" : "cancelled", ...(outcome.status === "exported" ? { rowCount: impact.operations.length, columnCount: 5 } : {}) });
      recordProductMetric({ name: "report_bundle_exported", targetKind: "dataset", outcome: outcome.status === "exported" ? "succeeded" : "cancelled", ...(outcome.status === "exported" ? { rowCount: impact.operations.length, columnCount: 5 } : {}) });
    } catch (error) { setNotice(operationErrorMessage(error, "无法生成 Clean 专业报告包")); }
    finally { setBusy(false); }
  }

  if (lineage === undefined) return <section className="lineage-panel"><p className="empty-copy">正在读取派生关系…</p></section>;
  if (lineage === null) return null;
  return <section className="lineage-panel" aria-label="数据对象派生关系">
    <header>
      <div><p className="hero-kicker">派生关系</p><h4>从上游版本生成</h4></div>
      <div className="lineage-header-actions">{lineage.transformationKind === "data-clean" && lineage.executionEvidence.cleanImpact && <button type="button" className="secondary-action" disabled={busy} onClick={() => void exportCleanReport()}><Download size={14} />导出专业报告包</button>}<button type="button" className="secondary-action" disabled={busy} onClick={() => void recompute()}><RefreshCw size={14} />{busy ? "正在处理…" : "用当前上游版本重算"}</button></div>
    </header>
    <ol>
      {lineage.parents.map((parent) => <li key={`${parent.datasetId}:${parent.versionId}`}><Database size={15} /><span><strong>{parent.displayName}</strong><small>版本标识 {parent.versionId.slice(0, 8)}</small></span></li>)}
    </ol>
    <div className="lineage-output"><Database size={16} /><span><strong>{dataset.displayName}</strong><small>版本 {dataset.version} · {lineage.transformationKind === "group-query" ? "关联计划" : lineage.transformationKind === "data-clean" ? "清理计划" : "对象计划"}</small></span></div>
    <p>{lineage.purpose}</p>
    <small>计划指纹 {lineage.planFingerprint.slice(0, 12)} · 重算只会创建不可变新版本</small>
    <section className="derived-automation" aria-label="自动重算任务">
      <header><div><p className="hero-kicker">本地自动重算</p><strong>上游版本变化后自动推进</strong></div><small>{dependencies?.orderedDatasetIds.length ?? 0} 个下游依赖 · 最多重试 3 次</small></header>
      {events.length === 0 ? <p className="empty-copy">尚无自动重算任务；上游文件替换并激活新版本后会自动建立任务。</p> : <ol>{events.map((event) => {
        const superseded = events.some((candidate) => candidate.status === "succeeded" && candidate.createdAt > event.createdAt);
        return <li className={`is-${event.status}`} key={event.id}>
        {event.status === "succeeded" ? <CheckCircle2 size={16} /> : event.status === "pending" || event.status === "running" ? <Clock3 size={16} /> : event.status === "cancelled" ? <XCircle size={16} /> : <AlertTriangle size={16} />}
        <div><strong>{recomputeStatusLabels[event.status]}</strong><small>{event.reasonKind ? recomputeReasonLabels[event.reasonKind] : `触发版本 ${event.sourceVersionId.slice(0, 8)}`} · 尝试 {event.attempt}/3</small>{superseded && <small>已由更新任务修复</small>}{event.error && <small title={event.error}>{event.error}</small>}</div>
        <div className="derived-automation-actions">{!superseded && (event.status === "paused" || event.status === "failed") && event.attempt < 3 && <button type="button" className="secondary-action" disabled={busy} onClick={() => void updateEvent(event, "retry")}><RefreshCw size={12} />重试</button>}{event.status === "pending" && <button type="button" className="secondary-action" disabled={busy} onClick={() => void updateEvent(event, "cancel")}><XCircle size={12} />取消</button>}</div>
      </li>})}</ol>}
    </section>
    {lineage.transformationKind === "data-clean" && lineage.executionEvidence.cleanImpact && <section className="lineage-execution-evidence" aria-label="Clean 版本执行证据">
      <header><div><p className="hero-kicker">版本执行证据</p><strong>{reviewLabels[lineage.executionEvidence.reviewKind]}</strong></div><span>{lineage.executionEvidence.qualityGateStatus === "not-configured" ? "历史版本未配置门禁" : lineage.executionEvidence.qualityGateStatus === "warning" ? "质量通过 · 有警告" : "质量门禁通过"}</span></header>
      <div className="lineage-evidence-metrics"><span><strong>{numberFormat.format(lineage.executionEvidence.cleanImpact.sources[0]?.rowCount ?? 0)}</strong>输入行</span><span><strong>{numberFormat.format(lineage.executionEvidence.cleanImpact.resultRowCount)}</strong>输出行</span><span><strong>{lineage.executionEvidence.cleanImpact.resultColumns.length}</strong>输出列</span><span><strong>{lineage.executionEvidence.cleanImpact.operations.length}</strong>操作</span></div>
      <ol>{lineage.executionEvidence.cleanImpact.operations.map((operation) => <li key={operation.ordinal}><span>{operation.ordinal}</span><div><strong>{cleanOperationLabels[operation.kind]}</strong><small>{numberFormat.format(operation.beforeRowCount)} → {numberFormat.format(operation.afterRowCount)} 行 · 影响 {numberFormat.format(operation.affectedRowCount)} 行</small></div></li>)}</ol>
      {lineage.executionEvidence.quality && <section className={`data-clean-quality-proof is-${lineage.executionEvidence.quality.status}`}><header><strong>完成质量证明</strong><small>策略 {lineage.executionEvidence.quality.policyFingerprint.slice(0, 12)}</small></header><ol>{lineage.executionEvidence.quality.results.map((result) => <li key={result.ruleId}><span>{result.passed ? "通过" : "警告"}</span><div><strong>{qualityRuleLabels[result.kind]}</strong><small>{result.observed} · 要求 {result.expected}</small></div></li>)}</ol></section>}
      <small>执行标识 {lineage.executionEvidence.executionId.slice(0, 12)} · 影响指纹与计划指纹一致</small>
    </section>}
    {notice && <p className="artifact-action-notice" role="status">{notice}</p>}
  </section>;
}
