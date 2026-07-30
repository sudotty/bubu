import { taskStartersFor, type TaskStarterKind } from "@bubu/product-core";

export function TaskStarters({ kind, onSelect }: { readonly kind: TaskStarterKind; readonly onSelect: (question: string) => void }) {
  return <section className="task-starters" aria-label="分析任务起点">
    <header><strong>从一个明确任务开始</strong><small>选择后仍可编辑，发送前不会调用模型</small></header>
    <div>
      {taskStartersFor(kind).map((starter) => <button type="button" key={starter.id} onClick={() => onSelect(starter.question)}>
        <strong>{starter.label}</strong>
        <small>{starter.description}</small>
      </button>)}
    </div>
  </section>;
}
