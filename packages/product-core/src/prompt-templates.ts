import { parsePromptTemplate, parsePromptTemplateRegistry, type PromptTemplate, type PromptTemplateRegistry, type PromptTemplateScope } from "@bubu/contracts";

export const builtInPromptTemplates: readonly PromptTemplate[] = [
  parsePromptTemplate({ schemaVersion: 1, id: "builtin:dataset-balanced", origin: "builtin", scope: "dataset-query", name: "稳健分析", description: "平衡维度、指标、记录数与可读性", instruction: "优先选择最能直接回答问题的字段。聚合时保留记录数作为规模证据；避免没有业务意义的高基数维度。" }),
  parsePromptTemplate({ schemaVersion: 1, id: "builtin:dataset-detail", origin: "builtin", scope: "dataset-query", name: "明细核对", description: "优先返回少量可识别明细", instruction: "优先生成明细核对计划，限制在 20 行以内；只选择回答问题所需的列，不要擅自聚合。" }),
  parsePromptTemplate({ schemaVersion: 1, id: "builtin:group-lookup", origin: "builtin", scope: "group-query", name: "安全关联", description: "优先使用已确认的查找关系", instruction: "优先采用已保存且当前有效的关系，事实表放在左侧、唯一键查找表放在右侧；无法安全关联时不要猜测字段。" }),
  parsePromptTemplate({ schemaVersion: 1, id: "builtin:group-summary", origin: "builtin", scope: "group-query", name: "跨表汇总", description: "关联后按共同业务维度汇总", instruction: "先使用有效关系构建关联树，再选择共同业务维度和主要数值指标；聚合时保留记录数作为规模证据。" }),
  parsePromptTemplate({ schemaVersion: 1, id: "builtin:explain-evidence", origin: "builtin", scope: "aggregate-explanation", name: "证据优先", description: "先给结论，再用已批准单元格逐项支撑", instruction: "摘要先回答问题。发现按业务重要性排序，每项明确引用最少且充分的已批准单元格；无法由数据支持的原因放入限制。" }),
  parsePromptTemplate({ schemaVersion: 1, id: "builtin:explain-brief", origin: "builtin", scope: "aggregate-explanation", name: "管理层简报", description: "压缩为关键变化、风险和下一步问题", instruction: "使用简洁业务语言。最多给出 4 项关键发现，优先数量级、差异和异常；不臆测原因，并给出能由现有数据继续回答的下一步问题。" }),
] as const;

export const emptyPromptTemplateRegistry: PromptTemplateRegistry = parsePromptTemplateRegistry({ schemaVersion: 1, customTemplates: [], selected: {} });

const defaultTemplateIds: Readonly<Record<PromptTemplateScope, string>> = {
  "dataset-query": "builtin:dataset-balanced",
  "group-query": "builtin:group-lookup",
  "aggregate-explanation": "builtin:explain-evidence",
};

export function promptTemplatesFor(scope: PromptTemplateScope, registry?: PromptTemplateRegistry): readonly PromptTemplate[] {
  return [...builtInPromptTemplates, ...(registry?.customTemplates ?? [])].filter((template) => template.scope === scope);
}

export function selectedPromptTemplate(scope: PromptTemplateScope, registry?: PromptTemplateRegistry): PromptTemplate {
  const selectedId = scope === "dataset-query"
    ? registry?.selected.datasetQuery
    : scope === "group-query"
      ? registry?.selected.groupQuery
      : registry?.selected.aggregateExplanation;
  const templates = promptTemplatesFor(scope, registry);
  return templates.find(({ id }) => id === selectedId) ?? templates.find(({ id }) => id === defaultTemplateIds[scope])!;
}

export function resolvePromptTemplate(scope: PromptTemplateScope, candidate: PromptTemplate | undefined): PromptTemplate {
  if (candidate?.scope === scope) return parsePromptTemplate(candidate);
  return selectedPromptTemplate(scope);
}

export function upsertCustomPromptTemplate(registry: PromptTemplateRegistry, template: PromptTemplate): PromptTemplateRegistry {
  const parsed = parsePromptTemplate(template);
  if (parsed.origin !== "custom") throw new Error("Only custom prompt templates can be saved");
  return parsePromptTemplateRegistry({
    ...registry,
    customTemplates: [parsed, ...registry.customTemplates.filter(({ id }) => id !== parsed.id)],
  });
}

export function removeCustomPromptTemplate(registry: PromptTemplateRegistry, id: string): PromptTemplateRegistry {
  const customTemplates = registry.customTemplates.filter((template) => template.id !== id);
  const selected = {
    ...(registry.selected.datasetQuery === id ? {} : registry.selected.datasetQuery ? { datasetQuery: registry.selected.datasetQuery } : {}),
    ...(registry.selected.groupQuery === id ? {} : registry.selected.groupQuery ? { groupQuery: registry.selected.groupQuery } : {}),
    ...(registry.selected.aggregateExplanation === id ? {} : registry.selected.aggregateExplanation ? { aggregateExplanation: registry.selected.aggregateExplanation } : {}),
  };
  return parsePromptTemplateRegistry({ schemaVersion: 1, customTemplates, selected });
}

export function selectPromptTemplate(registry: PromptTemplateRegistry, scope: PromptTemplateScope, id: string): PromptTemplateRegistry {
  const template = promptTemplatesFor(scope, registry).find((candidate) => candidate.id === id);
  if (!template) throw new Error("Prompt template does not exist in this scope");
  return parsePromptTemplateRegistry({
    ...registry,
    selected: scope === "dataset-query"
      ? { ...registry.selected, datasetQuery: template.id }
      : scope === "group-query"
        ? { ...registry.selected, groupQuery: template.id }
        : { ...registry.selected, aggregateExplanation: template.id },
  });
}
