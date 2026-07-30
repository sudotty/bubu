import { useEffect, useState } from "react";
import type { McpInspectionSnapshot, McpToolCallRequest, McpToolCallResult, OperationId, RemoteMcpAuditEvent, RemoteMcpConnectionConfigurationInput, RemoteMcpInspectionProposal, RemoteMcpOAuthStartProposal, RemoteMcpRegistryState, RemoteMcpToolCallProposal } from "../shared/product-api.js";
import { createOperationId, operationErrorMessage } from "./operation.js";

type Draft = { readonly id?: string; readonly name: string; readonly serverUrl: string; readonly oauth: boolean; readonly authorizationEndpoint: string; readonly tokenEndpoint: string; readonly clientId: string; readonly scopes: string };
const empty: Draft = { name: "", serverUrl: "", oauth: false, authorizationEndpoint: "", tokenEndpoint: "", clientId: "", scopes: "" };

function input(draft: Draft): RemoteMcpConnectionConfigurationInput {
  return { ...(draft.id === undefined ? {} : { id: draft.id }), name: draft.name, serverUrl: draft.serverUrl, authorization: draft.oauth ? { kind: "oauth-pkce", authorizationEndpoint: draft.authorizationEndpoint, tokenEndpoint: draft.tokenEndpoint, clientId: draft.clientId, scopes: draft.scopes.split(/\s+/u).filter(Boolean) } : { kind: "none" } };
}

