import { useState } from "react";
import type {
  McpInspectionSnapshot,
  McpModelToolExecutionProposal,
  McpModelToolProposal,
  McpPromptGetResult,
  McpPromptModelAnswer,
  McpPromptModelProposal,
  McpToolCallRequest,
  McpToolCallResult,
  OperationId,
} from "../shared/product-api.js";
import { createOperationId, operationErrorMessage } from "./operation.js";

interface Props {
  readonly connectionId: string;
  readonly connectionName: string;
  readonly snapshot: McpInspectionSnapshot;
  readonly promptResult?: McpPromptGetResult;
}

export function McpModelBridgePanel({ connectionId, connectionName, snapshot, promptResult }: Props) {
  const [purpose, setPurpose] = useState("");
  const [goal, setGoal] = useState("");
  const [promptProposal, setPromptProposal] = useState<McpPromptModelProposal>();
  const [promptAnswer, setPromptAnswer] = useState<McpPromptModelAnswer>();
  const [toolModelProposal, setToolModelProposal] = useState<McpModelToolProposal>();
  const [executionProposal, setExecutionProposal] = useState<McpModelToolExecutionProposal>();
  const [toolResult, setToolResult] = useState<McpToolCallResult>();
  const [operationId, setOperationId] = useState<OperationId>();
  const [notice, setNotice] = useState<string>();
  const tools = snapshot.tools.filter(({ taskSupport }) => taskSupport !== "required").slice(0, 20);

  async function preparePrompt(): Promise<void> {
    if (!promptResult) return;
    setNotice(undefined);
    setPromptAnswer(undefined);
    try { setPromptProposal(await window.bubu.mcp.preparePromptModel({ purpose, prompt: promptResult })); }
    catch (error) { setNotice(operationErrorMessage(error, "无法准备 MCP 提示模型披露")); }
  }

  async function approvePrompt(): Promise<void> {
    if (!promptProposal) return;
    const id = createOperationId();
    setOperationId(id);
    try {
      setPromptAnswer(await window.bubu.mcp.approvePromptModel({ approvalToken: promptProposal.approvalToken }, id));
      setPromptProposal(undefined);
      setNotice("模型响应已完成；精确披露摘要已写入本地隐私账本。");
    } catch (error) {
      setPromptProposal(undefined);
      setNotice(operationErrorMessage(error, "MCP 提示模型响应失败，请重新审查"));
    } finally { setOperationId(undefined); }
  }

  async function prepareToolModel(): Promise<void> {
    setNotice(undefined);
    setExecutionProposal(undefined);
    setToolResult(undefined);
    try { setToolModelProposal(await window.bubu.mcp.prepareModelTool({ connectionId, connectionName, goal, tools })); }
    catch (error) { setNotice(operationErrorMessage(error, "无法准备 MCP 工具目录模型披露")); }
  }

  async function approveToolModel(): Promise<void> {
    if (!toolModelProposal) return;
    const id = createOperationId();
    setOperationId(id);
    try {
      setExecutionProposal(await window.bubu.mcp.approveModelTool({ approvalToken: toolModelProposal.approvalToken }, id));
      setToolModelProposal(undefined);
      setNotice("模型只提出了一个调用；工具尚未执行，请单独审查名称、完整参数与副作用。");
    } catch (error) {
      setToolModelProposal(undefined);
      setNotice(operationErrorMessage(error, "模型未能提出可验证的单一 MCP 调用"));
    } finally { setOperationId(undefined); }
  }

  async function executeTool(): Promise<void> {
    if (!executionProposal) return;
    const id = createOperationId();
    const request: McpToolCallRequest = { connectionId: executionProposal.connection.id, toolName: executionProposal.toolName, inputSchemaJson: executionProposal.inputSchemaJson, taskSupport: executionProposal.taskSupport, arguments: executionProposal.arguments };
    setOperationId(id);
    try {
      setToolResult(await window.bubu.mcp.executeModelTool({ approvalToken: executionProposal.approvalToken, request }, id));
      setExecutionProposal(undefined);
      setNotice("已执行一次明确批准的工具调用；结果停留在本地，没有自动回送模型。");
    } catch (error) {
      setExecutionProposal(undefined);
      setNotice(operationErrorMessage(error, "MCP 工具执行失败，请重新发现和审查"));
    } finally { setOperationId(undefined); }
  }

  async function dismiss(token: string): Promise<void> {
    try {
      await window.bubu.mcp.dismissModel({ approvalToken: token });
      setPromptProposal(undefined);
      setToolModelProposal(undefined);
      setNotice("已撤销本次模型披露批准，没有向模型发送内容。");
    } catch (error) { setNotice(operationErrorMessage(error, "撤销批准失败")); }
  }

  function revokeExecution(): void {
    if (!executionProposal) return;
    const request = { connectionId: executionProposal.connection.id, toolName: executionProposal.toolName, inputSchemaJson: executionProposal.inputSchemaJson, taskSupport: executionProposal.taskSupport, arguments: executionProposal.arguments };
    void window.bubu.mcp.dismissToolCall({ approvalToken: executionProposal.approvalToken, request });
    setExecutionProposal(undefined);
  }

  return <article className="mcp-model-bridge">
    <header><div><p className="hero-kicker">双重审批 · 无自主循环</p><h4>模型与 MCP 的受控桥接</h4></div><span>一次建议 / 一次执行</span></header>
    <div className="security-warning" role="note">MCP 内容、工具说明和模式都不可信。模型不能直接调用工具；工具结果也不会自动回送模型。</div>
    {notice && <p role="status">{notice}</p>}
    {operationId && <div className="analysis-progress">正在执行已批准步骤… <button type="button" onClick={() => void window.bubu.operations.cancel(operationId)}>取消</button></div>}
    {promptResult && <section>
      <h5>用已获取的提示生成一次模型响应</h5>
      <label><span>这次响应的目的</span><textarea rows={3} maxLength={500} value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="例如：整理成给运营同事的简短说明" /></label>
      {!promptProposal && <button type="button" disabled={!purpose.trim() || operationId !== undefined} onClick={() => void preparePrompt()}>审查将发送给模型的精确提示</button>}
      {promptProposal && <div className="mcp-model-review"><strong>模型披露审查</strong><dl><div><dt>目标</dt><dd>{promptProposal.destination.providerName} / {promptProposal.destination.model}</dd></div><div><dt>提示</dt><dd>{promptProposal.preparation.prompt.promptName}</dd></div><div><dt>消息 / 字节</dt><dd>{promptProposal.preparation.prompt.messages.length} / {promptProposal.payloadBytes}</dd></div><div><dt>SHA-256</dt><dd><code>{promptProposal.payloadSha256}</code></dd></div></dl><div className="plan-actions"><button type="button" className="primary-action" onClick={() => void approvePrompt()}>单独批准发送并生成响应</button><button type="button" onClick={() => void dismiss(promptProposal.approvalToken)}>撤销</button></div></div>}
      {promptAnswer && <div className="mcp-model-answer"><strong>模型响应</strong><p>{promptAnswer.response}</p><small>披露摘要：{promptAnswer.disclosure.payloadBytes} 字节 · {promptAnswer.disclosure.payloadSha256}</small></div>}
    </section>}
    <section>
      <h5>让模型从已发现工具中提出一个调用</h5>
      {tools.length === 0 ? <p>没有符合一次性调用约束的工具；需要 Tasks 的工具不会进入此路径。</p> : <>
        <label><span>要完成的明确目标</span><textarea rows={3} maxLength={1_000} value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="例如：按订单号读取一条状态，不能修改任何数据" /></label>
        {!toolModelProposal && !executionProposal && <button type="button" disabled={!goal.trim() || operationId !== undefined} onClick={() => void prepareToolModel()}>审查工具目录模型披露</button>}
        {toolModelProposal && <div className="mcp-model-review"><strong>只披露这 {toolModelProposal.preparation.tools.length} 个工具的名称、说明与模式</strong><dl><div><dt>目标</dt><dd>{toolModelProposal.destination.providerName} / {toolModelProposal.destination.model}</dd></div><div><dt>字节 / SHA-256</dt><dd>{toolModelProposal.payloadBytes} / <code>{toolModelProposal.payloadSha256}</code></dd></div></dl><ul>{toolModelProposal.preparation.tools.map((tool) => <li key={tool.name}><code>{tool.name}</code> · {tool.taskSupport}</li>)}</ul><div className="plan-actions"><button type="button" className="primary-action" onClick={() => void approveToolModel()}>批准模型只提出一个调用</button><button type="button" onClick={() => void dismiss(toolModelProposal.approvalToken)}>撤销</button></div></div>}
        {executionProposal && <div className="mcp-model-review"><strong>第二次独立审查：模型建议尚未执行</strong><div className="security-warning" role="alert">工具可能读写本机文件、访问网络或产生外部副作用。确认下面的精确参数后才会启动一次。</div><dl><div><dt>服务 / 工具</dt><dd>{executionProposal.connection.name} / <code>{executionProposal.toolName}</code></dd></div><div><dt>模式 SHA-256</dt><dd><code>{executionProposal.inputSchemaSha256}</code></dd></div><div><dt>完整参数</dt><dd><pre>{JSON.stringify(executionProposal.arguments, null, 2)}</pre></dd></div></dl><div className="plan-actions"><button type="button" className="primary-action" onClick={() => void executeTool()}>明确批准并只执行这一次</button><button type="button" onClick={revokeExecution}>撤销执行令牌</button></div></div>}
        {toolResult && <div className="mcp-model-answer"><strong>本地、不可信的工具结果</strong><div className="security-warning" role="note">结果未发送给模型，也不会触发下一次工具调用。</div><pre>{JSON.stringify(toolResult, null, 2)}</pre></div>}
      </>}
    </section>
  </article>;
}
