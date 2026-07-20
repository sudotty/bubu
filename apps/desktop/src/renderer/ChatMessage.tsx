import { Bot, CircleEllipsis, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

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

export function ChatRecoveryMessage({ message, actions }: { readonly message: string; readonly actions: ReactNode }) {
  return <section className="chat-message chat-message-recovery" role="alert">
    <TriangleAlert size={18} aria-hidden="true" />
    <div><strong>这一步没有完成</strong><p>{message}</p><div className="chat-recovery-actions">{actions}</div></div>
  </section>;
}
