import { Bot, CircleEllipsis, Download, TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { operationErrorMessage } from "./operation.js";

export function ChatUserMessage({ children, historical = false }: { readonly children: ReactNode; readonly historical?: boolean }) {
  return <article className="chat-message chat-message-user" aria-label={historical ? "你的历史消息" : "你的消息"}>
    <small>{historical ? "你 · 历史" : "你"}</small>
    <div>{children}</div>
  </article>;
}

export function ChatToolEvent({ children, busy = false }: { readonly children: ReactNode; readonly busy?: boolean }) {
  return <div className={`chat-tool-event ${busy ? "chat-tool-event-busy" : ""}`} role="status" aria-live={busy ? "polite" : "off"}>
    <CircleEllipsis size={16} aria-hidden="true" />
    <span>{children}</span>
  </div>;
}

export function ChatAssistantMessage({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return <article className="chat-message chat-message-assistant" aria-label="BuBu 的消息">
    <span className="chat-assistant-mark" aria-hidden="true"><Bot size={15} /></span>
    <div><strong>{title}</strong><div className="chat-assistant-copy">{children}</div></div>
  </article>;
}

type ExportableResult = {
  readonly columns: readonly { readonly label: string }[];
  readonly rows: readonly (readonly (string | number | boolean | null)[])[];
};

export function ChatResultFile({ title, result }: { readonly title: string; readonly result: ExportableResult }) {
  const [notice, setNotice] = useState<string>();
  async function exportResult(): Promise<void> {
    setNotice(undefined);
    try {
      const outcome = await window.bubu.artifacts.exportTable({
        title,
        columns: result.columns.map(({ label }) => label),
        rows: result.rows.map((row) => [...row]),
      });
      setNotice(outcome.status === "exported" ? `已在你选定的位置保存 ${outcome.rowCount} 行 CSV。` : "未导出文件。");
    } catch (error) {
      setNotice(operationErrorMessage(error, "导出本次结果失败"));
    }
  }
  return <div className="chat-result-file">
    <div><Download size={15} aria-hidden="true" /><span><strong>本次结果 CSV</strong><small>仅在你选定的本地位置保存，不会发送给模型。</small></span></div>
    <button type="button" className="chat-artifact-link" onClick={() => void exportResult()}>导出本次结果 CSV</button>
    {notice && <small role="status">{notice}</small>}
  </div>;
}

export function ChatRecoveryMessage({ message, actions }: { readonly message: string; readonly actions: ReactNode }) {
  return <section className="chat-message chat-message-recovery" role="alert">
    <TriangleAlert size={18} aria-hidden="true" />
    <div><strong>这一步没有完成</strong><p>{message}</p><div className="chat-recovery-actions">{actions}</div></div>
  </section>;
}
