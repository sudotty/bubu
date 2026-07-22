import { BellRing, Check, Clock3, DatabaseZap, MessageSquareText, RotateCcw, Waypoints } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  OperationId,
  SafeGroupQueryPlan,
  SafeQueryPlan,
  WorkflowDefinition,
  WorkflowRun,
  WorkflowTarget,
  WorkflowTrigger,
} from "../shared/product-api.js";
import { AUTOMATION_POLL_INTERVAL_MILLISECONDS } from "../shared/automation.js";
import { createOperationId, operationErrorMessage } from "./operation.js";
import { ResultVisualization } from "./ResultVisualization.js";
import { buildWorkflowGraph, workflowTriggerLabel, type WorkflowGraphNode } from "./workflow-graph.js";

type WorkflowDraft =
  | { readonly kind: "dataset-query"; readonly plan: SafeQueryPlan }
  | { readonly kind: "group-query"; readonly groupPlan: SafeGroupQueryPlan };

export type TriggerPreset = "manual" | "daily" | "weekly" | "monthly" | "dataset-version";

function triggerFromPreset(preset: TriggerPreset): WorkflowTrigger {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  if (preset === "daily") return { kind: "calendar", cadence: "daily", timeZone, hour: 9, minute: 0 };
  if (preset === "weekly") return { kind: "calendar", cadence: "weekly", timeZone, hour: 9, minute: 0, weekday: 1 };
  if (preset === "monthly") return { kind: "calendar", cadence: "monthly", timeZone, hour: 9, minute: 0, dayOfMonth: 1 };
  if (preset === "dataset-version") return { kind: "dataset-version" };
  return { kind: "manual" };
}

function runLabel(status: WorkflowRun["status"]): string {
  return {
    running: "运行中",
    succeeded: "已完成",
    failed: "失败",
    cancelled: "已取消",
  }[status];
}

