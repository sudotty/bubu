import { BellRing, Check, Clock3, DatabaseZap, MessageSquareText, RotateCcw, Waypoints } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  OperationId,
  SafeGroupQueryPlan,
  SafeQueryPlan,
  WorkflowDefinition,
  WorkflowRun,
  WorkflowTarget,
  WorkflowApprovalRequest,
  WebhookRegistry,
  WorkflowDeliveryBinding,
  ExternalDeliveryJob,
  HubConnectionProfile,
} from "../shared/product-api.js";
import { AUTOMATION_POLL_INTERVAL_MILLISECONDS } from "../shared/automation.js";
import { createOperationId, operationErrorMessage } from "./operation.js";
import { ResultVisualization } from "./ResultVisualization.js";
import { buildWorkflowGraph, workflowTriggerLabel, type WorkflowGraphNode } from "./workflow-graph.js";
import { scheduleDescription, triggerFromSchedule, type TriggerPreset, type WorkflowScheduleDraft } from "./workflow-schedule.js";
import { resultTypeLabel } from "./result-type-label.js";

type WorkflowDraft =
  | { readonly kind: "dataset-query"; readonly plan: SafeQueryPlan }
  | { readonly kind: "group-query"; readonly groupPlan: SafeGroupQueryPlan };

const defaultSchedule = (preset: TriggerPreset): WorkflowScheduleDraft => ({ preset, hour: 9, minute: 0, weekday: 1, dayOfMonth: 1 });

