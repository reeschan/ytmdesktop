export const GROOVING_PACE_GAP_MIN_MS = 800;
export const GROOVING_PACE_GAP_MAX_MS = 2000;
export const GROOVING_PACE_WINDOW_MS = 60_000;
export const GROOVING_PACE_WINDOW_LIMIT = 20;
export const GROOVING_PACE_BACKGROUND_RESERVE = 12;
export const GROOVING_PACE_TASK_HOLD_MAX_MS = 15_000;
export const GROOVING_YTM_CACHE_TTL_MS = 10 * 60_000;

export const GroovingPacePriority = { User: "user", Background: "background" } as const;
export type GroovingPacePriority = (typeof GroovingPacePriority)[keyof typeof GroovingPacePriority];
export type GroovingPaceClock = {
  now(): number;
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
  random(): number;
};

const aborted = () => new DOMException("Aborted", "AbortError");
export const groovingPaceRealClock: GroovingPaceClock = {
  now: () => performance.now(),
  random: () => Math.random(),
  sleep: (ms, signal) =>
    new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(aborted());
        return;
      }
      const onAbort = () => {
        clearTimeout(timer);
        reject(aborted());
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      signal?.addEventListener("abort", onAbort, { once: true });
    })
};

export type GroovingPacer = {
  /** Wrap one fetch. Tasks must settle, and must not call run themselves. */
  run<T>(priority: GroovingPacePriority, task: () => Promise<T>, signal?: AbortSignal): Promise<T>;
};

type Waiter = { start: () => void; cancel: () => void };
export function createGroovingPacer(clock: GroovingPaceClock = groovingPaceRealClock): GroovingPacer {
  const queues: Record<GroovingPacePriority, Waiter[]> = { user: [], background: [] };
  const starts: number[] = [];
  let nextAt = -Infinity;
  let busy = false;
  let pumping = false;
  let wake: AbortController | undefined;

  const kick = () => {
    wake?.abort();
    void pump();
  };
  async function pump(): Promise<void> {
    if (pumping) return;
    pumping = true;
    try {
      while (!busy && (queues.user.length || queues.background.length)) {
        const now = clock.now();
        while (starts.length && starts[0] + GROOVING_PACE_WINDOW_MS <= now) starts.shift();
        const priority = queues.user.length ? GroovingPacePriority.User : GroovingPacePriority.Background;
        const limit =
          priority === GroovingPacePriority.User ? GROOVING_PACE_WINDOW_LIMIT : GROOVING_PACE_WINDOW_LIMIT - GROOVING_PACE_BACKGROUND_RESERVE;
        const freeAt = starts.length < limit ? -Infinity : starts[starts.length - limit] + GROOVING_PACE_WINDOW_MS;
        const at = Math.max(nextAt, freeAt);
        if (at > now) {
          wake = new AbortController();
          try {
            await clock.sleep(at - now, wake.signal);
          } catch {
            /* Recalculate on queue changes. */
          }
          wake = undefined;
          continue;
        }
        const waiter = queues[priority].shift()!;
        starts.push(now);
        nextAt = now + GROOVING_PACE_GAP_MIN_MS + clock.random() * (GROOVING_PACE_GAP_MAX_MS - GROOVING_PACE_GAP_MIN_MS);
        busy = true;
        waiter.start();
      }
    } finally {
      pumping = false;
    }
  }

  return {
    run<T>(priority: GroovingPacePriority, task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
      if (signal?.aborted) return Promise.reject(aborted());
      return new Promise<T>((resolve, reject) => {
        const onAbort = () => {
          waiter.cancel();
          reject(aborted());
          kick();
        };
        const waiter: Waiter = {
          cancel: () => {
            const index = queues[priority].indexOf(waiter);
            if (index >= 0) queues[priority].splice(index, 1);
            signal?.removeEventListener("abort", onAbort);
          },
          start: () => {
            signal?.removeEventListener("abort", onAbort);
            const hold = new AbortController();
            let released = false;
            const release = () => {
              if (released) return;
              released = true;
              hold.abort();
              busy = false;
              kick();
            };
            void clock.sleep(GROOVING_PACE_TASK_HOLD_MAX_MS, hold.signal).then(release, () => {});
            void Promise.resolve().then(task).then(resolve, reject).finally(release);
          }
        };
        signal?.addEventListener("abort", onAbort, { once: true });
        queues[priority].push(waiter);
        kick();
      });
    }
  };
}

export type GroovingCache<T> = { get(key: string): T | undefined; set(key: string, value: T, ttlMs: number | null): void };
export function createGroovingCache<T>(clock: GroovingPaceClock = groovingPaceRealClock): GroovingCache<T> {
  const entries = new Map<string, { value: T; expires: number | null }>();
  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.expires !== null && entry.expires <= clock.now()) {
        entries.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key, value, ttlMs) {
      const now = clock.now();
      for (const [oldKey, entry] of entries) if (entry.expires !== null && entry.expires <= now) entries.delete(oldKey);
      entries.set(key, { value, expires: ttlMs === null ? null : now + ttlMs });
    }
  };
}

export type GroovingCallWindow = { take(): boolean };
// A sliding window: take() lets a call through while fewer than limit went through in the last windowMs. A refused take is not counted
export function createGroovingCallWindow(
  limit: number,
  windowMs: number,
  clock: Pick<GroovingPaceClock, "now"> = groovingPaceRealClock
): GroovingCallWindow {
  const starts: number[] = [];
  return {
    take() {
      const now = clock.now();
      while (starts.length && starts[0] + windowMs <= now) starts.shift();
      if (starts.length >= limit) return false;
      starts.push(now);
      return true;
    }
  };
}
