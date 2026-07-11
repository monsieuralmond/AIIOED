import { afterEach, describe, expect, it } from "vitest";
import { resetAiConcurrencyForTests, runWithAiConcurrency } from "./ai-concurrency.js";

const originalMaxConcurrentAiRequests = process.env["MAX_CONCURRENT_AI_REQUESTS"];

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

type DeferredCall = {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
};

const deferredCall = (): DeferredCall => {
  let resolveCall: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    resolveCall = resolve;
  });
  if (resolveCall === undefined) throw new Error("Deferred call was not initialized.");
  return { promise, resolve: resolveCall };
};

const waitForStartedCount = async (started: readonly DeferredCall[], count: number): Promise<void> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (started.length >= count) return;
    await flushMicrotasks();
  }
  throw new Error(`Expected ${count} AI requests to start.`);
};

describe("AI concurrency queue", () => {
  afterEach(() => {
    resetAiConcurrencyForTests();
    if (originalMaxConcurrentAiRequests === undefined) delete process.env["MAX_CONCURRENT_AI_REQUESTS"];
    else process.env["MAX_CONCURRENT_AI_REQUESTS"] = originalMaxConcurrentAiRequests;
  });

  it("queues provider calls beyond the configured concurrency", async () => {
    process.env["MAX_CONCURRENT_AI_REQUESTS"] = "2";
    let active = 0;
    let maxActive = 0;
    const started: DeferredCall[] = [];

    const calls = Array.from({ length: 5 }, async (_, index) =>
      runWithAiConcurrency(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        const call = deferredCall();
        started.push(call);
        await call.promise;
        active -= 1;
        return index;
      })
    );

    await waitForStartedCount(started, 2);
    expect(started).toHaveLength(2);
    for (const call of started) call.resolve();
    await waitForStartedCount(started, 4);
    expect(started).toHaveLength(4);
    for (const call of started.slice(2)) call.resolve();
    await waitForStartedCount(started, 5);
    const lastCall = started[4];
    if (lastCall === undefined) throw new Error("final AI request did not start.");
    lastCall.resolve();
    await expect(Promise.all(calls)).resolves.toEqual([0, 1, 2, 3, 4]);
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});
