import { useEffect, useState } from "react";
import { emptyPromptTemplateRegistry, promptTemplatesFor, removeCustomPromptTemplate, selectedPromptTemplate, selectPromptTemplate, upsertCustomPromptTemplate } from "@bubu/product-core";
import { parsePromptTemplate, type PromptTemplate, type PromptTemplateRegistry, type PromptTemplateScope } from "../shared/product-api.js";
import { newCustomPromptTemplateId, onPromptTemplateRegistryChange, readPromptTemplateRegistry, writePromptTemplateRegistry } from "./prompt-template-preferences.js";

interface Draft {
  readonly id?: string;
  readonly scope: PromptTemplateScope;
  readonly name: string;
  readonly description: string;
  readonly instruction: string;
}

const emptyDraft: Draft = { scope: "dataset-query", name: "", description: "", instruction: "" };
const scopeLabels: Readonly<Record<PromptTemplateScope, string>> = { "dataset-query": "处理 · 单对象计划", "group-query": "处理 · 业务主题计划", "aggregate-explanation": "输出 · 聚合解读" };

function draftFrom(template: PromptTemplate): Draft {
  return { ...(template.origin === "custom" ? { id: template.id } : {}), scope: template.scope, name: template.name, description: template.description, instruction: template.instruction };
}

export function PromptTemplateSettings() {
  const [registry, setRegistry] = useState<PromptTemplateRegistry>(() => readPromptTemplateRegistry());
  const [scope, setScope] = useState<PromptTemplateScope>("dataset-query");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [notice, setNotice] = useState<string>();
  useEffect(() => onPromptTemplateRegistryChange(() => setRegistry(readPromptTemplateRegistry())), []);

  function updateRegistry(next: PromptTemplateRegistry): void {
    writePromptTemplateRegistry(next);
    setRegistry(next);
  }

  function save(): void {
    const template = parsePromptTemplate({ schemaVersion: 1, id: draft.id ?? newCustomPromptTemplateId(), origin: "custom", scope: draft.scope, name: draft.name, description: draft.description, instruction: draft.instruction });
    const saved = upsertCustomPromptTemplate(registry, template);
    updateRegistry(selectPromptTemplate(saved, template.scope, template.id));
    setScope(template.scope);
    setDraft(draftFrom(template));
    setNotice("自定义模板已保存在本机，并设为该类任务的当前模板。");
  }

  function remove(template: PromptTemplate): void {
    if (template.origin !== "custom" || !window.confirm(`删除自定义模板「${template.name}」？`)) return;
    updateRegistry(removeCustomPromptTemplate(registry, template.id));
    setDraft(emptyDraft);
    setNotice("自定义模板已删除，相关任务已回到内置默认模板。");
  }

  const active = selectedPromptTemplate(scope, registry);
  const instructionLabel = draft.scope === "aggregate-explanation" ? "表达偏好" : "分析偏好";
  const instructionPlaceholder = draft.scope === "aggregate-explanation"
    ? "例如：先给结论，再列证据与限制；不要引入结果中不存在的事实。"
    : "例如：聚合时保留记录数；优先按月份和区域比较；没有足够字段时不要猜测。";
  return <section className="prompt-settings" aria-label="分析与输出提示词模板">
    <header className="settings-section-header"><div><p className="hero-kicker">可审查提示词策略</p><h3>分析与输出模板</h3><p className="settings-copy">处理模板约束模型如何提出计划；输出模板只调整已批准聚合结果的表达。模板不能增加字段、SQL、数据披露或执行权限，所有结果仍通过严格类型解析和本地验证。</p></div><button type="button" className="secondary-action" onClick={() => { updateRegistry(emptyPromptTemplateRegistry); setDraft(emptyDraft); setNotice("已恢复所有内置默认模板。"); }}>恢复默认</button></header>
    {notice && <div className="notice" role="status">{notice}</div>}
    <div className="prompt-scope-tabs" role="tablist" aria-label="模板类别">
      {(Object.keys(scopeLabels) as PromptTemplateScope[]).map((value) => <button type="button" role="tab" aria-selected={scope === value} key={value} onClick={() => { setScope(value); setDraft({ ...emptyDraft, scope: value }); }}>{scopeLabels[value]}</button>)}
    </div>
    <div className="prompt-settings-layout">
      <div className="prompt-template-list">
        {promptTemplatesFor(scope, registry).map((template) => <article className={active.id === template.id ? "prompt-template-card prompt-template-card-active" : "prompt-template-card"} key={template.id}>
          <button type="button" className="prompt-template-main" onClick={() => { updateRegistry(selectPromptTemplate(registry, scope, template.id)); setDraft(draftFrom(template)); }}><span><strong>{template.name}</strong><small>{template.description}</small></span><em>{template.origin === "builtin" ? "内置" : "自定义"}</em></button>
          {template.origin === "custom" && <button type="button" className="prompt-template-delete" onClick={() => remove(template)}>删除</button>}
        </article>)}
      </div>
      <form className="prompt-template-form" onSubmit={(event) => { event.preventDefault(); save(); }}>
        <div><strong>{draft.id ? "编辑自定义模板" : "新建自定义模板"}</strong><small>从明确的偏好开始，安全约束不可覆盖</small></div>
        <label><span>适用阶段</span><select value={draft.scope} onChange={(event) => setDraft((current) => ({ ...current, scope: event.target.value as PromptTemplateScope }))}>{(Object.keys(scopeLabels) as PromptTemplateScope[]).map((value) => <option key={value} value={value}>{scopeLabels[value]}</option>)}</select></label>
        <label><span>模板名称</span><input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} maxLength={80} required /></label>
        <label><span>用途说明</span><input value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} maxLength={240} required /></label>
        <label><span>{instructionLabel}</span><textarea value={draft.instruction} onChange={(event) => setDraft((current) => ({ ...current, instruction: event.target.value }))} maxLength={4_000} rows={7} required placeholder={instructionPlaceholder} /></label>
        <div className="provider-form-actions"><button type="submit" className="primary-action">保存并设为当前</button><button type="button" className="secondary-action" onClick={() => setDraft({ ...emptyDraft, scope })}>新建</button></div>
      </form>
    </div>
  </section>;
}