export function RemoteMcpSettings() {
  const [registry, setRegistry] = useState<RemoteMcpRegistryState>();
  const [draft, setDraft] = useState<Draft>(empty);
  const [oauth, setOauth] = useState<RemoteMcpOAuthStartProposal>();
  const [inspection, setInspection] = useState<RemoteMcpInspectionProposal>();
  const [snapshot, setSnapshot] = useState<McpInspectionSnapshot>();
  const [inspectedConnectionId, setInspectedConnectionId] = useState<string>();
  const [toolName, setToolName] = useState<string>();
  const [toolArguments, setToolArguments] = useState("{}");
  const [toolProposal, setToolProposal] = useState<RemoteMcpToolCallProposal>();
  const [toolResult, setToolResult] = useState<McpToolCallResult>();
  const [operationId, setOperationId] = useState<OperationId>();
  const [notice, setNotice] = useState<string>();
  const [audits, setAudits] = useState<readonly RemoteMcpAuditEvent[]>([]);
  useEffect(() => { void window.bubu.remoteMcp.list().then(setRegistry).catch((error: unknown) => setNotice(operationErrorMessage(error, "读取远程 MCP 失败"))); void window.bubu.remoteMcp.listAudits().then(setAudits).catch(() => undefined); }, []);
  const update = (value: Partial<Draft>) => setDraft((current) => ({ ...current, ...value }));

  async function save(): Promise<void> {
    try { setRegistry(await window.bubu.remoteMcp.save(input(draft))); setDraft(empty); setNotice("远程连接已保存；没有发起网络请求或 OAuth。"); }
    catch (error) { setNotice(operationErrorMessage(error, "保存远程 MCP 失败")); }
  }
  async function prepareOAuth(id: string): Promise<void> {
    try { setOauth(await window.bubu.remoteMcp.prepareOAuth(id)); setNotice("已创建短期 loopback callback 与 PKCE；浏览器尚未打开。"); }
    catch (error) { setNotice(operationErrorMessage(error, "无法准备 OAuth PKCE")); }
  }
  async function refreshOAuth(id: string): Promise<void> {
    try { setRegistry(await window.bubu.remoteMcp.refreshOAuth(id)); setNotice("OAuth token 已在 main 进程中刷新；renderer 未接收 access token 或 refresh token。"); }
    catch (error) { setNotice(operationErrorMessage(error, "刷新失败，请重新授权")); }
  }
  async function approveOAuth(): Promise<void> {
    if (!oauth) return; const id = createOperationId(); setOperationId(id);
    try { setRegistry(await window.bubu.remoteMcp.approveOAuth({ connectionId: oauth.connectionId, state: oauth.state }, id)); setOauth(undefined); setNotice("OAuth token 已写入系统加密存储，renderer 从未接收 token。"); }
    catch (error) { setOauth(undefined); setNotice(operationErrorMessage(error, "OAuth 授权未完成")); }
    finally { setOperationId(undefined); setAudits(await window.bubu.remoteMcp.listAudits().catch(() => audits)); }
  }
  async function prepareInspection(id: string): Promise<void> {
    try { setInspection(await window.bubu.remoteMcp.prepareInspection(id)); setSnapshot(undefined); }
    catch (error) { setNotice(operationErrorMessage(error, "远程连接尚未具备检查条件")); }
  }
  async function approveInspection(): Promise<void> {
    if (!inspection) return; const id = createOperationId(); setOperationId(id);
    try { setSnapshot(await window.bubu.remoteMcp.approveInspection({ approvalToken: inspection.approvalToken }, id)); setInspectedConnectionId(inspection.connection.id); setInspection(undefined); setNotice("远程能力发现完成；未调用工具、读取资源或获取提示。"); }
    catch (error) { setInspection(undefined); setNotice(operationErrorMessage(error, "远程 MCP 检查失败")); }
    finally { setOperationId(undefined); setAudits(await window.bubu.remoteMcp.listAudits().catch(() => audits)); }
  }
  function toolRequest(): McpToolCallRequest {
    const tool = snapshot?.tools.find(({ name }) => name === toolName);
    if (!tool || !inspectedConnectionId) throw new Error("请先选择已发现的远程工具");
    const argumentsValue = JSON.parse(toolArguments) as unknown;
    if (typeof argumentsValue !== "object" || argumentsValue === null || Array.isArray(argumentsValue)) throw new Error("工具参数必须是 JSON 对象");
    return { connectionId: inspectedConnectionId, toolName: tool.name, inputSchemaJson: tool.inputSchemaJson, taskSupport: tool.taskSupport, arguments: argumentsValue as McpToolCallRequest["arguments"] };
  }
  async function prepareTool(): Promise<void> { try { setToolProposal(await window.bubu.remoteMcp.prepareTool(toolRequest())); setToolResult(undefined); } catch (error) { setNotice(operationErrorMessage(error, "无法准备远程工具审查")); } }
  async function approveTool(): Promise<void> {
    if (!toolProposal) return; const id = createOperationId(); setOperationId(id);
    try { setToolResult(await window.bubu.remoteMcp.approveTool({ approvalToken: toolProposal.approvalToken, request: toolProposal.request }, id)); setToolProposal(undefined); setNotice("已完成一次明确批准的远程工具调用；结果保持不可信且没有自动进入模型。"); }
    catch (error) { setToolProposal(undefined); setNotice(operationErrorMessage(error, "远程工具调用失败")); }
    finally { setOperationId(undefined); setAudits(await window.bubu.remoteMcp.listAudits().catch(() => audits)); }
  }

  return <section className="remote-mcp-settings" aria-label="远程 MCP 连接">
    <header className="settings-section-header"><div><p className="hero-kicker">HTTPS · DNS/redirect 重检 · OAuth PKCE</p><h3>远程 MCP</h3></div><span>高级连接</span></header>
    <div className="security-warning" role="note">仅允许无凭据 HTTPS URL。每次请求和重定向都重新解析并拒绝回环、私网、链路本地与保留地址。远程服务元数据仍是不可信内容。</div>
    {notice && <p role="status">{notice}</p>}
    {operationId && <div className="analysis-progress">等待已批准的外部步骤… <button type="button" onClick={() => void window.bubu.operations.cancel(operationId)}>取消</button></div>}
    <div className="remote-mcp-grid">
      <div>{registry?.connections.map((connection) => <article key={connection.id} className="mcp-connection-card"><strong>{connection.name}</strong><code>{connection.serverUrl}</code><small>{connection.authorization.kind === "none" ? "无需 OAuth" : `OAuth：${connection.authorizationStatus}`}</small><div className="plan-actions">{connection.authorization.kind === "oauth-pkce" && connection.authorizationStatus !== "connected" && <button type="button" onClick={() => void prepareOAuth(connection.id)}>审查 OAuth PKCE</button>}{connection.authorization.kind === "oauth-pkce" && connection.authorizationStatus === "expired" && <button type="button" onClick={() => void refreshOAuth(connection.id)}>刷新 token</button>}{connection.authorization.kind === "oauth-pkce" && connection.authorizationStatus === "connected" && <button type="button" onClick={() => void window.bubu.remoteMcp.revokeOAuth(connection.id).then(setRegistry)}>撤销 token</button>}<button type="button" disabled={connection.authorizationStatus === "disconnected" || connection.authorizationStatus === "expired"} onClick={() => void prepareInspection(connection.id)}>审查远程检查</button><button type="button" onClick={() => void window.bubu.remoteMcp.remove(connection.id).then(setRegistry)}>删除</button></div></article>)}</div>
      <form onSubmit={(event) => { event.preventDefault(); void save(); }}><h4>添加远程连接</h4><label><span>名称</span><input required maxLength={100} value={draft.name} onChange={(event) => update({ name: event.target.value })} /></label><label><span>Streamable HTTP URL</span><input required type="url" placeholder="https://mcp.example.com/rpc" value={draft.serverUrl} onChange={(event) => update({ serverUrl: event.target.value })} /></label><label><input type="checkbox" checked={draft.oauth} onChange={(event) => update({ oauth: event.target.checked })} /> 使用 OAuth Authorization Code + PKCE</label>{draft.oauth && <><label><span>Authorization endpoint</span><input required type="url" value={draft.authorizationEndpoint} onChange={(event) => update({ authorizationEndpoint: event.target.value })} /></label><label><span>Token endpoint</span><input required type="url" value={draft.tokenEndpoint} onChange={(event) => update({ tokenEndpoint: event.target.value })} /></label><label><span>Public client ID</span><input required value={draft.clientId} onChange={(event) => update({ clientId: event.target.value })} /></label><label><span>Scopes（空格分隔）</span><input value={draft.scopes} onChange={(event) => update({ scopes: event.target.value })} /></label></>}<button type="submit">只保存，不连接</button></form>
    </div>
    {oauth && <article className="mcp-launch-review"><header><div><strong>OAuth PKCE 外部浏览器审查</strong><small>{new URL(oauth.authorizationUrl).origin}</small></div><span>10 分钟</span></header><dl><div><dt>Authorization URL</dt><dd><code>{oauth.authorizationUrl}</code></dd></div><div><dt>精确 redirect</dt><dd><code>{oauth.redirectUrl}</code></dd></div><div><dt>state</dt><dd><code>{oauth.state}</code></dd></div></dl><p>批准后才会打开系统浏览器。回调必须命中 BuBu 当前持有的 127.0.0.1 端口并匹配 state；code 与 verifier 只在 main 中交换，token 只写系统加密存储。</p><button type="button" className="primary-action" onClick={() => void approveOAuth()}>批准打开浏览器并等待回调</button></article>}
    {inspection && <article className="mcp-launch-review"><header><div><strong>远程检查审查</strong><small>{inspection.connection.name}</small></div><span>{inspection.budget.maxDurationMs / 1_000} 秒</span></header><dl><div><dt>精确 HTTPS 目标</dt><dd><code>{inspection.connection.serverUrl}</code></dd></div><div><dt>OAuth 状态</dt><dd>{inspection.connection.authorizationStatus}</dd></div></dl><p>批准后只初始化并有界列出 tools/resources/prompts；不调用任何 primitive。DNS 与每个 redirect 会重新校验。</p><button type="button" className="primary-action" onClick={() => void approveInspection()}>批准一次远程能力检查</button></article>}
    {snapshot && <article className="mcp-inspection-result"><header><div><strong>{snapshot.server.title ?? snapshot.server.name}</strong><small>{snapshot.server.version}</small></div><span>不可信元数据</span></header><p>工具 {snapshot.tools.length} · 资源 {snapshot.resources.length} · 提示 {snapshot.prompts.length}</p>{snapshot.tools.map((tool) => <details key={tool.name}><summary>{tool.title ?? tool.name}</summary><p>{tool.description}</p><pre>{tool.inputSchemaJson}</pre><button type="button" disabled={tool.taskSupport === "required"} onClick={() => { setToolName(tool.name); setToolArguments("{}"); }}>填写参数并审查远程调用</button></details>)}{toolName && <form onSubmit={(event) => { event.preventDefault(); void prepareTool(); }}><label><span>{toolName} 的精确 JSON 参数</span><textarea rows={5} value={toolArguments} onChange={(event) => setToolArguments(event.target.value)} /></label><button type="submit">校验 schema 并创建一次性审查</button></form>}</article>}
    {toolProposal && <article className="mcp-launch-review"><header><div><strong>远程工具最终审查</strong><small>{toolProposal.connection.name}</small></div><span>一次调用</span></header><div className="security-warning" role="alert">远程工具可能产生外部副作用；取消不能撤回服务端已完成的动作。</div><dl><div><dt>HTTPS 目标</dt><dd><code>{toolProposal.connection.serverUrl}</code></dd></div><div><dt>工具</dt><dd><code>{toolProposal.request.toolName}</code></dd></div><div><dt>完整参数</dt><dd><pre>{JSON.stringify(toolProposal.request.arguments, null, 2)}</pre></dd></div></dl><button type="button" className="primary-action" onClick={() => void approveTool()}>明确批准一次远程调用</button></article>}
    {toolResult && <article className="mcp-tool-result"><header><div><strong>远程工具结果</strong><small>{toolResult.toolName}</small></div><span>本地展示 · 不可信</span></header><div className="security-warning" role="note">结果不会自动进入模型、Agent、工作流或下一次调用。</div><pre>{JSON.stringify(toolResult, null, 2)}</pre></article>}
    <article className="mcp-audit-history"><header><div><strong>远程 MCP 追加式审计</strong><small>不记录 token、参数值或结果正文</small></div><button type="button" onClick={() => void window.bubu.remoteMcp.listAudits().then(setAudits)}>刷新</button></header>{audits.length === 0 ? <p>尚无远程调用记录。</p> : audits.map((audit) => <div key={audit.auditId}><strong>{audit.connectionName} · {audit.status}</strong><code>{audit.operation === "remote-inspect" ? audit.endpointOrigin : `${audit.toolName}(${audit.inputKeys.join(", ")})`}</code><small>{new Date(audit.startedAt).toLocaleString("zh-CN")}</small></div>)}</article>
  </section>;
}
