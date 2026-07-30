import { useEffect, useMemo, useState } from "react";
import { Check, ShieldCheck, Sparkles, X } from "lucide-react";
import { dataCleanTemplateById, dataCleanTemplates, type DataCleanTemplateId } from "@bubu/product-core";
import type { DataCleanOperation, DataCleanProposal, DataCleanQualityRule, DatasetPreview, DatasetSummary } from "../shared/product-api.js";
import { createOperationId, operationErrorMessage } from "./operation.js";
import { recordProductMetric } from "./product-metrics.js";

const numberFormat = new Intl.NumberFormat("zh-CN");
const operationLabels = {
  select: "选择并重排列",
  rename: "重命名列",
  cast: "转换类型",
  replace: "替换值",
  derive: "生成派生列",
  filter: "筛选行",
  deduplicate: "去除重复行",
  "fill-missing": "填补缺失值",
  append: "追加兼容数据",
  union: "按映射合并数据",
} as const;
const qualityRuleLabels = { "row-count": "结果行数", "non-null": "关键列完整度", unique: "键值唯一性", "accepted-values": "允许值范围", "accepted-type": "接受数据类型", "relationship-coverage": "关联覆盖率", "aggregate-variance": "汇总偏差" } as const;

export function DataCleanDialog({
  dataset,
  preview,
  initialTemplateId = "monthly-prep",
  onClose,
  onMaterialized,
}: {
  readonly dataset: DatasetSummary;
  readonly preview: DatasetPreview;
  readonly initialTemplateId?: DataCleanTemplateId;
  readonly onClose: () => void;
  readonly onMaterialized: (dataset: DatasetSummary) => void;
}) {
  const columns = useMemo(() => preview.columns.map(({ name }) => name), [preview.columns]);
  const [displayName, setDisplayName] = useState(`${dataset.displayName} · 已清理`);
  const [templateId, setTemplateId] = useState<DataCleanTemplateId>(initialTemplateId);
  const [selectedColumns, setSelectedColumns] = useState<readonly string[]>(columns);
  const [deduplicateKey, setDeduplicateKey] = useState("");
  const [qualityColumn, setQualityColumn] = useState("");
  const [minimumNonNull, setMinimumNonNull] = useState(100);
  const [acceptedValues, setAcceptedValues] = useState("");
  const [qualitySeverity, setQualitySeverity] = useState<"blocking" | "warning">("blocking");
  const [availableDatasets, setAvailableDatasets] = useState<readonly DatasetSummary[]>([]);
  const [secondSource, setSecondSource] = useState<DatasetSummary>();
  const [secondColumns, setSecondColumns] = useState<readonly string[]>([]);
  const [referenceColumn, setReferenceColumn] = useState(columns[0] ?? "");
  const [secondReferenceColumn, setSecondReferenceColumn] = useState("");
  const [proposal, setProposal] = useState<DataCleanProposal>();
  const [busy, setBusy] = useState<"preview" | "execute">();
  const [notice, setNotice] = useState<string>();

  useEffect(() => () => {
    if (proposal) void window.bubu.datasets.dismissDataClean(proposal.approvalToken);
  }, [proposal]);

  useEffect(() => {
    let active = true;
    void window.bubu.datasets.list().then((items) => {
      if (active) setAvailableDatasets(items.filter((item) => item.id !== dataset.id));
    });
    return () => { active = false; };
  }, [dataset.id]);

  async function selectSecondSource(datasetId: string): Promise<void> {
    invalidateProposal();
    const selected = availableDatasets.find(({ id }) => id === datasetId);
    setSecondSource(selected);
    setSecondColumns([]);
    setSecondReferenceColumn("");
    if (!selected) return;
    try {
      const nextPreview = await window.bubu.datasets.preview({ datasetId: selected.id, limit: 1, offset: 0 });
      const nextColumns = nextPreview.columns.map(({ name }) => name);
      setSecondColumns(nextColumns);
      setSecondReferenceColumn(nextColumns[0] ?? "");
    } catch (error) {
      setNotice(operationErrorMessage(error, "无法读取第二来源的列结构"));
    }
  }

  function selectTemplate(id: DataCleanTemplateId): void {
    invalidateProposal();
    setTemplateId(id);
    const template = dataCleanTemplateById(id);
    if (template.mode === "deduplicate") setDeduplicateKey(columns[0] ?? "");
    else setDeduplicateKey("");
    if (id === "monthly-prep" || id === "order-normalization") setQualityColumn(columns[0] ?? "");
    else setQualityColumn("");
    if (!template.needsSecondSource) {
      setSecondSource(undefined);
      setSecondColumns([]);
    }
  }

  function invalidateProposal(): void {
    if (proposal) void window.bubu.datasets.dismissDataClean(proposal.approvalToken);
    setProposal(undefined);
    setNotice(undefined);
  }

  function toggleColumn(column: string): void {
    invalidateProposal();
    setSelectedColumns((current) => current.includes(column) ? current.filter((value) => value !== column) : columns.filter((value) => value === column || current.includes(value)));
    if (deduplicateKey === column) setDeduplicateKey("");
    if (qualityColumn === column) setQualityColumn("");
  }

  async function prepare(): Promise<void> {
    if (!displayName.trim() || selectedColumns.length === 0) return;
    setBusy("preview");
    setNotice(undefined);
    try {
      const template = dataCleanTemplateById(templateId);
      if (template.needsSecondSource && !secondSource) throw new Error("请选择第二个数据来源");
      if (template.mode === "append" && secondColumns.join("\u0000") !== columns.join("\u0000")) throw new Error("追加模板要求两个来源具有完全相同的列顺序");
      if (template.mode === "reference-check" && (!referenceColumn || !secondReferenceColumn)) throw new Error("请选择业务键和参考键");
      const operations: DataCleanOperation[] = [
        ...(template.mode === "append" ? [{ kind: "append" as const, sourceIndex: 1 }] : []),
        { kind: "select" as const, columns: [...selectedColumns] },
        ...(deduplicateKey ? [{ kind: "deduplicate" as const, keys: [deduplicateKey], keep: "first" as const }] : []),
      ];
      const rules: DataCleanQualityRule[] = [{ id: "output-has-rows", severity: "blocking", kind: "row-count", minimum: 1 }];
      if (qualityColumn) {
        rules.push({ id: "critical-column-complete", severity: qualitySeverity, kind: "non-null", column: qualityColumn, minimumRatio: minimumNonNull / 100 });
        const values = acceptedValues.split(",").map((value) => value.trim()).filter(Boolean);
        if (values.length > 0) rules.push({ id: "critical-column-values", severity: qualitySeverity, kind: "accepted-values", column: qualityColumn, values: [...new Set(values)] });
      }
      if (deduplicateKey) rules.push({ id: "deduplicate-key-unique", severity: "blocking", kind: "unique", columns: [deduplicateKey] });
      if (template.mode === "reference-check") rules.push({ id: "reference-coverage", severity: qualitySeverity, kind: "relationship-coverage", column: referenceColumn, sourceIndex: 1, sourceColumn: secondReferenceColumn, minimumRatio: 1 });
      const purpose = template.mode === "append" && secondSource
        ? `按完全相同的列顺序把“${secondSource.displayName}”追加到“${dataset.displayName}”`
        : template.mode === "reference-check" && secondSource
          ? `检查“${dataset.displayName}”对“${secondSource.displayName}”的参考覆盖率`
          : deduplicateKey
            ? `选择所需列，并按“${deduplicateKey}”保留首条记录`
            : "选择并重排需要保留的列";
      const next = await window.bubu.datasets.prepareDataClean({
        displayName,
        cleanPlan: {
          schemaVersion: 1,
          purpose,
          sources: [{ datasetId: dataset.id, versionId: dataset.versionId }, ...(secondSource ? [{ datasetId: secondSource.id, versionId: secondSource.versionId }] : [])],
          operations,
        },
		qualityPolicy: { schemaVersion: 1, rules },
      }, createOperationId());
      setProposal(next);
      recordProductMetric({ name: "data_clean_previewed", targetKind: "dataset", outcome: "succeeded", rowCount: next.impact.resultRowCount, columnCount: next.impact.resultColumns.length });
    } catch (error) {
      setNotice(operationErrorMessage(error, "无法生成清理影响预览"));
      recordProductMetric({ name: "data_clean_previewed", targetKind: "dataset", outcome: "failed" });
    } finally {
      setBusy(undefined);
    }
  }

  async function execute(): Promise<void> {
    if (!proposal) return;
    setBusy("execute");
    setNotice(undefined);
    try {
      const result = await window.bubu.datasets.approveDataClean(proposal.approvalToken, createOperationId());
      setProposal(undefined);
      recordProductMetric({ name: "data_clean_result_ready", targetKind: "dataset", outcome: "succeeded", rowCount: result.dataset.rowCount, columnCount: result.dataset.columnCount });
      onMaterialized(result.dataset);
      onClose();
    } catch (error) {
	  setNotice(operationErrorMessage(error, "清理执行失败；当前审查证据仍保留，可返回修改后重试"));
      recordProductMetric({ name: "data_clean_result_ready", targetKind: "dataset", outcome: "failed" });
    } finally {
      setBusy(undefined);
    }
  }

  const fixedSources = proposal?.impact.sources ?? [];
  const source = fixedSources[0];
  const rowDelta = source && proposal ? proposal.impact.resultRowCount - source.rowCount : 0;
  const rowDeltaLabel = rowDelta > 0 ? "将新增行" : rowDelta < 0 ? "将移除行" : "行数变化";
  const removedColumns = source && proposal ? Math.max(0, source.columns.length - proposal.impact.resultColumns.length) : 0;

  return <div className="modal-backdrop" role="presentation">
    <section className="data-clean-dialog" role="dialog" aria-modal="true" aria-labelledby="data-clean-title">
      <header>
        <div><p className="eyebrow">本地确定性转换</p><h3 id="data-clean-title"><Sparkles size={18} />Data Clean</h3><small>原对象保持不变；执行后创建带完整血缘的新数据对象。</small></div>
        <button type="button" className="icon-button" aria-label="关闭 Data Clean" onClick={onClose}><X size={18} /></button>
      </header>

      {!proposal ? <div className="data-clean-builder">
        <fieldset className="data-clean-templates"><legend>选择可复用模板</legend><div>{dataCleanTemplates.map((template) => <button type="button" className={template.id === templateId ? "is-selected" : ""} key={template.id} onClick={() => selectTemplate(template.id)}><strong>{template.name}</strong><small>{template.description}</small></button>)}</div></fieldset>
        <label><span>新数据对象名称</span><input value={displayName} maxLength={100} onChange={(event) => { invalidateProposal(); setDisplayName(event.target.value); }} /></label>
        <fieldset><legend>保留列 <small>{selectedColumns.length}/{columns.length}</small></legend><div className="data-clean-columns">{columns.map((column) => <label key={column}><input type="checkbox" checked={selectedColumns.includes(column)} onChange={() => toggleColumn(column)} /><span><Check size={13} />{column}</span></label>)}</div></fieldset>
        <label><span>可选去重键</span><select value={deduplicateKey} onChange={(event) => { invalidateProposal(); setDeduplicateKey(event.target.value); }}><option value="">不去重</option>{selectedColumns.map((column) => <option key={column} value={column}>{column}</option>)}</select><small>相同键值保留最早一条；实际删除行数会在下一步显示。</small></label>
        {dataCleanTemplateById(templateId).needsSecondSource && <><label><span>第二数据来源</span><select value={secondSource?.id ?? ""} onChange={(event) => void selectSecondSource(event.target.value)}><option value="">请选择本地数据对象</option>{availableDatasets.map((item) => <option key={item.id} value={item.id}>{item.displayName} · 版本 {item.version}</option>)}</select><small>{templateId === "append-exports" ? "仅接受列名和顺序完全一致的对象。" : "参考对象只在本地用于覆盖率检查，不会被追加到输出。"}</small></label>{templateId === "reference-mapping" && secondSource && <div className="data-clean-quality-controls"><label><span>当前对象业务键</span><select value={referenceColumn} onChange={(event) => { invalidateProposal(); setReferenceColumn(event.target.value); }}>{selectedColumns.map((column) => <option key={column} value={column}>{column}</option>)}</select></label><label><span>参考对象匹配键</span><select value={secondReferenceColumn} onChange={(event) => { invalidateProposal(); setSecondReferenceColumn(event.target.value); }}>{secondColumns.map((column) => <option key={column} value={column}>{column}</option>)}</select></label></div>}</>}
        <fieldset><legend>完成质量门禁</legend><div className="data-clean-quality-controls"><label><span>关键列</span><select value={qualityColumn} onChange={(event) => { invalidateProposal(); setQualityColumn(event.target.value); }}><option value="">仅要求结果非空</option>{selectedColumns.map((column) => <option key={column} value={column}>{column}</option>)}</select></label>{qualityColumn && <><label><span>最低非空率</span><input type="number" min={0} max={100} value={minimumNonNull} onChange={(event) => { invalidateProposal(); setMinimumNonNull(Math.max(0, Math.min(100, Number(event.target.value)))); }} /></label><label><span>允许值（可选，逗号分隔）</span><input value={acceptedValues} maxLength={2000} onChange={(event) => { invalidateProposal(); setAcceptedValues(event.target.value); }} /></label><label><span>失败策略</span><select value={qualitySeverity} onChange={(event) => { invalidateProposal(); setQualitySeverity(event.target.value as "blocking" | "warning"); }}><option value="blocking">阻断创建</option><option value="warning">允许创建并保留警告</option></select></label></>}</div><small>结果非空始终阻断；去重时还会验证键值确实唯一。</small></fieldset>
        <div className="data-clean-actions"><button type="button" className="secondary-action" onClick={onClose}>取消</button><button type="button" className="primary-action" disabled={busy !== undefined || !displayName.trim() || selectedColumns.length === 0} onClick={() => void prepare()}>{busy === "preview" ? "正在本地计算…" : "预览影响"}</button></div>
      </div> : <div className="data-clean-review">
        <div className="data-clean-review-title"><ShieldCheck size={20} /><div><strong>执行前审查</strong><small>此批准仅对下列名称、来源版本、完整计划与指纹有效，且只能使用一次。</small></div></div>
        <div className="data-clean-impact-grid"><span><strong>{numberFormat.format(source?.rowCount ?? 0)}</strong>主来源行</span><span><strong>{numberFormat.format(proposal.impact.resultRowCount)}</strong>结果行</span><span><strong>{numberFormat.format(Math.abs(rowDelta))}</strong>{rowDeltaLabel}</span><span><strong>{numberFormat.format(removedColumns)}</strong>将移除列</span></div>
        <dl><div><dt>目标名称</dt><dd>{proposal.request.displayName}</dd></div><div><dt>计划目的</dt><dd>{proposal.request.cleanPlan.purpose}</dd></div><div><dt>固定来源（{fixedSources.length}）</dt><dd><ol className="data-clean-fixed-sources">{fixedSources.map((item) => <li key={`${item.datasetId}:${item.versionId}`}><strong>{item.displayName}</strong><span>版本 {item.versionId.slice(0, 8)} · {numberFormat.format(item.rowCount)} 行</span></li>)}</ol></dd></div><div><dt>结果列</dt><dd>{proposal.impact.resultColumns.join("、")}</dd></div><div><dt>计划指纹</dt><dd><code>{proposal.impact.planFingerprint.slice(0, 16)}…</code></dd></div></dl>
		<section className={`data-clean-quality-proof is-${proposal.quality.status}`} aria-label="质量门禁预览"><header><strong>{proposal.quality.status === "blocked" ? "质量门禁未通过" : proposal.quality.status === "warning" ? "质量门禁有警告" : "质量门禁通过"}</strong><small>策略指纹 {proposal.quality.policyFingerprint.slice(0, 12)}</small></header><ol>{proposal.quality.results.map((result) => <li key={result.ruleId}><span>{result.passed ? "通过" : result.severity === "blocking" ? "阻断" : "警告"}</span><div><strong>{qualityRuleLabels[result.kind]}</strong><small>{result.observed} · 要求 {result.expected}</small></div></li>)}</ol></section>
        <ol className="data-clean-operation-list">{proposal.impact.operations.map((operation) => <li key={operation.ordinal}><span>{operation.ordinal}</span><div><strong>{operationLabels[operation.kind]}</strong><small>{numberFormat.format(operation.beforeRowCount)} → {numberFormat.format(operation.afterRowCount)} 行 · {operation.beforeColumnCount} → {operation.afterColumnCount} 列 · 影响 {numberFormat.format(operation.affectedRowCount)} 行</small>{operation.beforeColumns.join("\u0000") !== operation.afterColumns.join("\u0000") && <small>{operation.beforeColumns.join("、")} → {operation.afterColumns.join("、")}</small>}</div></li>)}</ol>
        <div className="data-clean-actions"><button type="button" className="secondary-action" disabled={busy !== undefined} onClick={() => { invalidateProposal(); }}>返回修改</button><button type="button" className="primary-action" disabled={busy !== undefined || proposal.quality.status === "blocked"} onClick={() => void execute()}>{proposal.quality.status === "blocked" ? "先修复阻断项" : busy === "execute" ? "正在创建…" : "批准并创建数据对象"}</button></div>
      </div>}
      {notice && <p className="error-text" role="alert">{notice}</p>}
    </section>
  </div>;
}
