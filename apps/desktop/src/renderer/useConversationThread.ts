import { useEffect, useState } from "react";
import type { ConversationThread, WorkflowTarget } from "../shared/product-api.js";
import { AUTOMATION_POLL_INTERVAL_MILLISECONDS } from "../shared/automation.js";

export function useConversationThread(target: WorkflowTarget, threadId?: string): ConversationThread | null | undefined {
  const [thread, setThread] = useState<ConversationThread | null>();

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let hasLoaded = false;

    async function load(): Promise<void> {
      if (inFlight) return;
      inFlight = true;
      try {
        const next = threadId ? await window.bubu.conversations.getById(threadId) : await window.bubu.conversations.get(target);
        if (active) {
          setThread(next);
          hasLoaded = true;
        }
      } catch {
        if (active && !hasLoaded) setThread(null);
      } finally {
        inFlight = false;
      }
    }

    setThread(undefined);
    void load();
    const timer = window.setInterval(() => { void load(); }, AUTOMATION_POLL_INTERVAL_MILLISECONDS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [target.id, target.kind, threadId]);

  return thread;
}
