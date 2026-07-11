const defaultMaxConcurrentAiRequests = 8;

type QueueItem<T> = {
  readonly run: () => Promise<T>;
  readonly reject: (reason: unknown) => void;
  readonly resolve: (value: T) => void;
};

let activeAiRequests = 0;
const queue: Array<() => void> = [];

const configuredConcurrency = (): number => {
  const raw = process.env["MAX_CONCURRENT_AI_REQUESTS"];
  if (raw === undefined) return defaultMaxConcurrentAiRequests;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultMaxConcurrentAiRequests;
};

const runNext = (): void => {
  if (activeAiRequests >= configuredConcurrency()) return;
  const runQueued = queue.shift();
  if (runQueued === undefined) return;
  activeAiRequests += 1;
  runQueued();
};

export const runWithAiConcurrency = async <T>(run: () => Promise<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    queue.push(() => {
      run().then(resolve, reject).finally(() => {
        activeAiRequests -= 1;
        runNext();
      });
    });
    runNext();
  });

export const resetAiConcurrencyForTests = (): void => {
  activeAiRequests = 0;
  queue.splice(0, queue.length);
};