export function WorkflowPanel({
  target,
  threadId,
  draft,
  defaultTriggerPreset = "manual",
}: {
  readonly target: WorkflowTarget;
  readonly threadId: string;
  readonly draft?: WorkflowDraft | undefined;
  readonly defaultTriggerPreset?: TriggerPreset | undefined;
}) {
  const [workflows, setWorkflows] = useState<readonly WorkflowDefinition[]>([]);
  const [activeOperationId, setActiveOperationId] = useState<OperationId>();
  const [activeWorkflowId, setActiveWorkflowId] = useState<string>();
  const [latestRun, setLatestRun] = useState<WorkflowRun>();
  const [notice, setNotice] = useState<string>();
  const [triggerPreset, setTriggerPreset] = useState<TriggerPreset>(defaultTriggerPreset);
  const [graphMode, setGraphMode] = useState<"static" | "dynamic">("dynamic");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>();

  async function reload(): Promise<void> {
    setWorkflows(await window.bubu.workflows.list(target));
  }

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let hasLoaded = false;
    setWorkflows([]);
    setSelectedWorkflowId(undefined);
    setLatestRun(undefined);
    async function load(): Promise<void> {
      if (inFlight) return;
      inFlight = true;
      try {
        const value = await window.bubu.workflows.list(target);
        if (active) {
          setWorkflows(value);
          hasLoaded = true;
        }
      } catch (error: unknown) {
        if (active && !hasLoaded) setNotice(operationErrorMessage(error, "读取工作流失败"));
      } finally {
        inFlight = false;
      }
    }
    void load();
    const timer = window.setInterval(() => { void load(); }, AUTOMATION_POLL_INTERVAL_MILLISECONDS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [target.id, target.kind]);

  useEffect(() => {
    setTriggerPreset(defaultTriggerPreset);
  }, [defaultTriggerPreset]);

  useEffect(() => {
    setSelectedWorkflowId((current) => workflows.some(({ id }) => id === current) ? current : workflows[0]?.id);
  }, [workflows]);

  useEffect(() => {
    if (!selectedWorkflowId) {
      setLatestRun(undefined);
      return;
    }
    let active = true;
    void window.bubu.workflows.runs(selectedWorkflowId)
      .then((runs) => { if (active) setLatestRun(runs[0]); })
      .catch((error: unknown) => { if (active) setNotice(operationErrorMessage(error, "读取工作流运行记录失败")); });
    return () => { active = false; };
  }, [selectedWorkflowId]);

  async function saveDraft(): Promise<void> {
    if (!draft) return;
    setNotice(undefined);
    try {
      const step = draft.kind === "dataset-query"
        ? { id: "approved-query", kind: draft.kind, plan: draft.plan, maxAttempts: 2 } as const
        : { id: "approved-query", kind: draft.kind, groupPlan: draft.groupPlan, maxAttempts: 2 } as const;
      const name = draft.kind === "dataset-query" ? draft.plan.purpose : draft.groupPlan.purpose;
      const saved = await window.bubu.workflows.save({
        name,
        target,
        threadId,
        trigger: triggerFromPreset(triggerPreset),
        timeoutMs: 60_000,
        steps: [step],
      });
      await reload();
      setSelectedWorkflowId(saved.id);
      setNotice(`已保存“${saved.name}”v${saved.version}，后续会自动绑定当前数据版本。`);
    } catch (error) {
      setNotice(operationErrorMessage(error, "保存工作流失败"));
    }
  }

  async function runWorkflow(workflowId: string): Promise<void> {
    const operationId = createOperationId();
    setActiveOperationId(operationId);
    setActiveWorkflowId(workflowId);
    setLatestRun(undefined);
    setNotice(undefined);
    try {
      const run = await window.bubu.workflows.run(workflowId, operationId);
      setLatestRun(run);
      setNotice(run.status === "succeeded" ? "工作流已在本地完成。" : `工作流${runLabel(run.status)}：${run.error ?? "请检查步骤记录"}`);
    } catch (error) {
      setNotice(operationErrorMessage(error, "运行工作流失败"));
    } finally {
      setActiveOperationId((current) => current === operationId ? undefined : current);
      setActiveWorkflowId((current) => current === workflowId ? undefined : current);
    }
  }

  async function deleteWorkflow(workflowId: string): Promise<void> {
    setNotice(undefined);
    try {
      await window.bubu.workflows.delete(workflowId);
      await reload();
      if (latestRun?.workflowId === workflowId) setLatestRun(undefined);
      setNotice("工作流已从活动列表移除，历史运行审计仍保留在本地。");
    } catch (error) {
      setNotice(operationErrorMessage(error, "删除工作流失败"));
    }
  }

  async function cancelRun(): Promise<void> {
    if (!activeOperationId) return;
    await window.bubu.operations.cancel(activeOperationId);
    setNotice("正在取消工作流…");
  }

  const artifact = latestRun?.steps.findLast(({ result }) => result !== null)?.result;
  const selectedWorkflow = workflows.find(({ id }) => id === selectedWorkflowId) ?? workflows[0];
  const graphNodes = useMemo(() => buildWorkflowGraph(selectedWorkflow, latestRun, graphMode), [graphMode, latestRun, selectedWorkflow]);

  return (
    <section className="workflow-panel" aria-label="可重复工作流">
      <header className="workflow-header">
        <div><p className="hero-kicker">业务流程</p><h3>工作流与更新</h3></div>
        {draft && <div className="workflow-save-controls">
          <label><span>新工作流节奏</span><select value={triggerPreset} onChange={(event) => setTriggerPreset(event.target.value as TriggerPreset)} aria-label="工作流触发方式">
              <option value="manual">仅手动运行</option>
              <option value="daily">每天</option>
              <option value="weekly">每周</option>
              <option value="monthly">每月（1 日）</option>
              <option value="dataset-version">数据版本更新后</option>
            </select></label>
          <button type="button" className="primary-action" onClick={() => void saveDraft()}><Waypoints size={14} />收尾为工作流</button>
        </div>}
      </header>
      <p className="settings-copy">把已审查计划收尾为本地工作流。周期按此设备时区的 09:00 触发，并把结果送回当前对话。</p>
      {notice && <div className="notice" role="status">{notice}</div>}
      {workflows.length === 0 && <p className="empty-copy">审查一个查询计划后，可以把它保存为可重复工作流。</p>}
      {selectedWorkflow && <section className="workflow-graph" aria-label="工作流节点图">
        <header><div><strong>{selectedWorkflow.name}</strong><small>{graphMode === "dynamic" ? "实时状态" : "流程定义"}</small></div><div className="seg-toggle"><button type="button" aria-pressed={graphMode === "static"} onClick={() => setGraphMode("static")}>静态</button><button type="button" aria-pressed={graphMode === "dynamic"} onClick={() => setGraphMode("dynamic")}>动态</button></div></header>
        <ol>{graphNodes.map((node, index) => <li className={`workflow-node workflow-node-${node.status}`} key={node.id}><span className="workflow-node-icon">{workflowNodeIcon(node)}</span><div><strong>{node.label}</strong><small>{node.detail}</small></div>{index < graphNodes.length - 1 && <span className="workflow-node-line" />}</li>)}</ol>
      </section>}
      <div className="workflow-list">
        {workflows.map((workflow) => (
          <article className={`workflow-row ${selectedWorkflow?.id === workflow.id ? "workflow-row-selected" : ""}`} key={workflow.id} onClick={() => setSelectedWorkflowId(workflow.id)}>
            <div>
              <strong>{workflow.name}</strong>
              <small>v{workflow.version} · {workflow.steps.length} 步 · {workflow.timeoutMs / 1_000} 秒预算 · {workflowTriggerLabel(workflow)}{workflow.nextDueAt ? ` · 下次 ${new Date(workflow.nextDueAt).toLocaleString("zh-CN")}` : ""}</small>
            </div>
            <div>
              <button type="button" className="primary-action" disabled={activeOperationId !== undefined} onClick={() => void runWorkflow(workflow.id)}>
                {activeWorkflowId === workflow.id ? "运行中…" : "运行"}
              </button>
              <button type="button" className="secondary-action" disabled={activeOperationId !== undefined} onClick={() => void deleteWorkflow(workflow.id)}>移除</button>
            </div>
          </article>
        ))}
      </div>
      {activeOperationId && <button type="button" className="danger-action" onClick={() => void cancelRun()}>取消当前运行</button>}
      {latestRun && (
        <article className="workflow-run">
          <header><strong>最近运行 · {runLabel(latestRun.status)}</strong><small>{latestRun.steps.length} 个步骤尝试</small></header>
          {latestRun.steps.map((step) => <p key={step.id}>{step.stepId} · 第 {step.attempt} 次 · {runLabel(step.status)}{step.error ? ` · ${step.error}` : ""}</p>)}
        </article>
      )}
      {artifact && <>
        <div className="table-scroll workflow-result-table"><table>
          <thead><tr>{artifact.value.columns.map((column) => <th key={column.label}>{column.label}<small>{column.type}</small></th>)}</tr></thead>
          <tbody>{artifact.value.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, index) => <td key={artifact.value.columns[index]?.label ?? index}>{cell === null ? "—" : String(cell)}</td>)}</tr>)}</tbody>
        </table></div>
        <ResultVisualization result={artifact.value} title="工作流结果" />
      </>}
    </section>
  );
}

function workflowNodeIcon(node: WorkflowGraphNode) {
  if (node.kind === "trigger") return <Clock3 size={16} />;
  if (node.kind === "data") return <DatabaseZap size={16} />;
  if (node.kind === "delivery") return node.status === "succeeded" ? <Check size={16} /> : <MessageSquareText size={16} />;
  return node.status === "failed" ? <RotateCcw size={16} /> : <BellRing size={16} />;
}
