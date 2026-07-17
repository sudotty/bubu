import { useEffect, useState } from "react";
import type {
  McpConnectionConfigurationInput,
  McpConnectionProfile,
  McpConnectionRegistryState,
  McpInspectionProposal,
  McpInspectionSnapshot,
  McpAuditEvent,
  McpResourceReadProposal,
  McpResourceReadResult,
  OperationId,
} from "../shared/product-api.js";
import { createOperationId, operationErrorMessage } from "./operation.js";

interface EnvironmentDraft {
  readonly name: string;
  readonly value: string;
}

interface McpDraft {
  readonly id?: string;
  readonly name: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly environment: readonly EnvironmentDraft[];
}

const emptyDraft: McpDraft = { name: "", command: "", args: [], environment: [] };

function draftFrom(profile: McpConnectionProfile): McpDraft {
  return {
    id: profile.id,
    name: profile.name,
    command: profile.transport.command,
    args: profile.transport.args,
    environment: profile.transport.environmentKeys.map((name) => ({ name, value: "" })),
  };
}

function configurationFrom(draft: McpDraft): McpConnectionConfigurationInput {
  return {
    ...(draft.id === undefined ? {} : { id: draft.id }),
    name: draft.name,
    command: draft.command,
    args: [...draft.args],
    environment: draft.environment.map(({ name, value }) => ({
      name,
      ...(value.length === 0 ? {} : { value }),
    })),
  };
}

function capabilityCount(snapshot: McpInspectionSnapshot): number {
  return snapshot.tools.length + snapshot.resources.length + snapshot.prompts.length;
}

