// Default values for waits during the YTM view startup
// How long to wait for a startup step (for example the hook or the player API) before going on without it
export const DEFAULT_STARTUP_TIMEOUT_MS = 10_000;
// How long to wait for a font to load before going on without it
export const DEFAULT_FONT_TIMEOUT_MS = 3_000;
// Intervals for pollUntil: every 250ms for the first 10 seconds, then every 2 seconds
export const DEFAULT_POLL_INTERVALS = {
  fastIntervalMs: 250,
  fastWindowMs: 10_000,
  slowIntervalMs: 2_000
} as const;

/**
 * Waits for the given time, or until the signal is aborted, whichever comes first.
 * The timer is cleared when the signal is aborted.
 */
export type Sleep = (ms: number, signal?: AbortSignal) => Promise<void>;

export type PollIntervals = {
  // Interval between checks during the first fastWindowMs
  fastIntervalMs: number;
  // How long, from the start, checks run at fastIntervalMs
  fastWindowMs: number;
  // Interval between checks after fastWindowMs
  slowIntervalMs: number;
};

export type PollUntilOptions = PollIntervals & {
  // Stops the polling, which then resolves to false
  signal?: AbortSignal;
  // Returns the current time in milliseconds (Date.now by default)
  now?: () => number;
  // Waits between checks (setTimeout by default)
  sleep?: Sleep;
};

export type TimeoutResult<T> = { done: true; value: T } | { done: false };

export const sleep: Sleep = (ms, signal) =>
  new Promise(resolve => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });

function checkSafely(check: () => boolean): boolean {
  try {
    return check() === true;
  } catch {
    return false;
  }
}

/**
 * Calls check until it returns true, then resolves to true and calls it no more.
 * The first call is made at once. During the first fastWindowMs the calls are fastIntervalMs apart, then slowIntervalMs apart.
 * A check that throws counts as not yet true, and polling goes on.
 * Resolves to false once the signal is aborted, without calling check again.
 */
export async function pollUntil(check: () => boolean, options: PollUntilOptions): Promise<boolean> {
  const { fastIntervalMs, fastWindowMs, slowIntervalMs, signal, now = Date.now, sleep: wait = sleep } = options;
  const start = now();
  while (!signal?.aborted) {
    if (checkSafely(check)) return true;
    const elapsed = now() - start;
    await wait(elapsed < fastWindowMs ? fastIntervalMs : slowIntervalMs, signal);
  }
  return false;
}

/**
 * Resolves to { done: true, value } when the promise settles first with a value, or to { done: false } when timeoutMs passes first.
 * A rejection of the promise before the deadline is passed on. The deadline timer is cleared once either one settles.
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<TimeoutResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<TimeoutResult<T>>(resolve => {
    timer = setTimeout(() => resolve({ done: false }), timeoutMs);
  });
  const finished = promise.then((value): TimeoutResult<T> => ({ done: true, value }));
  return Promise.race([finished, deadline]).finally(() => clearTimeout(timer));
}
