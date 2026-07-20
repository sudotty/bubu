import { Archive, ArchiveRestore, List, MessageSquarePlus, MoreHorizontal, PanelRight, Pencil, RotateCcw, X } from "lucide-react";
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
  readonly children: (threadId: string | undefined, createThread: () => Promise<void>, openArtifact: () => void) => ReactNode;
}) {
  const [threads, setThreads] = useState<readonly ConversationThreadSummary[]>([]);
  const [archivedThreads, setArchivedThreads] = useState<readonly ConversationThreadSummary[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [editingThreadId, setEditingThreadId] = useState<string>();
  const [editingTitle, setEditingTitle] = useState("");
  const [lastArchived, setLastArchived] = useState<ConversationThreadSummary>();
  const [notice, setNotice] = useState<string>();
  const [compactPane, setCompactPane] = useState<"threads" | "artifacts">();

  async function load(): Promise<void> {
    const [next, archived] = await Promise.all([
      window.bubu.conversations.list(target),
      window.bubu.conversations.list(target, true),
    ]);
    setThreads(next);
    setArchivedThreads(archived);
    setActiveThreadId((current) => next.some(({ id }) => id === current) ? current : next[0]?.id);
  }

  useEffect(() => {
    setThreads([]);
    setArchivedThreads([]);
    setActiveThreadId(undefined);
    setNotice(undefined);
    void load().catch((error: unknown) => setNotice(error instanceof Error ? error.message : "读取对话失败"));
  }, [target.id, target.kind]);

  async function createThread(): Promise<void> {
    setBusy(true);
    setNotice(undefined);
    try {
      const thread = await window.bubu.conversations.create({ target, title: "新数据对话" });
      setThreads((current) => [{ id: thread.id, target: thread.target, title: thread.title, createdAt: thread.createdAt, updatedAt: thread.updatedAt }, ...current]);
      setActiveThreadId(thread.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "创建对话失败");
    } finally {
      setBusy(false);
    }
  }

  async function archiveThread(threadId: string): Promise<void> {
    setBusy(true);
    setNotice(undefined);
    try {
      setLastArchived(threads.find(({ id }) => id === threadId));
      await window.bubu.conversations.archive({ threadId, archived: true });
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "归档对话失败");
    } finally {
      setBusy(false);
    }
  }

  async function restoreThread(threadId: string): Promise<void> {
    setBusy(true);
    setNotice(undefined);
    try {
      await window.bubu.conversations.archive({ threadId, archived: false });
      await load();
      setActiveThreadId(threadId);
      setLastArchived(undefined);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "恢复对话失败");
    } finally {
      setBusy(false);
    }
  }

  async function renameThread(threadId: string): Promise<void> {
    const title = editingTitle.trim();
    if (!title) return;
    setBusy(true);
    setNotice(undefined);
    try {
      const renamed = await window.bubu.conversations.rename({ threadId, title });
      setThreads((current) => current.map((thread) => thread.id === threadId ? { ...thread, title: renamed.title, updatedAt: renamed.updatedAt } : thread));
      setEditingThreadId(undefined);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "重命名失败");
    } finally {
      setBusy(false);
    }
  }

  return <section className={`conversation-workbench ${compactPane ? `compact-${compactPane}-open` : ""}`} aria-label={`${title} 对话工作台`}>
    <nav className="workbench-compact-nav" aria-label="任务工作区面板"><button type="button" className="workbench-task-toggle" aria-pressed={compactPane === "threads"} onClick={() => setCompactPane((current) => current === "threads" ? undefined : "threads")}><List size={16} />任务</button><button type="button" aria-pressed={compactPane === "artifacts"} onClick={() => setCompactPane((current) => current === "artifacts" ? undefined : "artifacts")}><PanelRight size={16} />结果</button>{compactPane && <button type="button" aria-label="关闭侧面板" onClick={() => setCompactPane(undefined)}><X size={16} /></button>}</nav>
    <div className="conversation-workbench-layout">
    <aside className="thread-sidebar" aria-label="对话线程">
      <header>
        <div><p className="hero-kicker">CONVERSATIONS</p><h3>{title}</h3></div>
        <button type="button" className="icon-action" onClick={() => void createThread()} disabled={busy} title="新建对话"><MessageSquarePlus size={17} /></button>
      </header>
      <p className="thread-sidebar-subtitle">{subtitle}</p>
      {notice && <div className="thread-notice" role="status">{notice}</div>}
      {lastArchived && <div className="thread-undo" role="status"><span>已归档“{lastArchived.title}”</span><button type="button" onClick={() => void restoreThread(lastArchived.id)} disabled={busy}><RotateCcw size={13} />撤销</button></div>}
      <div className="thread-list">
        {threads.map((thread) => <article className={`thread-item ${thread.id === activeThreadId ? "thread-item-active" : ""}`} key={thread.id}>
          {editingThreadId === thread.id ? <form className="thread-rename" onSubmit={(event) => { event.preventDefault(); void renameThread(thread.id); }}><label className="sr-only" htmlFor={`thread-title-${thread.id}`}>对话名称</label><input id={`thread-title-${thread.id}`} value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} maxLength={100} autoFocus /><button type="submit" disabled={busy || editingTitle.trim().length === 0}>保存</button></form> : <button type="button" onClick={() => { setActiveThreadId(thread.id); setCompactPane(undefined); }} aria-pressed={thread.id === activeThreadId}>
            <strong>{thread.title}</strong><small>{timeLabel(thread.updatedAt)}</small>
          </button>}
          {editingThreadId !== thread.id && <details className="thread-menu"><summary aria-label={`${thread.title} 的操作`}><MoreHorizontal size={16} /></summary><div><button type="button" onClick={() => { setEditingThreadId(thread.id); setEditingTitle(thread.title); }} disabled={busy}><Pencil size={14} />重命名</button><button type="button" onClick={() => void archiveThread(thread.id)} disabled={busy}><Archive size={14} />归档</button></div></details>}
        </article>)}
        {threads.length === 0 && <div className="thread-empty"><p>还没有对话。</p><button type="button" className="secondary-action" onClick={() => void createThread()} disabled={busy}>开始一个新任务</button></div>}
      </div>
      {archivedThreads.length > 0 && <details className="archived-threads"><summary><ArchiveRestore size={14} />已归档（{archivedThreads.length}）</summary><div>{archivedThreads.map((thread) => <button type="button" key={thread.id} onClick={() => void restoreThread(thread.id)} disabled={busy}><span><strong>{thread.title}</strong><small>{timeLabel(thread.updatedAt)}</small></span><ArchiveRestore size={14} /></button>)}</div></details>}
    </aside>
    <div className="conversation-stage">{children(activeThreadId, createThread, () => setCompactPane("artifacts"))}</div>
    {inspector && <aside className="artifact-inspector" aria-label="结果与数据检查器">{inspector(activeThreadId)}</aside>}
    </div>
  </section>;
}