function runLabel(status: WorkflowRun["status"]): string {
  return {
    running: "运行中",
    "awaiting-approval": "等待人工批准",
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
  onReturnToConversation,
}: {
  readonly target: WorkflowTarget;
  readonly threadId: string;
  readonly draft?: WorkflowDraft | undefined;
  readonly defaultTriggerPreset?: TriggerPreset | undefined;
  readonly onReturnToConversation?: (() => void) | undefined;
}) {
  const [workflows, setWorkflows] = useState<readonly WorkflowDefinition[]>([]);
  const [activeOperationId, setActiveOperationId] = useState<OperationId>();
  const [activeWorkflowId, setActiveWorkflowId] = useState<string>();
  const [latestRun, setLatestRun] = useState<WorkflowRun>();
  const [notice, setNotice] = useState<string>();
  const [schedule, setSchedule] = useState<WorkflowScheduleDraft>(() => defaultSchedule(defaultTriggerPreset));
  const [saveBusy, setSaveBusy] = useState(false);
  const [graphMode, setGraphMode] = useState<"static" | "dynamic">("dynamic");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>();
  const [requireApproval, setRequireApproval] = useState(false);
  const [approvals, setApprovals] = useState<readonly WorkflowApprovalRequest[]>([]);
  const [hubProfile, setHubProfile] = useState<HubConnectionProfile | null>(null);

  async function reload(): Promise<void> {
    const [definitions, pending] = await Promise.all([window.bubu.workflows.list(target), window.bubu.workflows.approvals()]);
    setWorkflows(definitions);
    setApprovals(pending.filter((approval) => approval.target.kind === target.kind && approval.target.id === target.id));
  }

  useEffect(() => {
    void window.bubu.hub.profile().then(setHubProfile).catch(() => undefined);
  }, []);

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
        const [value, pending] = await Promise.all([window.bubu.workflows.list(target), window.bubu.workflows.approvals()]);
        if (active) {
          setWorkflows(value);
          setApprovals(pending.filter((approval) => approval.target.kind === target.kind && approval.target.id === target.id));
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
    setSchedule((current) => ({ ...current, preset: defaultTriggerPreset }));
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
    setSaveBusy(true);
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
        trigger: triggerFromSchedule(schedule, timeZone),
        timeoutMs: 60_000,
        steps: requireApproval ? [step, { id: "human-checkpoint", kind: "human-approval", title: "人工确认本次结果", action: "继续把本次受审结果交付到所属任务", risk: "medium", expiresAfterMinutes: 60, maxAttempts: 1 }] : [step],
      });
      await reload();
      setSelectedWorkflowId(saved.id);
      setNotice(`已保存“${saved.name}”v${saved.version}，后续会自动绑定当前数据版本。`);
    } catch (error) {
      setNotice(operationErrorMessage(error, "保存工作流失败"));
    } finally {
      setSaveBusy(false);
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
      if (run.status === "awaiting-approval") await reload();
      setNotice(run.status === "succeeded" ? "工作流已在本地完成。" : `工作流${runLabel(run.status)}：${run.error ?? "请检查步骤记录"}`);
    } catch (error) {
      setNotice(operationErrorMessage(error, "运行工作流失败"));
    } finally {
      setActiveOperationId((current) => current === operationId ? undefined : current);
      setActiveWorkflowId((current) => current === workflowId ? undefined : current);
    }
  }

  async function deleteWorkflow(workflowId: string): Promise<void> {
    const workflow = workflows.find(({ id }) => id === workflowId);
    if (!window.confirm(`移除工作流“${workflow?.name ?? "当前工作流"}”？活动定义会被移除，历史运行审计仍保留。`)) return;
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

  async function decideApproval(approval: WorkflowApprovalRequest, decision: "approved" | "rejected"): Promise<void> {
    setNotice(undefined);
    try {
      const run = await window.bubu.workflows.decideApproval({ approvalId: approval.id, decision, note: decision === "approved" ? "已在工作流面板核对" : "已在工作流面板拒绝" });
      setLatestRun(run);
      await reload();
      setNotice(decision === "approved" ? "批准已使用一次，同一运行已继续。" : "本次运行已拒绝并终止。后续步骤未执行。");
    } catch (error) {
      setNotice(operationErrorMessage(error, "处理工作流审批失败"));
      await reload();
    }
  }

  const artifact = latestRun?.steps.flatMap(({ result }) => result && result.kind !== "human-approval" ? [result] : []).at(-1);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const selectedWorkflow = workflows.find(({ id }) => id === selectedWorkflowId) ?? workflows[0];
  const graphNodes = useMemo(() => buildWorkflowGraph(selectedWorkflow, latestRun, graphMode), [graphMode, latestRun, selectedWorkflow]);

  return (
    <section className="workflow-panel" aria-label="可重复工作流">
      <header className="workflow-header">
        <div><p className="hero-kicker">业务流程</p><h3>工作流与更新</h3></div>
        {draft && <div className="workflow-save-controls">
          <label><span>运行节奏</span><select value={schedule.preset} onChange={(event) => setSchedule((current) => ({ ...current, preset: event.target.value as TriggerPreset }))} aria-label="工作流触发方式">
              <option value="manual">仅手动运行</option>
              <option value="daily">每天</option>
              <option value="weekly">每周</option>
              <option value="monthly">每月（1 日）</option>
              <option value="dataset-version">数据版本更新后</option>
            </select></label>
          {(schedule.preset === "daily" || schedule.preset === "weekly" || schedule.preset === "monthly") && <label><span>执行时间</span><input type="time" value={`${String(schedule.hour).padStart(2, "0")}:${String(schedule.minute).padStart(2, "0")}`} onChange={(event) => { const hour = Number(event.target.value.slice(0, 2)); const minute = Number(event.target.value.slice(3, 5)); setSchedule((current) => ({ ...current, hour: Number.isFinite(hour) ? hour : current.hour, minute: Number.isFinite(minute) ? minute : current.minute })); }} /></label>}
          {schedule.preset === "weekly" && <label><span>执行日期</span><select value={schedule.weekday} onChange={(event) => setSchedule((current) => ({ ...current, weekday: Number(event.target.value) }))}>{["周日", "周一", "周二", "周三", "周四", "周五", "周六"].map((label, index) => <option value={index} key={label}>{label}</option>)}</select></label>}
          {schedule.preset === "monthly" && <label><span>每月日期</span><select value={schedule.dayOfMonth} onChange={(event) => setSchedule((current) => ({ ...current, dayOfMonth: Number(event.target.value) }))}>{Array.from({ length: 28 }, (_, index) => index + 1).map((day) => <option value={day} key={day}>{day} 日</option>)}</select></label>}
          <label className="workflow-approval-toggle"><input type="checkbox" checked={requireApproval} onChange={(event) => setRequireApproval(event.target.checked)} /><span>交付前必须人工批准</span></label>
          <button type="button" className="primary-action" onClick={() => void saveDraft()} disabled={saveBusy || activeOperationId !== undefined} aria-busy={saveBusy}><Waypoints size={14} />{saveBusy ? "正在保存…" : "保存为工作流"}</button>
        </div>}
      </header>
      <p className="settings-copy">{draft ? scheduleDescription(schedule, timeZone) : "工作流会使用已审查计划在本地执行，并把结果送回所属任务。"}</p>
      {notice && <div className="notice" role="status">{notice}</div>}
      {approvals.map((approval) => <article className="workflow-approval-card" key={approval.id}>
        <header><div><p className="chat-context-label">等待人工批准 · v{approval.definitionVersion}</p><h4>{approval.title}</h4></div><strong>{approval.risk === "high" ? "高" : approval.risk === "medium" ? "中" : "低"}风险</strong></header>
        <p>{approval.action}</p>
        <dl><div><dt>运行</dt><dd>{approval.runId.slice(0, 8)}…</dd></div><div><dt>节点</dt><dd>{approval.stepId} · 第 {approval.ordinal + 1} 步</dd></div><div><dt>目标</dt><dd>{approval.target.kind} · {approval.target.id.slice(0, 8)}…</dd></div><div><dt>有效期</dt><dd>{new Date(approval.expiresAt).toLocaleString("zh-CN")}</dd></div></dl>
        <p className="settings-copy">上游已完成步骤保留在同一运行记录中。批准只恢复这个定义版本、运行、节点和目标；拒绝或过期会终止后续步骤。</p>
        <div className="plan-actions"><button type="button" className="primary-action" onClick={() => void decideApproval(approval, "approved")}>批准并恢复同一运行</button><button type="button" className="danger-action" onClick={() => void decideApproval(approval, "rejected")}>拒绝并终止</button></div>
      </article>)}
      {workflows.length === 0 && <div className="workflow-empty"><p className="empty-copy">当前还没有可运行的工作流。先在数据对话中提出问题并审查计划，再保存为工作流。</p>{onReturnToConversation && <button type="button" className="primary-action" onClick={onReturnToConversation}>返回数据对话</button>}</div>}
      {workflows.length > 0 && <h4 className="workflow-section-title">已保存工作流</h4>}
      {selectedWorkflow && <section className="workflow-graph" aria-label="工作流节点图">
        <header><div><strong>{selectedWorkflow.name}</strong><small>{graphMode === "dynamic" ? "实时状态" : "流程定义"}</small></div><div className="seg-toggle"><button type="button" aria-pressed={graphMode === "static"} onClick={() => setGraphMode("static")}>静态</button><button type="button" aria-pressed={graphMode === "dynamic"} onClick={() => setGraphMode("dynamic")}>动态</button></div></header>
        <ol>{graphNodes.map((node, index) => <li className={`workflow-node workflow-node-${node.status}`} key={node.id}><span className="workflow-node-icon">{workflowNodeIcon(node)}</span><div><strong>{node.label}</strong><small>{node.detail}</small></div>{index < graphNodes.length - 1 && <span className="workflow-node-line" />}</li>)}</ol>
      </section>}
      {selectedWorkflow && <ExternalDeliveryPanel workflow={selectedWorkflow} target={target} onNotice={setNotice} />}
      <div className="workflow-list">
        {workflows.map((workflow) => (
          <article className={`workflow-row ${selectedWorkflow?.id === workflow.id ? "workflow-row-selected" : ""}`} key={workflow.id}>
            <button type="button" className="workflow-row-main" aria-pressed={selectedWorkflow?.id === workflow.id} onClick={() => setSelectedWorkflowId(workflow.id)}>
              <strong>{workflow.name}</strong>
              <small>v{workflow.version} · {workflow.steps.length} 步 · {workflow.timeoutMs / 1_000} 秒预算 · {workflowTriggerLabel(workflow)}{workflow.nextDueAt ? ` · 下次 ${new Date(workflow.nextDueAt).toLocaleString("zh-CN")}` : ""}</small>
            </button>
            <div>
              <button type="button" className="primary-action" disabled={activeOperationId !== undefined} onClick={() => void runWorkflow(workflow.id)}>
                {activeWorkflowId === workflow.id ? "运行中…" : "运行"}
              </button>
              <button type="button" className="secondary-action" disabled={activeOperationId !== undefined} onClick={() => void deleteWorkflow(workflow.id)}>移除</button>
              {hubProfile && (hubProfile.role === "owner" || hubProfile.role === "editor") && <button type="button" className="secondary-action" onClick={() => void window.bubu.hub.queueWorkflow({ workflowId: workflow.id, target }).then(() => setNotice("已把此工作流定义的加密版本加入本地 outbox；Hub 离线不影响本地运行。"), (error: unknown) => setNotice(operationErrorMessage(error, "加入 Hub outbox 失败")))}>加入加密 Sync</button>}
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
          <thead><tr>{artifact.value.columns.map((column) => <th key={column.label}>{column.label}<small>{resultTypeLabel(column.type)}</small></th>)}</tr></thead>
          <tbody>{artifact.value.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, index) => <td key={artifact.value.columns[index]?.label ?? index}>{cell === null ? "—" : String(cell)}</td>)}</tr>)}</tbody>
        </table></div>
        <ResultVisualization result={artifact.value} title="工作流结果" />
      </>}
    </section>
  );
}

