import { useEffect, useMemo, useState } from "react";
import type { DatasetQualityReport, ValidationRule } from "../shared/product-api.js";

type QualityState =
  | { readonly kind: "loading" }
  | { readonly kind: "loaded"; readonly report: DatasetQualityReport }
  | { readonly kind: "failed"; readonly message: string };

const findingLabels = {
  "empty-dataset": "数据集没有数据行",
  "all-null": "整列为空",
  "high-null-rate": "空值比例较高",
  constant: "整列只有一个非空值",
  "candidate-key": "可能是唯一标识列",
} as const;

const ruleKindLabels = {
  required: "必填",
  unique: "唯一",
  "number-range": "数值范围",
  pattern: "格式表达式",
  "allowed-values": "允许值集合",
} as const;

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : "读取本地质量报告失败";
}

function ruleLabel(rule: ValidationRule): string {
  switch (rule.kind) {
    case "number-range":
      return `${rule.column} · ${rule.minimum ?? "−∞"} 到 ${rule.maximum ?? "+∞"}`;
    case "pattern":
      return `${rule.column} · ${rule.pattern}`;
    case "allowed-values":
      return `${rule.column} · ${rule.values.join("、")}`;
    default:
      return rule.column;
  }
}

export function DatasetQualityPanel({
  datasetId,
  versionId,
}: {
  readonly datasetId: string;
  readonly versionId: string;
}) {
  const [state, setState] = useState<QualityState>({ kind: "loading" });
  const [rules, setRules] = useState<readonly ValidationRule[]>([]);
  const [kind, setKind] = useState<ValidationRule["kind"]>("required");
  const [column, setColumn] = useState("");
  const [minimum, setMinimum] = useState("");
  const [maximum, setMaximum] = useState("");
  const [pattern, setPattern] = useState("");
  const [allowedValues, setAllowedValues] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    setNotice(undefined);
    void window.bubu.datasets.quality(datasetId)
      .then((report) => {
        if (!active) return;
        setState({ kind: "loaded", report });
        setRules(report.rules);
        setColumn(report.columns[0]?.name ?? "");
      })
      .catch((error: unknown) => {
        if (active) setState({ kind: "failed", message: messageFrom(error) });
      });
    return () => { active = false; };
  }, [datasetId, versionId]);

  const availableColumns = useMemo(() => {
    if (state.kind !== "loaded") return [];
    return kind === "number-range"
      ? state.report.columns.filter(({ inferredType }) => inferredType === "integer" || inferredType === "real")
      : state.report.columns;
  }, [kind, state]);
  const selectedColumn = availableColumns.some(({ name }) => name === column)
    ? column
    : availableColumns[0]?.name ?? "";

  function addRule(): void {
    if (!selectedColumn || rules.length >= 100) return;
    let next: ValidationRule | undefined;
    switch (kind) {
      case "required":
      case "unique":
        next = { kind, column: selectedColumn };
        break;
      case "number-range": {
        const nextMinimum = minimum.trim() === "" ? null : Number(minimum);
        const nextMaximum = maximum.trim() === "" ? null : Number(maximum);
        if ((nextMinimum === null && nextMaximum === null)
          || (nextMinimum !== null && !Number.isFinite(nextMinimum))
          || (nextMaximum !== null && !Number.isFinite(nextMaximum))) {
          setNotice("数值范围至少填写一个有效边界");
          return;
        }
        next = { kind, column: selectedColumn, minimum: nextMinimum, maximum: nextMaximum };
        break;
      }
      case "pattern":
        if (!pattern.trim()) {
          setNotice("请输入格式表达式");
          return;
        }
        next = { kind, column: selectedColumn, pattern: pattern.trim() };
        break;
      case "allowed-values": {
        const values = [...new Set(allowedValues.split(",").map((value) => value.trim()).filter(Boolean))];
        if (values.length === 0) {
          setNotice("请输入至少一个允许值，并用英文逗号分隔");
          return;
        }
        next = { kind, column: selectedColumn, values };
        break;
      }
    }
    if (!next) return;
    setRules((current) => [...current, next]);
    setNotice("规则已加入草稿；保存后会在当前本地版本上运行");
  }

  async function saveRules(): Promise<void> {
    setSaving(true);
    setNotice(undefined);
    try {
      const report = await window.bubu.datasets.saveValidation({ datasetId, rules: [...rules] });
      setState({ kind: "loaded", report });
      setRules(report.rules);
      setNotice("规则已保存在数据联系人上，并完成当前版本校验");
    } catch (error) {
      setNotice(messageFrom(error));
    } finally {
      setSaving(false);
    }
  }

  if (state.kind === "loading") return <section className="quality-panel">正在生成本地质量报告…</section>;
  if (state.kind === "failed") return <section className="quality-panel error-text">{state.message}</section>;
  const { report } = state;

  return (
    <section className="quality-panel" aria-label="本地数据质量与校验">
      <header className="quality-header">
        <div><p className="hero-kicker">LOCAL DATA QUALITY</p><h3>质量与格式校验</h3></div>
        <strong className={`quality-score ${report.score < 70 ? "quality-score-low" : ""}`}>{report.score}</strong>
      </header>
      <p className="quality-copy">所有规则都由 Go 数据内核在本地执行。报告只显示统计与失败行号，不把失败值发送给模型。</p>
      {notice && <div className="notice" role="status">{notice}</div>}

      <div className="quality-findings">
        {report.findings.length === 0 && <span className="quality-chip">没有发现基础画像问题</span>}
        {report.findings.map((finding, index) => (
          <span className={`quality-chip quality-${finding.severity}`} key={`${finding.kind}-${finding.column ?? index}`}>
            {finding.column ? `${finding.column} · ` : ""}{findingLabels[finding.kind]}
          </span>
        ))}
      </div>

      <div className="table-scroll quality-table">
        <table>
          <thead><tr><th>列</th><th>类型</th><th>空值率</th><th>唯一率</th><th>最小值</th><th>最大值</th></tr></thead>
          <tbody>{report.columns.map((item) => (
            <tr key={item.name}>
              <td>{item.name}</td><td>{item.inferredType}</td>
              <td>{(item.nullRate * 100).toFixed(1)}%</td><td>{(item.distinctRate * 100).toFixed(1)}%</td>
              <td>{item.minValue ?? "—"}</td><td>{item.maxValue ?? "—"}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <div className="rule-editor">
        <h4>确定性校验规则</h4>
        <div className="rule-controls">
          <select value={kind} onChange={(event) => setKind(event.target.value as ValidationRule["kind"])}>
            {Object.entries(ruleKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={selectedColumn} onChange={(event) => setColumn(event.target.value)}>
            {availableColumns.map(({ name }) => <option key={name} value={name}>{name}</option>)}
          </select>
          {kind === "number-range" && <><input value={minimum} onChange={(event) => setMinimum(event.target.value)} placeholder="最小值（可空）" /><input value={maximum} onChange={(event) => setMaximum(event.target.value)} placeholder="最大值（可空）" /></>}
          {kind === "pattern" && <input value={pattern} onChange={(event) => setPattern(event.target.value)} maxLength={200} placeholder="例如 ^A-[0-9]+$" />}
          {kind === "allowed-values" && <input value={allowedValues} onChange={(event) => setAllowedValues(event.target.value)} placeholder="North, South" />}
          <button type="button" className="secondary-action" onClick={addRule} disabled={!selectedColumn}>加入规则</button>
        </div>
        <div className="rule-list">
          {rules.map((rule, index) => {
            const result = report.validation[index];
            return (
              <div className="rule-row" key={`${rule.kind}-${rule.column}-${index}`}>
                <span><strong>{ruleKindLabels[rule.kind]}</strong><small>{ruleLabel(rule)}</small></span>
                <span>{result ? `${result.failedRows} 行失败${result.sampleRowNumbers.length > 0 ? ` · 行号 ${result.sampleRowNumbers.join("、")}` : ""}` : "尚未运行"}</span>
                <button type="button" onClick={() => setRules((current) => current.filter((_, itemIndex) => itemIndex !== index))}>移除</button>
              </div>
            );
          })}
          {rules.length === 0 && <p className="empty-copy">尚未定义业务校验规则。</p>}
        </div>
        <button type="button" className="primary-action" onClick={() => void saveRules()} disabled={saving}>
          {saving ? "正在本地校验…" : "保存规则并运行校验"}
        </button>
      </div>
    </section>
  );
}
