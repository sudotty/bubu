import { Archive, MessageSquarePlus, MoreHorizontal } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { ConversationTarget, ConversationThreadSummary } from "../shared/product-api.js";

function timeLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "刚刚";
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(date);
}

export function ConversationWorkbench({
  target,
  title,
  subtitle,
  inspector,
  children,
}: {
  readonly target: ConversationTarget;
  readonly title: string;
  readonly subtitle: string;
  readonly inspector?: (threadId: string | undefined) => ReactNode;
  readonly children: (threadId: string | undefined) => ReactNode;
}) {
  const [threads, setThreads] = useState<readonly ConversationThreadSummary[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function load(): Promise<void> {
    const next = await window.bubu.conversations.list(target);
    setThreads(next);
    setActiveThreadId((current) => next.some(({ id }) => id === current) ? current : next[0]?.id);
  }

  useEffect(() => {
    setThreads([]);
    setActiveThreadId(undefined);
    void load().catch(() => undefined);
  }, [target.id, target.kind]);

  async function createThread(): Promise<void> {
    setBusy(true);
    try {
      const thread = await window.bubu.conversations.create({ target, title: "新数据对话" });
      setThreads((current) => [{ id: thread.id, target: thread.target, title: thread.title, createdAt: thread.createdAt, updatedAt: thread.updatedAt }, ...current]);
      setActiveThreadId(thread.id);
    } finally {
      setBusy(false);
    }
  }

  async function archiveThread(threadId: string): Promise<void> {
    setBusy(true);
    try {
      await window.bubu.conversations.archive({ threadId, archived: true });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return <section className="conversation-workbench" aria-label={`${title} 对话工作台`}>
    <aside className="thread-sidebar" aria-label="对话线程">
      <header>
        <div><p className="hero-kicker">CONVERSATIONS</p><h3>{title}</h3></div>
        <button type="button" className="icon-action" onClick={() => void createThread()} disabled={busy} title="新建对话"><MessageSquarePlus size={17} /></button>
      </header>
      <p className="thread-sidebar-subtitle">{subtitle}</p>
      <div className="thread-list">
        {threads.map((thread) => <article className={`thread-item ${thread.id === activeThreadId ? "thread-item-active" : ""}`} key={thread.id}>
          <button type="button" onClick={() => setActiveThreadId(thread.id)} aria-pressed={thread.id === activeThreadId}>
            <strong>{thread.title}</strong><small>{timeLabel(thread.updatedAt)}</small>
          </button>
          <details className="thread-menu"><summary aria-label="线程操作"><MoreHorizontal size={16} /></summary><button type="button" onClick={() => void archiveThread(thread.id)} disabled={busy}><Archive size={14} />归档</button></details>
        </article>)}
        {threads.length === 0 && <div className="thread-empty"><p>还没有对话。</p><button type="button" className="secondary-action" onClick={() => void createThread()} disabled={busy}>开始一个新任务</button></div>}
      </div>
    </aside>
    <div className="conversation-stage">{children(activeThreadId)}</div>
    {inspector && <aside className="artifact-inspector" aria-label="结果与数据检查器">{inspector(activeThreadId)}</aside>}
  </section>;
}
