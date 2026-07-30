export type DataCleanTemplateId = "monthly-prep" | "customer-dedup" | "order-normalization" | "append-exports" | "reference-mapping";

export interface DataCleanTemplate {
  readonly id: DataCleanTemplateId;
  readonly name: string;
  readonly description: string;
  readonly mode: "select" | "deduplicate" | "append" | "reference-check";
  readonly needsSecondSource: boolean;
}

export const dataCleanTemplates: readonly DataCleanTemplate[] = [
  { id: "monthly-prep", name: "月度汇总准备", description: "保留业务列并设置关键列完整度门禁。", mode: "select", needsSecondSource: false },
  { id: "customer-dedup", name: "客户主键去重", description: "按选定业务键保留首条并证明输出唯一。", mode: "deduplicate", needsSecondSource: false },
  { id: "order-normalization", name: "订单字段整理", description: "选择、重排字段并约束关键字段允许值。", mode: "select", needsSecondSource: false },
  { id: "append-exports", name: "追加周期导出", description: "把列结构完全一致的下一期文件追加到当前对象。", mode: "append", needsSecondSource: true },
  { id: "reference-mapping", name: "参考数据映射检查", description: "验证业务键在参考对象中的覆盖率，并列出未匹配行号证据。", mode: "reference-check", needsSecondSource: true },
] as const;

export function dataCleanTemplateById(id: DataCleanTemplateId): DataCleanTemplate {
  const template = dataCleanTemplates.find((candidate) => candidate.id === id);
  if (!template) throw new Error("Unknown data-clean template");
  return template;
}
