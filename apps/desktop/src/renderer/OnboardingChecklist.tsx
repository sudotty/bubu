import { useEffect, useState } from "react";
import { recommendFirstTask, type RecommendedFirstTask } from "@bubu/product-core";
import type { DatasetGroup, DatasetSummary } from "../shared/product-api.js";
import { onboardingCompletionKey, onboardingResetEvent } from "./onboarding-preferences.js";

export function OnboardingChecklist({ datasets, groups, onAction, onPrivacy }: {
  readonly datasets: readonly DatasetSummary[];
  readonly groups: readonly DatasetGroup[];
  readonly onAction: (kind: RecommendedFirstTask["kind"]) => void;
  readonly onPrivacy: () => void;
}) {
  const [recommendation, setRecommendation] = useState<RecommendedFirstTask>();
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [completed, setCompleted] = useState(() => window.localStorage.getItem(onboardingCompletionKey) === "completed");

  useEffect(() => {
    const reset = () => setCompleted(false);
    window.addEventListener(onboardingResetEvent, reset);
    return () => window.removeEventListener(onboardingResetEvent, reset);
  }, []);

  useEffect(() => {
    let active = true;
    setLoadError(false);
    setRecommendation(undefined);
    const topicDatasetIds = new Set(groups.flatMap(({ members }) => members.map(({ id }) => id)));
    void Promise.all(datasets.map(async ({ id, sourceName }) => {
      const structure = await window.bubu.datasets.structure(id);
      return {
        id,
        sourceName,
        reconciliationContext: topicDatasetIds.has(id),
        columns: structure.columns.map(({ name, inferredType, nullCount }) => ({ name, type: inferredType, nullCount })),
      };
    })).then((snapshots) => { if (active) setRecommendation(recommendFirstTask(snapshots)); })
      .catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [datasets, groups, retry]);

  if (completed || datasets.length === 0) return null;
  return <section className="onboarding-checklist" aria-labelledby="onboarding-title">
    <header><div><p className="hero-kicker">第一次使用</p><h3 id="onboarding-title">用真实结构决定第一步</h3></div><button type="button" className="quiet-action" onClick={() => { window.localStorage.setItem(onboardingCompletionKey, "completed"); setCompleted(true); }}>暂时隐藏</button></header>
    <div className="onboarding-summary">
      <span className="onboarding-local-proof">数据留在本机 · {datasets.length} 个版本化对象已就绪</span>
      <div className="onboarding-recommendation"><strong>{loadError ? "暂时无法读取结构" : recommendation?.title ?? "正在读取列结构…"}</strong><small>{loadError ? "现有数据仍然安全可用。重试只读取列名、类型和空值计数。" : recommendation?.reason ?? "只读取列名、类型和空值计数，不读取任何数据行。"}</small></div>
      <div className="onboarding-actions">{loadError ? <button type="button" className="secondary-action" onClick={() => setRetry((value) => value + 1)}>重试读取</button> : recommendation && <button type="button" className="primary-action" onClick={() => onAction(recommendation.kind)}>{recommendation.actionLabel}</button>}<button type="button" className="secondary-action" onClick={onPrivacy}>隐私与恢复</button></div>
    </div>
  </section>;
}