function ExternalDeliveryPanel({ workflow, target, onNotice }: { readonly workflow: WorkflowDefinition; readonly target: WorkflowTarget; readonly onNotice: (value: string) => void }) {
  const [registry, setRegistry] = useState<WebhookRegistry>(); const [bindings, setBindings] = useState<readonly WorkflowDeliveryBinding[]>([]); const [jobs, setJobs] = useState<readonly ExternalDeliveryJob[]>([]);
  const [name, setName] = useState(""); const [url, setUrl] = useState(""); const [secret, setSecret] = useState("");
  const binding = bindings.find(({ workflowId }) => workflowId === workflow.id); const approvalReady = workflow.steps.at(-1)?.kind === "human-approval";
  async function load(): Promise<void> { const [nextRegistry, nextBindings, nextJobs] = await Promise.all([window.bubu.externalDelivery.listDestinations(), window.bubu.externalDelivery.listBindings(), window.bubu.externalDelivery.jobs()]); setRegistry(nextRegistry); setBindings(nextBindings); setJobs(nextJobs); }
  useEffect(() => { void load().catch((error: unknown) => onNotice(operationErrorMessage(error, "读取外部提醒失败"))); }, []);
  async function save(): Promise<void> { try { setRegistry(await window.bubu.externalDelivery.saveDestination({ name, url, secret })); setName(""); setUrl(""); setSecret(""); onNotice("Webhook 目的地已加密保存；尚未发送任何请求。"); } catch (error) { onNotice(operationErrorMessage(error, "保存 Webhook 失败")); } }
  async function bind(destinationId: string): Promise<void> { try { setBindings(await window.bubu.externalDelivery.bind({ workflowId: workflow.id, definitionVersion: workflow.version, target, destinationId })); onNotice(`外部提醒已绑定“${workflow.name}”v${workflow.version}；只有人工批准后成功完成的运行会发送最小事件。`); } catch (error) { onNotice(operationErrorMessage(error, "启用外部提醒失败")); } }
  async function test(destinationId: string): Promise<void> { try { const job = await window.bubu.externalDelivery.test(destinationId); setJobs(await window.bubu.externalDelivery.jobs()); onNotice(job.status === "succeeded" ? "测试提醒已送达；payload 不含产品数据。" : "测试提醒未送达，已记录有界重试或最终失败证据。"); } catch (error) { onNotice(operationErrorMessage(error, "测试提醒失败")); } }
  return <section className="external-delivery-panel" aria-label="外部提醒目的地"><header><div><strong>外部提醒</strong><small>HTTPS Webhook · 最多 3 次 · HMAC 签名</small></div><span>{binding ? `已绑定 v${binding.definitionVersion}` : "未启用"}</span></header><div className="security-warning">只发送任务状态、运行/工作流标识、可用的 Artifact 标识和本地打开提示；不发送原始行、问题、模型内容或本地路径。外部发送必须位于最终人工批准节点之后。</div>{!approvalReady && <p className="settings-copy">此工作流没有最终人工批准节点，因此外部提醒不可启用。保存新工作流时勾选“交付前必须人工批准”。</p>}<div className="remote-mcp-grid"><div>{registry?.destinations.map((destination) => <article className="mcp-connection-card" key={destination.id}><strong>{destination.name}</strong><code>{new URL(destination.url).origin}</code><small>密钥已加密 · renderer 不可读取</small><div className="plan-actions"><button type="button" onClick={() => void test(destination.id)}>发送无数据测试</button><button type="button" disabled={!approvalReady} onClick={() => void bind(destination.id)}>绑定当前 v{workflow.version}</button><button type="button" className="danger-action" onClick={() => void window.bubu.externalDelivery.removeDestination(destination.id).then(setRegistry)}>撤销</button></div></article>)}</div><form onSubmit={(event) => { event.preventDefault(); void save(); }}><h4>添加 Webhook</h4><label><span>名称</span><input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label><label><span>HTTPS URL</span><input required type="url" value={url} onChange={(event) => setUrl(event.target.value)} /></label><label><span>共享签名密钥（至少 16 字符）</span><input required type="password" minLength={16} value={secret} onChange={(event) => setSecret(event.target.value)} /></label><button type="submit">只保存，不发送</button></form></div>{binding && <button type="button" onClick={() => void window.bubu.externalDelivery.unbind(workflow.id).then(setBindings)}>停用当前工作流外部提醒</button>}<details><summary>最近发送证据（{jobs.length}）</summary>{jobs.slice(0, 10).map((job) => <p key={job.id}>{job.kind} · {job.status} · 尝试 {job.attempts}/3{job.errorCode ? ` · ${job.errorCode}` : ""}</p>)}</details></section>;
}

function workflowNodeIcon(node: WorkflowGraphNode) {
  if (node.kind === "trigger") return <Clock3 size={16} />;
  if (node.kind === "data") return <DatabaseZap size={16} />;
  if (node.kind === "approval") return <Check size={16} />;
  if (node.kind === "delivery") return node.status === "succeeded" ? <Check size={16} /> : <MessageSquareText size={16} />;
  return node.status === "failed" ? <RotateCcw size={16} /> : <BellRing size={16} />;
}
