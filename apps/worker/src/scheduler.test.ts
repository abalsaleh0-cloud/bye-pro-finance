import { afterEach, describe, expect, it, vi } from "vitest";
import { startWorkerLoop, validateWorkerInterval } from "./scheduler.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("worker scheduler", () => {
  it("rejects unsafe or excessively frequent intervals", () => {
    expect(() => validateWorkerInterval(0)).toThrow(RangeError);
    expect(() => validateWorkerInterval(999)).toThrow(RangeError);
    expect(() => validateWorkerInterval(1000.5)).toThrow(RangeError);
    expect(validateWorkerInterval(60_000)).toBe(60_000);
  });

  it("waits for a cycle to finish before scheduling the next one", async () => {
    vi.useFakeTimers();
    let finishFirst!: () => void;
    const runCycle = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finishFirst = resolve; }))
      .mockResolvedValue(undefined);
    const loop = startWorkerLoop(runCycle, 1000);

    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(5000);
    expect(runCycle).toHaveBeenCalledTimes(1);

    finishFirst();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(runCycle).toHaveBeenCalledTimes(2);
    loop.stop();
  });

  it("stops future cycles and clears a pending timeout", async () => {
    vi.useFakeTimers();
    const runCycle = vi.fn().mockResolvedValue(undefined);
    const loop = startWorkerLoop(runCycle, 1000);
    await vi.advanceTimersByTimeAsync(0);
    expect(runCycle).toHaveBeenCalledTimes(1);

    loop.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(runCycle).toHaveBeenCalledTimes(1);
  });

  it("continues scheduling after a cycle rejects and reports the error", async () => {
    vi.useFakeTimers();
    const failure = new Error("cycle failure");
    const onError = vi.fn();
    const runCycle = vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(undefined);
    const loop = startWorkerLoop(runCycle, 1000, onError);
    await vi.advanceTimersByTimeAsync(0);
    expect(onError).toHaveBeenCalledWith(failure);
    await vi.advanceTimersByTimeAsync(1000);
    expect(runCycle).toHaveBeenCalledTimes(2);
    loop.stop();
  });
});
