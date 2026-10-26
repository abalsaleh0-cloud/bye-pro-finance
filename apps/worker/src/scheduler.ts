export type WorkerCycle = () => Promise<void>;

export function validateWorkerInterval(intervalMs: number): number {
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 1000) {
    throw new RangeError("WORKER_INTERVAL_MS must be an integer of at least 1000 milliseconds");
  }
  return intervalMs;
}

/**
 * Runs cycles sequentially. The next timeout is scheduled only after the
 * previous cycle settles, so slow work cannot create overlapping cycles.
 */
export function startWorkerLoop(
  runCycle: WorkerCycle,
  intervalMs: number,
  onError: (error: unknown) => void = (error) => console.error("[worker] cycle failed", error),
): { stop: () => void } {
  const safeInterval = validateWorkerInterval(intervalMs);
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const tick = async (): Promise<void> => {
    if (stopped) return;
    try {
      await runCycle();
    } catch (error) {
      onError(error);
    } finally {
      if (!stopped) timer = setTimeout(() => void tick(), safeInterval);
    }
  };

  void tick();

  return {
    stop: () => {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
    },
  };
}
