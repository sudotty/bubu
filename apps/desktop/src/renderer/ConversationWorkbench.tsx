import { Archive, ArchiveRestore, GitBranch, List, MessageSquarePlus, MoreHorizontal, PanelRight, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import type { ConversationTarget, ConversationThreadSummary } from "../shared/product-api.js";
import { recordProductMetric } from "./product-metrics.js";
import { ContextMenu } from "./ContextMenu.js";

type WorkbenchView = "artifacts" | "workflow";

function timeLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "刚刚";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(date);
  return new Intl.DateTimeFormat("zh-CN", { ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" as const }), month: "numeric", day: "numeric" }).format(date);
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
  readonly inspector?: (threadId: string | undefined, view: WorkbenchView, closePane: () => void) => ReactNode;
  readonly children: (threadId: string | undefined, createThread: () => Promise<void>, openArtifact: () => void) => ReactNode;
}) {
  const [threads, setThreads] = useState<readonly ConversationThreadSummary[]>([]);
  const [archivedThreads, setArchivedThreads] = useState<readonly ConversationThreadSummary[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [editingThreadId, setEditingThreadId] = useState<string>();
  const [editingTitle, setEditingTitle] = useState("");
  const [lastArchived, setLastArchived] = useState<ConversationThreadSummary>();
  const [deletingThread, setDeletingThread] = useState<ConversationThreadSummary>();
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [notice, setNotice] = useState<string>();
  const [compactPane, setCompactPane] = useState<"threads" | WorkbenchView>();
  const [contextMenu, setContextMenu] = useState<{ readonly x: number; readonly y: number }>();
  const [threadMenu, setThreadMenu] = useState<{ readonly thread: ConversationThreadSummary; readonly x: number; readonly y: number; readonly returnFocus: HTMLButtonElement }>();
  const workbenchRef = useRef<HTMLElement>(null);
  const inspectorRef = useRef<HTMLElement>(null);
  const compactReturnFocus = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!compactPane) return;
    const selector = compactPane === "threads" ? ".thread-sidebar" : ".artifact-inspector";
    if (workbenchRef.current) workbenchRef.current.scrollTo({ left: 0, top: 0 });
    workbenchRef.current?.querySelector<HTMLElement>(".conversation-workbench-layout")?.scrollTo({ left: 0, top: 0 });
    if (compactPane !== "threads" && inspectorRef.current) {
      // The same inspector node hosts result tables, lineage, and workflows.
      // Never carry a previous surface's horizontal/vertical scroll into the
      // next one; it can visually crop otherwise-contained workflow content.
      inspectorRef.current.scrollTo({ left: 0, top: 0 });
    }
    const timer = window.setTimeout(() => workbenchRef.current?.querySelector<HTMLElement>(`${selector} button, ${selector} input, ${selector} [tabindex='0']`)?.focus({ preventScroll: true }), 0);
    return () => window.clearTimeout(timer);
  }, [compactPane]);

  function toggleCompactPane(pane: "threads" | WorkbenchView, button: HTMLButtonElement): void {
    compactReturnFocus.current = button;
    setCompactPane((current) => current === pane ? undefined : pane);
  }

  function closeCompactPane(): void {
    setCompactPane(undefined);
    requestAnimationFrame(() => {
      const target = compactReturnFocus.current?.isConnected ? compactReturnFocus.current : workbenchRef.current;
      target?.focus();
    });
  }

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
      if (activeThreadId) {
        const current = await window.bubu.conversations.getById(activeThreadId);
        if (current && current.entries.length === 0) {
          setNotice("当前空任务可以直接使用，不会再创建重复任务。");
          setCompactPane(undefined);
          requestAnimationFrame(() => workbenchRef.current?.querySelector<HTMLTextAreaElement>(".analysis-composer textarea")?.focus());
          return;
        }
      }
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

  async function deleteThread(thread: ConversationThreadSummary): Promise<void> {
    if (deleteConfirmation.trim() !== thread.title) return;
    setBusy(true);
    setNotice(undefined);
    try {
      const result = await window.bubu.conversations.delete({ threadId: thread.id, expectedTitle: thread.title, expectedUpdatedAt: thread.updatedAt });
      setDeletingThread(undefined);
      setDeleteConfirmation("");
      await load();
      setNotice(`已永久删除归档任务及 ${result.deletedEntryCount} 条本地记录。此操作不可撤销。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "永久删除任务失败");
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

  function openPane(pane: "threads" | WorkbenchView): void {
    compactReturnFocus.current = document.activeElement instanceof HTMLButtonElement && !document.activeElement.closest(".context-menu") ? document.activeElement : null;
    setContextMenu(undefined);
    setCompactPane(pane);
  }

  function cancelRename(): void {
    setEditingThreadId(undefined);
    setEditingTitle("");
  }

  function openWorkbenchContextMenu(event: ReactMouseEvent<HTMLElement>): void {
    const targetElement = event.target instanceof Element ? event.target : null;
    if (targetElement?.closest("textarea, input, select, button, a, summary, [contenteditable='true']")) return;
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  }

  return <section ref={workbenchRef} tabIndex={-1} className={`conversation-workbench ${compactPane ? `compact-${compactPane}-open` : ""}`} aria-label={`${title} 对话工作台`} onContextMenu={openWorkbenchContextMenu} onKeyDown={(event) => { if (event.key === "Escape" && compactPane) { event.preventDefault(); closeCompactPane(); } }}>
    <nav className="workbench-compact-nav" aria-label="任务工作区面板">
      <span className="workbench-identity"><strong>{title}</strong><small>{activeThreadId ? threads.find(({ id }) => id === activeThreadId)?.title ?? "当前任务" : "开始一个新任务"}</small></span>
      <button type="button" onClick={() => void createThread()} disabled={busy} title="新建对话"><MessageSquarePlus size={16} /><span>新任务</span></button>
      <button type="button" className="workbench-task-toggle" aria-controls="conversation-thread-sidebar" aria-expanded={compactPane === "threads"} onClick={(event) => toggleCompactPane("threads", event.currentTarget)}><List size={16} /><span>历史</span></button>
      <button type="button" aria-controls="conversation-artifact-inspector" aria-expanded={compactPane === "artifacts"} onClick={(event) => toggleCompactPane("artifacts", event.currentTarget)}><PanelRight size={16} /><span>数据与结果</span></button>
      <button type="button" aria-controls="conversation-artifact-inspector" aria-expanded={compactPane === "workflow"} onClick={(event) => toggleCompactPane("workflow", event.currentTarget)}><GitBranch size={16} /><span>工作流</span></button>
      {compactPane && <button type="button" className="workbench-close-pane" aria-label="关闭侧面板" onClick={closeCompactPane}><X size={16} /><span>关闭</span></button>}
    </nav>
    <div className="conversation-workbench-layout">
    <aside id="conversation-thread-sidebar" className="thread-sidebar" aria-label="对话线程">
      <header>
        <div><p className="hero-kicker">任务历史</p><h3>{title}</h3></div>
      </header>
      <p className="thread-sidebar-subtitle">{subtitle}</p>
      {notice && <div className="thread-notice" role="status">{notice}</div>}
      {lastArchived && <div className="thread-undo" role="status"><span>已归档“{lastArchived.title}”</span><button type="button" onClick={() => void restoreThread(lastArchived.id)} disabled={busy}><RotateCcw size={13} />撤销</button></div>}
      <div className="thread-list">
        {threads.map((thread) => <article className={`thread-item ${thread.id === activeThreadId ? "thread-item-active" : ""}`} key={thread.id}>
          {editingThreadId === thread.id ? <form className="thread-rename" onSubmit={(event) => { event.preventDefault(); void renameThread(thread.id); }} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); cancelRename(); } }}><label className="sr-only" htmlFor={`thread-title-${thread.id}`}>对话名称</label><input id={`thread-title-${thread.id}`} value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} maxLength={100} autoFocus /><button type="submit" disabled={busy || editingTitle.trim().length === 0}>保存</button><button type="button" onClick={cancelRename}>取消</button></form> : <button type="button" onClick={() => { setActiveThreadId(thread.id); closeCompactPane(); }} aria-pressed={thread.id === activeThreadId}>
            <strong>{thread.title}</strong><small>{timeLabel(thread.updatedAt)}</small>
          </button>}
          {editingThreadId !== thread.id && <button type="button" className="thread-menu-trigger" aria-label={`${thread.title} 的操作`} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setThreadMenu({ thread, x: rect.right - 216, y: rect.bottom + 4, returnFocus: event.currentTarget }); }}><MoreHorizontal size={16} /></button>}
        </article>)}
        {threads.length === 0 && <div className="thread-empty"><p>还没有对话。</p><button type="button" className="secondary-action" onClick={() => void createThread()} disabled={busy}>开始一个新任务</button></div>}
      </div>
      {archivedThreads.length > 0 && <details className="archived-threads"><summary><ArchiveRestore size={14} />已归档（{archivedThreads.length}）</summary><div>{archivedThreads.map((thread) => <article key={thread.id}>{deletingThread?.id === thread.id ? <form className="thread-delete-confirmation" onSubmit={(event) => { event.preventDefault(); void deleteThread(thread); }}><strong>永久删除“{thread.title}”</strong><small>输入完整任务名称确认。有关联工作流证据时会拒绝删除。</small><input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder={thread.title} autoFocus /><div><button type="submit" className="danger-action" disabled={busy || deleteConfirmation.trim() !== thread.title}>永久删除</button><button type="button" onClick={() => { setDeletingThread(undefined); setDeleteConfirmation(""); }}>取消</button></div></form> : <><span><strong>{thread.title}</strong><small>{timeLabel(thread.updatedAt)}</small></span><div><button type="button" onClick={() => void restoreThread(thread.id)} disabled={busy}><ArchiveRestore size={14} />恢复</button><button type="button" className="danger-action" onClick={() => { setDeletingThread(thread); setDeleteConfirmation(""); }} disabled={busy}><Trash2 size={14} />删除</button></div></>}</article>)}</div></details>}
    </aside>
    <div className="conversation-stage">{children(activeThreadId, createThread, () => { if (document.activeElement instanceof HTMLButtonElement) compactReturnFocus.current = document.activeElement; setCompactPane("artifacts"); recordProductMetric({ name: "artifact_opened", targetKind: target.kind, outcome: "succeeded" }); })}</div>
    {compactPane && <div className="workbench-pane-backdrop" aria-hidden="true" onClick={closeCompactPane} />}
    {inspector && <aside ref={inspectorRef} id="conversation-artifact-inspector" className="artifact-inspector" aria-label="结果与工作流检查器">{inspector(activeThreadId, compactPane === "workflow" ? "workflow" : "artifacts", closeCompactPane)}</aside>}
    </div>
    {threadMenu && <ContextMenu x={threadMenu.x} y={threadMenu.y} label={`${threadMenu.thread.title} 的操作`} returnFocus={threadMenu.returnFocus} onClose={() => setThreadMenu(undefined)} items={[
      { label: "重命名任务", icon: <Pencil size={14} />, disabled: busy, onSelect: () => { setEditingThreadId(threadMenu.thread.id); setEditingTitle(threadMenu.thread.title); } },
      { label: "归档任务", icon: <Archive size={14} />, danger: true, disabled: busy, onSelect: () => void archiveThread(threadMenu.thread.id) },
    ]} />}
    {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} label="对话操作" returnFocus={workbenchRef.current} onClose={() => setContextMenu(undefined)} items={[
      { label: "新建数据任务", icon: <MessageSquarePlus size={15} />, onSelect: () => void createThread() },
      { label: "查看任务历史", icon: <List size={15} />, onSelect: () => openPane("threads") },
      { label: "打开结果", icon: <PanelRight size={15} />, onSelect: () => openPane("artifacts") },
      { label: "查看工作流", icon: <GitBranch size={15} />, onSelect: () => openPane("workflow") },
    ]} />}
  </section>;
}
