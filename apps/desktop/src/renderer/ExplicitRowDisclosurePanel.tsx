import { useEffect, useMemo, useState } from "react";
import { Eye, ShieldAlert } from "lucide-react";
import type {
  DatasetPreview,
  DatasetSummary,
  ExplicitRowDisclosureProposal,
  ExplicitRowExplanation,
  OperationId,
} from "../shared/product-api.js";
import { createOperationId, operationErrorMessage } from "./operation.js";
import { explicitRowDisclosureFacts } from "@bubu/product-core";

export function ExplicitRowDisclosurePanel({ dataset, preview }: { readonly dataset: DatasetSummary; readonly preview: DatasetPreview }) {
  const [rowNumbers, setRowNumbers] = useState<readonly number[]>([]);
  const [columns, setColumns] = useState<readonly string[]>([]);
  const [purpose, setPurpose] = useState("");
  const [proposal, setProposal] = useState<ExplicitRowDisclosureProposal>();
  const [explanation, setExplanation] = useState<ExplicitRowExplanation>();
  const [operationId, setOperationId] = useState<OperationId>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    setRowNumbers([]); setColumns([]); setPurpose(""); setProposal(undefined); setExplanation(undefined); setError(undefined);
  }, [dataset.id, dataset.versionId]);

  const selectedCells = rowNumbers.length * columns.length;
  const ready = rowNumbers.length > 0 && columns.length > 0 && purpose.trim().length > 0;
  const rowByNumber = useMemo(() => new Map(preview.rows.map((row, index) => [preview.offset + index + 1, row])), [preview]);

  const toggleRow = (rowNumber: number) => setRowNumbers((current) => current.includes(rowNumber)
    ? current.filter((value) => value !== rowNumber)
    : current.length >= 20 ? current : [...current, rowNumber].toSorted((left, right) => left - right));
  const toggleColumn = (column: string) => setColumns((current) => current.includes(column)
    ? current.filter((value) => value !== column)
    : current.length >= 16 ? current : [...current, column]);

  async function prepare(): Promise<void> {
    if (!ready) return;
    setError(undefined); setExplanation(undefined);
    try {
      setProposal(await window.bubu.analysis.prepareExplicitRowDisclosure({
        schemaVersion: 1, datasetId: dataset.id, versionId: dataset.versionId,
        purpose: purpose.trim(), rowNumbers: [...rowNumbers], columns: [...columns],
      }));
    } catch (reason) {
      setError(operationErrorMessage(reason, "无法准备原始行披露"));
    }
  }

  async function approve(): Promise<void> {
    if (!proposal) return;
    const nextOperationId = createOperationId();
    setOperationId(nextOperationId); setError(undefined);
    try {
      setExplanation(await window.bubu.analysis.approveExplicitRowDisclosure({ approvalToken: proposal.approvalToken }, nextOperationId));
      setProposal(undefined);
    } catch (reason) {
      setError(operationErrorMessage(reason, "原始行解释失败"));
      setProposal(undefined);
    } finally {
      setOperationId(undefined);
    }
  }

  async function dismiss(): Promise<void> {
    if (proposal) await window.bubu.analysis.dismissExplicitRowDisclosure({ approvalToken: proposal.approvalToken });
    setProposal(undefined);
  }

  return <section className="explicit-row-panel">
    <header className="preview-header"><div><p className="hero-kicker">Disclosure Lens</p><h3><Eye size={17} />显式原始行解释</h3></div><span>默认 0 行</span></header>
    <p className="settings-copy">只在确有必要时逐行、逐列选择。严格隐私模式永远拒绝；本地 DLP、当前版本和一次性批准仍会在发送前再次检查。</p>
    <div className="explicit-row-column-picker" aria-label="选择披露列">
      {preview.columns.map((column) => <label key={column.ordinal}><input type="checkbox" checked={columns.includes(column.name)} onChange={() => toggleColumn(column.name)} disabled={!columns.includes(column.name) && columns.length >= 16} />{column.name}<small>{column.inferredType}</small></label>)}
    </div>
    <div className="table-scroll explicit-row-source-table"><table><thead><tr><th scope="col">披露</th><th scope="col">行号</th>{preview.columns.map((column) => <th key={column.ordinal}>{column.name}</th>)}</tr></thead><tbody>{preview.rows.map((row, index) => { const rowNumber = preview.offset + index + 1; return <tr key={rowNumber} className={rowNumbers.includes(rowNumber) ? "is-selected" : ""}><td><input type="checkbox" aria-label={`选择第 ${rowNumber} 行`} checked={rowNumbers.includes(rowNumber)} onChange={() => toggleRow(rowNumber)} disabled={!rowNumbers.includes(rowNumber) && rowNumbers.length >= 20} /></td><th scope="row">{rowNumber}</th>{row.map((cell, columnIndex) => <td key={preview.columns[columnIndex]?.ordinal ?? columnIndex}>{cell == null ? "—" : String(cell)}</td>)}</tr>; })}</tbody></table></div>
    <label className="field"><span>为什么必须披露这些单元格</span><textarea value={purpose} onChange={(event) => setPurpose(event.target.value)} maxLength={500} rows={2} placeholder="例如：解释第 2 和第 7 行退款金额为何异常" /></label>
    <div className="explicit-row-summary"><strong>{rowNumbers.length} 行 × {columns.length} 列 = {selectedCells} 个真实单元格</strong><small>最多 20 行、16 列；没有通配符或自动扩展。</small></div>
    {error && <div className="notice notice-danger" role="alert">{error}</div>}
    {!proposal && !explanation && <button type="button" className="secondary-action" onClick={() => void prepare()} disabled={!ready}>生成精确披露预览</button>}
    {proposal && (() => { const facts = explicitRowDisclosureFacts(proposal.preview); return <article className="explicit-row-approval-card">
      <header><div><p className="chat-context-label">需要一次性批准</p><h4>{proposal.preview.selection.purpose}</h4></div><ShieldAlert size={18} /></header>
      <dl><div><dt>目的地</dt><dd>{proposal.destination.providerName} / {proposal.destination.model}<small>{proposal.destination.endpointOrigin}</small></dd></div><div><dt>精确范围</dt><dd>{facts.rowCount} 行 · {facts.columnCount} 列 · {facts.cellCount} 单元格</dd></div><div><dt>Payload</dt><dd>{facts.payloadBytes} bytes<small>SHA-256 {facts.fingerprintPrefix}…</small></dd></div><div><dt>有效期</dt><dd>{new Date(proposal.expiresAt).toLocaleTimeString("zh-CN")}</dd></div></dl>
      <div className="table-scroll"><table><thead><tr><th>行号</th>{proposal.preview.selection.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{proposal.preview.rows.map((row) => <tr key={row.rowNumber}><th>{row.rowNumber}</th>{row.cells.map((cell, index) => <td key={proposal.preview.selection.columns[index]}>{cell == null ? "—" : String(cell)}</td>)}</tr>)}</tbody></table></div>
      <p className="danger-copy">批准后这些精确单元格会发送到上述模型目标。批准只使用一次，不能被其他查询、Agent 或工作流复用。</p>
      <div className="plan-actions"><button type="button" className="primary-action" onClick={() => void approve()} disabled={operationId !== undefined}>{operationId ? "正在发送…" : "批准这一次精确披露"}</button><button type="button" className="secondary-action" onClick={() => void dismiss()} disabled={operationId !== undefined}>取消</button></div>
    </article>; })()}
    {explanation && <article className="explicit-row-result"><header><p className="chat-context-label">仅基于已披露单元格</p><h4>{explanation.summary}</h4></header>{explanation.findings.map((finding) => <section key={finding.title}><strong>{finding.title}</strong><p>{finding.detail}</p><small>{finding.evidence.map(({ rowNumber, column }) => `第 ${rowNumber} 行 · ${column}`).join("；")}</small></section>)}{explanation.caveats.length > 0 && <p className="muted-copy">限制：{explanation.caveats.join("；")}</p>}<button type="button" className="secondary-action" onClick={() => { setExplanation(undefined); setRowNumbers([]); }}>完成</button></article>}
    {rowNumbers.some((rowNumber) => !rowByNumber.has(rowNumber)) && <p className="error-text">所选行已不在当前预览中，请刷新后重新选择。</p>}
  </section>;
}