export function McpSettings() {
  const [registry, setRegistry] = useState<McpConnectionRegistryState>();
  const [draft, setDraft] = useState<McpDraft>(emptyDraft);
  const [proposal, setProposal] = useState<McpInspectionProposal>();
  const [snapshot, setSnapshot] = useState<McpInspectionSnapshot>();
  const [inspectedConnectionId, setInspectedConnectionId] = useState<string>();
  const [resourceProposal, setResourceProposal] = useState<McpResourceReadProposal>();
  const [resourceResult, setResourceResult] = useState<McpResourceReadResult>();
  const [audits, setAudits] = useState<readonly McpAuditEvent[]>([]);
  const [operationId, setOperationId] = useState<OperationId>();
  const [busy, setBusy] = useState<string>();
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    let active = true;
    void window.bubu.mcp.list()
      .then((value) => { if (active) setRegistry(value); })
      .catch((error: unknown) => { if (active) setNotice(operationErrorMessage(error, "读取 MCP 连接失败")); });
    void window.bubu.mcp.listAudits()
      .then((value) => { if (active) setAudits(value); })
      .catch((error: unknown) => { if (active) setNotice(operationErrorMessage(error, "读取 MCP 本地审计失败")); });
    return () => { active = false; };
  }, []);

  function updateDraft(value: Partial<McpDraft>): void {
    setDraft((current) => ({ ...current, ...value }));
  }

  async function refreshAudits(): Promise<void> {
    try {
      setAudits(await window.bubu.mcp.listAudits());
    } catch (error) {
      setNotice(operationErrorMessage(error, "刷新 MCP 本地审计失败"));
    }
  }

  function updateArgument(index: number, value: string): void {
    updateDraft({ args: draft.args.map((argument, current) => current === index ? value : argument) });
  }

  function updateEnvironment(index: number, value: Partial<EnvironmentDraft>): void {
    updateDraft({
      environment: draft.environment.map((entry, current) => current === index ? { ...entry, ...value } : entry),
    });
  }

  async function save(): Promise<void> {
    setBusy("save");
    setNotice(undefined);
    try {
      const next = await window.bubu.mcp.save(configurationFrom(draft));
      setRegistry(next);
      const saved = draft.id === undefined
        ? next.connections.find(({ name, transport }) => name === draft.name && transport.command === draft.command)
        : next.connections.find(({ id }) => id === draft.id);
      if (saved) setDraft(draftFrom(saved));
      setNotice("MCP 连接已保存，但尚未启动。环境值只写入操作系统加密存储。");
    } catch (error) {
      setNotice(operationErrorMessage(error, "保存 MCP 连接失败"));
    } finally {
      setBusy(undefined);
    }
  }

  async function remove(connectionId: string): Promise<void> {
    if (!window.confirm("删除这个 MCP 连接及其本地加密环境值？")) return;
    setBusy(connectionId);
    try {
      setRegistry(await window.bubu.mcp.remove(connectionId));
      if (draft.id === connectionId) setDraft(emptyDraft);
      setProposal(undefined);
      setSnapshot(undefined);
      setInspectedConnectionId(undefined);
      setResourceProposal(undefined);
      setResourceResult(undefined);
      setNotice("MCP 连接已删除。");
    } catch (error) {
      setNotice(operationErrorMessage(error, "删除 MCP 连接失败"));
    } finally {
      setBusy(undefined);
    }
  }

  async function prepareInspection(connectionId: string): Promise<void> {
    setBusy(connectionId);
    setNotice(undefined);
    setSnapshot(undefined);
    setInspectedConnectionId(undefined);
    setResourceProposal(undefined);
    setResourceResult(undefined);
    try {
      setProposal(await window.bubu.mcp.prepareInspection(connectionId));
    } catch (error) {
      setNotice(operationErrorMessage(error, "无法准备 MCP 启动审查"));
    } finally {
      setBusy(undefined);
    }
  }

  async function approveInspection(): Promise<void> {
    if (!proposal) return;
    const nextOperationId = createOperationId();
    setOperationId(nextOperationId);
    setNotice(undefined);
    try {
      const result = await window.bubu.mcp.approveInspection(
        { approvalToken: proposal.approvalToken },
        nextOperationId,
      );
      setSnapshot(result);
      setInspectedConnectionId(proposal.connection.id);
      setProposal(undefined);
      setNotice(`检查完成：发现 ${capabilityCount(result)} 项 MCP 能力；没有调用任何工具、资源或提示。`);
    } catch (error) {
      setProposal(undefined);
      setNotice(operationErrorMessage(error, "MCP 检查失败，请重新审查后重试"));
    } finally {
      setOperationId(undefined);
    }
  }


  async function prepareResourceRead(resourceUri: string): Promise<void> {
    if (!inspectedConnectionId || resourceProposal) return;
    setBusy(resourceUri);
    setNotice(undefined);
    setResourceResult(undefined);
    try {
      setResourceProposal(await window.bubu.mcp.prepareResourceRead({
        connectionId: inspectedConnectionId,
        resourceUri,
      }));
    } catch (error) {
      setNotice(operationErrorMessage(error, "无法准备 MCP 资源读取审查"));
    } finally {
      setBusy(undefined);
    }
  }

  async function approveResourceRead(): Promise<void> {
    if (!resourceProposal) return;
    const nextOperationId = createOperationId();
    setOperationId(nextOperationId);
    setNotice(undefined);
    try {
      const result = await window.bubu.mcp.approveResourceRead(
        { approvalToken: resourceProposal.approvalToken },
        nextOperationId,
      );
      setResourceResult(result);
      setResourceProposal(undefined);
      setNotice(`本地读取完成：${result.contents.length} 个内容片段，${result.decodedBytes} 字节；未发送给模型。`);
    } catch (error) {
      setResourceProposal(undefined);
      setNotice(operationErrorMessage(error, "MCP 资源读取失败，请重新发现并审查"));
    } finally {
      setOperationId(undefined);
      await refreshAudits();
    }
  }

  async function dismissResourceRead(): Promise<void> {
    if (!resourceProposal) return;
    try {
      await window.bubu.mcp.dismissResourceRead({ approvalToken: resourceProposal.approvalToken });
      setResourceProposal(undefined);
      setNotice("已撤销 MCP 资源读取批准；没有启动本地进程，也没有发送 URI。");
    } catch (error) {
      setNotice(operationErrorMessage(error, "撤销 MCP 资源读取批准失败"));
    }
  }

  async function dismissInspection(): Promise<void> {
    if (!proposal) return;
    try {
      await window.bubu.mcp.dismissInspection({ approvalToken: proposal.approvalToken });
      setProposal(undefined);
      setNotice("已撤销 MCP 启动批准；没有启动本地进程。");
    } catch (error) {
      setNotice(operationErrorMessage(error, "撤销 MCP 启动批准失败"));
    }
  }

  return <section className="mcp-settings" aria-label="MCP 连接中心">
    <header className="settings-section-header">
      <div><p className="hero-kicker">MCP CONNECTION CENTER</p><h3>MCP 连接</h3></div>
      <button type="button" className="secondary-action" onClick={() => setDraft(emptyDraft)}>新增</button>
    </header>
    <div className="security-warning" role="note">
      本地 MCP 服务是未受信任代码，会以当前桌面用户权限运行。BuBu 不使用 Shell、不自动启动，也不会把发现的能力交给模型。
    </div>
    {notice && <div className="notice" role="status">{notice}</div>}
    <div className="mcp-settings-grid">
      <div className="mcp-connection-list">
        {!registry && <p className="empty-copy">正在读取本地 MCP 配置…</p>}
        {registry?.connections.length === 0 && <p className="empty-copy">尚未配置本地 stdio MCP 服务。</p>}
        {registry?.connections.map((connection) => <article className="mcp-connection-card" key={connection.id}>
          <button type="button" className="provider-card-main" onClick={() => setDraft(draftFrom(connection))}>
            <span className="provider-icon">M</span>
            <span><strong>{connection.name}</strong><small>{connection.transport.command}</small></span>
          </button>
          <div className="provider-badges"><small>stdio</small><small>{connection.transport.environmentKeys.length} 个加密环境值</small></div>
          <div className="provider-actions">
            <button type="button" disabled={busy !== undefined || operationId !== undefined || proposal !== undefined || resourceProposal !== undefined} onClick={() => void prepareInspection(connection.id)}>审查并检查</button>
            <button type="button" disabled={busy !== undefined || operationId !== undefined || proposal !== undefined || resourceProposal !== undefined} onClick={() => void remove(connection.id)}>删除</button>
          </div>
        </article>)}
      </div>
      <form className="mcp-connection-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <div><p className="hero-kicker">NO SHELL · WRITE-ONLY SECRETS</p><h4>{draft.id === undefined ? "添加本地 MCP" : "编辑本地 MCP"}</h4></div>
        {registry && !registry.encryptionAvailable && <div className="security-warning" role="alert">系统加密存储不可用；BuBu 将拒绝新增或修改环境秘密。</div>}
        <label><span>显示名称</span><input required maxLength={100} value={draft.name} onChange={(event) => updateDraft({ name: event.target.value })} /></label>
        <label><span>已安装服务的绝对可执行文件</span><input required value={draft.command} onChange={(event) => updateDraft({ command: event.target.value })} placeholder="/absolute/path/to/mcp-server" /></label>
        <fieldset className="mcp-array-editor"><legend>参数（按顺序逐项传递，不经过 Shell）</legend>
          {draft.args.map((argument, index) => <div key={index}><input value={argument} onChange={(event) => updateArgument(index, event.target.value)} aria-label={`参数 ${index + 1}`} /><button type="button" onClick={() => updateDraft({ args: draft.args.filter((_, current) => current !== index) })}>移除</button></div>)}
          <button type="button" className="secondary-action" onClick={() => updateDraft({ args: [...draft.args, ""] })}>添加参数</button>
        </fieldset>
        <fieldset className="mcp-array-editor"><legend>加密环境值（编辑时留空保留原值）</legend>
          {draft.environment.map((entry, index) => <div key={index}>
            <input value={entry.name} onChange={(event) => updateEnvironment(index, { name: event.target.value })} placeholder="TOKEN_NAME" aria-label={`环境变量名 ${index + 1}`} />
            <input type="password" autoComplete="new-password" value={entry.value} onChange={(event) => updateEnvironment(index, { value: event.target.value })} placeholder="只写入" aria-label={`环境变量值 ${index + 1}`} />
            <button type="button" onClick={() => updateDraft({ environment: draft.environment.filter((_, current) => current !== index) })}>移除</button>
          </div>)}
          <button type="button" className="secondary-action" onClick={() => updateDraft({ environment: [...draft.environment, { name: "", value: "" }] })}>添加加密环境值</button>
        </fieldset>
        <button type="submit" className="primary-action" disabled={busy !== undefined || operationId !== undefined}>{busy === "save" ? "正在安全保存…" : "只保存，不启动"}</button>
      </form>
    </div>
    {proposal && <article className="mcp-launch-review">
      <header><div><strong>批准前检查精确启动</strong><small>{proposal.connection.name}</small></div><span>{proposal.budget.maxDurationMs / 1_000} 秒上限</span></header>
      <div className="security-warning" role="alert">此进程可访问当前桌面用户能访问的本机文件和网络。只批准你已经安装并信任来源的服务。</div>
      <dl><div><dt>规范化可执行文件</dt><dd><code>{proposal.connection.command}</code></dd></div><div><dt>环境键名</dt><dd>{proposal.connection.environmentKeys.join("、") || "无"}</dd></div><div><dt>批准失效</dt><dd>{new Date(proposal.expiresAt).toLocaleTimeString("zh-CN")}</dd></div></dl>
      <div><strong>全部参数（保持顺序，不拼接 Shell）</strong>{proposal.connection.args.length === 0 ? <p>无参数</p> : <ol>{proposal.connection.args.map((argument, index) => <li key={index}><code>{argument === "" ? "（空字符串）" : argument}</code></li>)}</ol>}</div>
      <p>本次只做协议初始化与列表发现：最多每类 {proposal.budget.maxItemsPerPrimitive} 项 / {proposal.budget.maxPagesPerPrimitive} 页；禁止调用工具、读取资源、获取提示、sampling、elicitation 和模型注入。</p>
      <div className="plan-actions"><button type="button" className="primary-action" onClick={() => void approveInspection()}>批准启动一次并只检查能力</button><button type="button" className="secondary-action" onClick={() => void dismissInspection()}>撤销且不启动</button></div>
    </article>}
    {operationId && <div className="analysis-progress">正在执行已批准的 MCP 本地操作… <button type="button" className="secondary-action" onClick={() => void window.bubu.operations.cancel(operationId)}>取消并关闭进程</button></div>}
    {snapshot && <article className="mcp-inspection-result">
      <header><div><p className="hero-kicker">UNTRUSTED SERVER METADATA</p><h4>{snapshot.server.title ?? snapshot.server.name}</h4><small>{snapshot.server.name} · {snapshot.server.version} · 请求协议 {snapshot.requestedProtocolVersion}</small></div><span>{snapshot.limited ? "结果已按预算截断" : "发现完成"}</span></header>
      {snapshot.untrustedMetadata && <div className="security-warning" role="note">以下名称、描述、annotations、schema、URI 和参数说明均来自 MCP 服务，只作为未受信任文本展示。</div>}
      {snapshot.instructions && <section><strong>服务说明（不可信，不会发送给模型）</strong><p>{snapshot.instructions}</p></section>}
      <div className="mcp-capability-columns">
        <section><h5>Tools · {snapshot.tools.length}</h5>{snapshot.tools.map((tool) => <details key={tool.name}><summary>{tool.title ?? tool.name}</summary><p>{tool.description ?? "无描述"}</p><small>annotations 仅展示，不作为安全事实：{JSON.stringify(tool.annotations ?? {})}</small><pre>{tool.inputSchemaJson}</pre></details>)}</section>
        <section><h5>Resources · {snapshot.resources.length}</h5>{snapshot.resources.map((resource) => <details key={resource.uri}><summary>{resource.title ?? resource.name}</summary><p>{resource.description ?? "无描述"}</p><code>{resource.uri}</code><div className="plan-actions"><button type="button" disabled={busy !== undefined || operationId !== undefined || resourceProposal !== undefined} onClick={() => void prepareResourceRead(resource.uri)}>审查读取</button></div></details>)}</section>
        <section><h5>Prompts · {snapshot.prompts.length}</h5>{snapshot.prompts.map((prompt) => <details key={prompt.name}><summary>{prompt.title ?? prompt.name}</summary><p>{prompt.description ?? "无描述"}</p><small>{prompt.arguments.map(({ name, required }) => `${name}${required ? "*" : ""}`).join("、") || "无参数"}</small></details>)}</section>
      </div>
    </article>}
    {resourceProposal && <article className="mcp-launch-review">
      <header><div><strong>批准前检查精确资源读取</strong><small>{resourceProposal.connection.name}</small></div><span>{resourceProposal.budget.maxDurationMs / 1_000} 秒上限</span></header>
      <div className="security-warning" role="alert">批准后会再次启动这段本地代码，并把下面的精确 URI 发送给它。返回内容不可信，只在本地显示，不会进入模型、Agent 或工作流。</div>
      <dl>
        <div><dt>规范化可执行文件</dt><dd><code>{resourceProposal.connection.command}</code></dd></div>
        <div><dt>精确资源 URI</dt><dd><code>{resourceProposal.resourceUri}</code></dd></div>
        <div><dt>环境键名</dt><dd>{resourceProposal.connection.environmentKeys.join("、") || "无"}</dd></div>
        <div><dt>批准失效</dt><dd>{new Date(resourceProposal.expiresAt).toLocaleTimeString("zh-CN")}</dd></div>
      </dl>
      <div><strong>全部参数（保持顺序，不拼接 Shell）</strong>{resourceProposal.connection.args.length === 0 ? <p>无参数</p> : <ol>{resourceProposal.connection.args.map((argument, index) => <li key={index}><code>{argument === "" ? "（空字符串）" : argument}</code></li>)}</ol>}</div>
      <p>读取前最多重新发现 {resourceProposal.budget.maxDiscoveredResources} 个资源 / {resourceProposal.budget.maxDiscoveryPages} 页；只读一个 URI；最多 {resourceProposal.budget.maxContentParts} 个内容片段和 {resourceProposal.budget.maxDecodedBytes / 1_024} KiB 解码内容。超限将整体失败，不会静默截断。</p>
      <div className="plan-actions"><button type="button" className="primary-action" onClick={() => void approveResourceRead()}>批准启动一次并读取此 URI</button><button type="button" className="secondary-action" onClick={() => void dismissResourceRead()}>撤销且不发送 URI</button></div>
    </article>}
    {resourceResult && <article className="mcp-resource-result">
      <header><div><p className="hero-kicker">LOCAL ONLY · UNTRUSTED CONTENT</p><h4>MCP 本地资源内容</h4><small>{resourceResult.requestedUri} · {resourceResult.decodedBytes} 字节</small></div><span>未发送给模型</span></header>
      <div className="security-warning" role="note">以下文本和元数据来自本地 MCP 服务，不作为 BuBu 指令；二进制正文不进入渲染器。</div>
      {resourceResult.contents.map((content, index) => <section key={`${content.uri}-${index}`}>
        <strong>{content.kind === "text" ? `文本片段 ${index + 1}` : `二进制片段 ${index + 1}`}</strong>
        <small>{content.mimeType ?? "未知 MIME"} · {content.decodedBytes} 字节 · {content.uri}</small>
        {content.kind === "text" ? <pre>{content.text}</pre> : <dl><div><dt>SHA-256</dt><dd><code>{content.sha256}</code></dd></div></dl>}
      </section>)}
    </article>}
    <article className="mcp-audit-history">
      <header><div><p className="hero-kicker">APPEND-ONLY · NO CONTENT</p><h4>MCP 本地审计</h4></div><button type="button" className="secondary-action" onClick={() => void refreshAudits()}>刷新</button></header>
      {audits.length === 0 ? <p className="empty-copy">尚无已批准的 MCP 资源读取记录。</p> : <div className="mcp-audit-list">{audits.map((audit) => <div key={audit.auditId}>
        <strong>{audit.connectionName} · {audit.status}</strong>
        <code>{audit.resourceUri}</code>
        <small>{new Date(audit.startedAt).toLocaleString("zh-CN")}{audit.status === "succeeded" ? ` · ${audit.contentParts} 片段 / ${audit.decodedBytes} 字节` : audit.status === "failed" ? ` · ${audit.errorCode}` : ""}</small>
      </div>)}</div>}
    </article>
  </section>;
}
