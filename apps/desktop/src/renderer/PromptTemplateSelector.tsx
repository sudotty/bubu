import { useEffect, useState } from "react";
import { promptTemplatesFor, selectedPromptTemplate } from "@bubu/product-core";
import type { PromptTemplateRegistry, PromptTemplateScope } from "../shared/product-api.js";
import { choosePromptTemplate, onPromptTemplateRegistryChange, readPromptTemplateRegistry } from "./prompt-template-preferences.js";

export function PromptTemplateSelector({ scope }: { readonly scope: PromptTemplateScope }) {
  const [registry, setRegistry] = useState<PromptTemplateRegistry>(() => readPromptTemplateRegistry());
  useEffect(() => onPromptTemplateRegistryChange(() => setRegistry(readPromptTemplateRegistry())), []);
  const selected = selectedPromptTemplate(scope, registry);
  const label = scope === "aggregate-explanation" ? "输出模板" : "分析模板";
  const accessibleLabel = scope === "dataset-query" ? "单对象分析模板" : scope === "group-query" ? "业务主题分析模板" : "聚合结果输出模板";
  return <label className="prompt-template-selector">
    <span>{label}</span>
    <select value={selected.id} onChange={(event) => choosePromptTemplate(scope, event.target.value)} aria-label={accessibleLabel}>
      {promptTemplatesFor(scope, registry).map((template) => <option key={template.id} value={template.id}>{template.name}{template.origin === "custom" ? " · 自定义" : ""}</option>)}
    </select>
    <small>{selected.description}</small>
  </label>;
}
