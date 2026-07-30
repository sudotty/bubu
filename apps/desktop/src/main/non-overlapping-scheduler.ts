interface Options {
  readonly intervalMilliseconds: number;
  readonly task: () => Promise<unknown>;
  readonly canRun?: (() => boolean) | undefined;
  readonly onError?: ((error: unknown) => void) | undefined;
  readonly unref?: boolean;
}

/** Shared lifecycle adapter; domain work remains a separately testable async function. */
export function startNonOverlappingScheduler(options: Options): () => void {
  if (!Number.isSafeInteger(options.intervalMilliseconds) || options.intervalMilliseconds <= 0) throw new Error("Scheduler interval must be a positive integer");
  let active = true;
  let running = false;
  const tick = async () => {
    if (!active || running || options.canRun?.() === false) return;
    running = true;
    try { await options.task(); }
    catch (error) { options.onError?.(error); }
    finally { running = false; }
  };
  void tick();
  const timer = setInterval(() => { void tick(); }, options.intervalMilliseconds);
  if (options.unref) timer.unref();
  return () => { active = false; clearInterval(timer); };
}
