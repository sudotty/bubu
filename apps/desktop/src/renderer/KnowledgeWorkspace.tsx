import { useEffect, useMemo, useState } from "react";
import { BookOpen, CheckCircle2, FilePlus2, RefreshCw, Search, ShieldCheck, Trash2 } from "lucide-react";
import type { KnowledgeAnswer, KnowledgeDisclosureProposal, KnowledgeSearchResult, KnowledgeSource } from "../shared/product-api.js";
import { createOperationId, operationErrorMessage } from "./operation.js";

export function KnowledgeWorkspace() {
  const [sources, setSources] = useState<readonly KnowledgeSource[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [query, setQuery] = useState("");
  const [purpose, setPurpose] = useState("");
  const [result, setResult] = useState<KnowledgeSearchResult>();
  const [proposal, setProposal] = useState<KnowledgeDisclosureProposal>();
  const [answer, setAnswer] = useState<KnowledgeAnswer>();
  const [busy, setBusy] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const selected = useMemo(() => sources.find(({ id }) => id === selectedId), [sources, selectedId]);

  const load = async () => {
    const next = await window.bubu.knowledge.listSources();
    setSources(next);
    setSelectedId((current) => next.some(({ id }) => id === current) ? current : next[0]?.id);
  };
  useEffect(() => { void load().catch((error: unknown) => setNotice(operationErrorMessage(error, "读取本地知识失败"))); }, []);
  useEffect(() => { setResult(undefined); setProposal(undefined); setAnswer(undefined); setConfirmDelete(false); }, [selectedId]);

  const importSource = async () => {
    setBusy("import"); setNotice(undefined);
    try {
      const imported = await window.bubu.knowledge.importSource();
      if (!imported) return;
      await load(); setSelectedId(imported.id); setNotice(`已在本地建立 ${imported.chunkCount} 个可引用段落`);
    } catch (error) { setNotice(operationErrorMessage(error, "导入知识来源失败")); } finally { setBusy(undefined); }
  };
  const search = async () => {
    if (!selected || !query.trim()) return;
    setBusy("search"); setNotice(undefined); setProposal(undefined); setAnswer(undefined);
    try {
      const next = await window.bubu.knowledge.search({ query: query.trim(), sourceIds: [selected.id], limit: 8 });
      setResult(next);
      if (next.citations.length === 0) setNotice("没有找到匹配段落；本地检索不会编造答案。");
    } catch (error) { setNotice(operationErrorMessage(error, "本地知识检索失败")); } finally { setBusy(undefined); }
  };
  const prepare = async () => {
    if (!selected || !query.trim() || !purpose.trim()) return;
    setBusy("prepare"); setNotice(undefined);
    try {
      const next = await window.bubu.knowledge.prepareAnswer({ purpose: purpose.trim(), search: { query: query.trim(), sourceIds: [selected.id], limit: 8 } });
      setProposal(next); setResult({ schemaVersion: 1, query: next.preview.query, sourceVersions: [{ sourceId: selected.id, versionId: selected.versionId }], citations: next.preview.citations, searchedAt: new Date().toISOString() });
    } catch (error) { setNotice(operationErrorMessage(error, "准备知识披露失败")); } finally { setBusy(undefined); }
  };
  const approve = async () => {
    if (!proposal) return;
    const operationId = createOperationId(); setBusy("answer"); setNotice(undefined);
    try {
      setAnswer(await window.bubu.knowledge.approveAnswer({ approvalToken: proposal.approvalToken }, operationId));
      setProposal(undefined);
    } catch (error) { setNotice(operationErrorMessage(error, "生成引用回答失败")); } finally { setBusy(undefined); }
  };
  const rebuild = async () => {
    if (!selected) return;
    setBusy("rebuild"); setNotice(undefined);
    try { const rebuilt = await window.bubu.knowledge.rebuildSource(selected.id); await load(); setNotice(`索引已重建为版本 ${rebuilt.versionId.slice(0, 8)}`); }
    catch (error) { setNotice(operationErrorMessage(error, "重建知识索引失败")); } finally { setBusy(undefined); }
  };
  const remove = async () => {
    if (!selected) return;
    setBusy("delete"); setNotice(undefined);
    try { await window.bubu.knowledge.deleteSource(selected.id); await load(); setNotice("知识来源及其本地版本已删除"); }
    catch (error) { setNotice(operationErrorMessage(error, "删除知识来源失败")); } finally { setBusy(undefined); setConfirmDelete(false); }
  };

  return <section className="knowledge-workbench" aria-label="业务知识工作台">
    <aside className="knowledge-sources">
      <header><div><p className="hero-kicker">设备内来源</p><h3>业务知识</h3></div><button type="button" className="icon-button" aria-label="导入 TXT、Markdown 或 PDF" onClick={() => void importSource()} disabled={busy !== undefined}><FilePlus2 size={17} /></button></header>
      {sources.length === 0 && <div className="knowledge-empty"><BookOpen size={24} /><strong>导入第一份业务资料</strong><small>支持 TXT、Markdown 和带文本层的 PDF；路径不会保存。</small><button type="button" className="primary-action" onClick={() => void importSource()} disabled={busy !== undefined}>{busy === "import" ? "正在建立索引…" : "选择本地文档"}</button></div>}
      <div className="knowledge-source-list">{sources.map((source) => <button type="button" key={source.id} className={source.id === selectedId ? "is-active" : ""} onClick={() => setSelectedId(source.id)}><span><strong>{source.displayName}</strong><small>{source.kind.toUpperCase()} · {source.chunkCount} 段 · {Math.ceil(source.sourceBytes / 1024)} KiB</small></span><b>{source.versionId.slice(0, 6)}</b></button>)}</div>
      {selected && <div className="knowledge-source-actions"><button type="button" onClick={() => void rebuild()} disabled={busy !== undefined}><RefreshCw size={13} />重建版本</button>{confirmDelete ? <button type="button" className="danger-action" onClick={() => void remove()} disabled={busy !== undefined}>确认删除</button> : <button type="button" onClick={() => setConfirmDelete(true)} disabled={busy !== undefined}><Trash2 size={13} />删除</button>}</div>}
    </aside>
    <div className="knowledge-main">
      <section className="knowledge-search-card">
        <header><div><p className="hero-kicker">先检索，后披露</p><h3>{selected ? `询问 ${selected.displayName}` : "选择一个本地知识来源"}</h3></div><ShieldCheck size={21} /></header>
        <label><span>要查找的内容</span><textarea value={query} onChange={(event) => setQuery(event.target.value)} maxLength={500} rows={2} placeholder="例如：退款需要哪些材料？" disabled={!selected} /></label>
        <label><span>回答目的</span><input value={purpose} onChange={(event) => setPurpose(event.target.value)} maxLength={500} placeholder="例如：回答客服对退款材料的提问" disabled={!selected} /></label>
        <div className="knowledge-search-actions"><button type="button" className="secondary-action" onClick={() => void search()} disabled={!selected || !query.trim() || busy !== undefined}><Search size={14} />{busy === "search" ? "本地检索中…" : "仅在本地检索"}</button><button type="button" className="primary-action" onClick={() => void prepare()} disabled={!selected || !query.trim() || !purpose.trim() || busy !== undefined}>{busy === "prepare" ? "正在检查披露…" : "审查引用后回答"}</button></div>
      </section>
      {notice && <div className="notice" role="status">{notice}</div>}
      {proposal && <section className="knowledge-approval"><header><ShieldCheck size={20} /><div><strong>一次性知识披露审查</strong><small>{proposal.destination.providerName} / {proposal.destination.model} · {proposal.destination.endpointOrigin}</small></div></header><p>仅发送下方 {proposal.preview.citations.length} 个段落，共 {proposal.preview.payloadBytes} bytes。批准绑定来源版本、段落、问题、目的、模型目标和 SHA-256。</p><code>{proposal.preview.payloadSha256}</code><div className="knowledge-search-actions"><button type="button" className="secondary-action" onClick={() => { void window.bubu.knowledge.dismissAnswer({ approvalToken: proposal.approvalToken }); setProposal(undefined); }}>返回修改</button><button type="button" className="primary-action" onClick={() => void approve()} disabled={busy !== undefined}>{busy === "answer" ? "正在生成受审回答…" : "批准一次并生成回答"}</button></div></section>}
      {answer && <section className="knowledge-answer"><header><CheckCircle2 size={20} /><div><strong>引用回答</strong><small>仅依据本次批准的检索段落</small></div></header><p>{answer.answer}</p><div>{answer.citations.map(({ chunkId }) => <button type="button" key={chunkId} onClick={() => document.getElementById(`knowledge-chunk-${chunkId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>查看引用 {chunkId.slice(0, 8)}</button>)}</div></section>}
      {result && <section className="knowledge-results"><header><div><strong>本地检索证据</strong><small>{result.citations.length} 个精确段落 · 当前版本 {selected?.versionId.slice(0, 8)}</small></div></header>{result.citations.map((citation) => <article id={`knowledge-chunk-${citation.chunkId}`} key={citation.chunkId}><header><strong>段落 {citation.ordinal + 1}</strong><small>第 {citation.startLine}–{citation.endLine} 行 · 相关度 {citation.score.toFixed(2)}</small></header><p>{citation.text}</p><code>{citation.chunkId}</code></article>)}</section>}
    </div>
  </section>;
}
