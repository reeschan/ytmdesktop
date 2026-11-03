/**
 * The minimal shape of an event source that can be waited on (for example a Node `EventEmitter`
 * or an `EventEmitterService`).
 */
export interface WaitableEventSource<E extends string> {
  on(event: E, listener: () => void): unknown;
  off(event: E, listener: () => void): unknown;
}

export interface WaitForFirstEventOptions<R, S extends string = never> {
  /** How long to wait for one of the events, in milliseconds */
  timeoutMs: number;
  /** The value to resolve with when no event arrives within `timeoutMs` */
  timeoutResult: R;
  /**
   * Events that clear the time limit without resolving (for example an event that tells a longer
   * step has started). Once one of them arrives, the wait goes on until one of the mapped events arrives.
   */
  clearTimeoutOn?: readonly S[];
}

/**
 * Waits for the first of several events and resolves with the value mapped to it.
 *
 * Resolves with `options.timeoutResult` when none of the events arrive within `options.timeoutMs`,
 * unless one of the events in `options.clearTimeoutOn` arrives first, which clears the time limit.
 * Either way, every listener added to `source` and the timer are removed before resolving, so later
 * events or timeouts do not change the result.
 *
 * @param source The event source to listen on
 * @param results The value to resolve with for each event name
 * @param options The time limit, the value to resolve with when it passes, and the events that clear it
 * @returns The value of the first event, or `options.timeoutResult` when the time limit passes
 */
export function waitForFirstEvent<E extends string, R, S extends string = never>(
  source: WaitableEventSource<E | S>,
  results: Readonly<Record<E, R>>,
  options: WaitForFirstEventOptions<R, S>
): Promise<R> {
  return new Promise<R>(resolve => {
    const events = Object.keys(results) as E[];
    const listeners = new Map<E, () => void>();
    const clearListeners = new Map<S, () => void>();
    let settled = false;

    const removeClearListeners = () => {
      for (const [event, listener] of clearListeners) source.off(event, listener);
      clearListeners.clear();
    };

    const finish = (result: R) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      for (const [event, listener] of listeners) source.off(event, listener);
      listeners.clear();
      removeClearListeners();
      resolve(result);
    };

    const timer = setTimeout(() => finish(options.timeoutResult), options.timeoutMs);

    for (const event of events) {
      const listener = () => finish(results[event]);
      listeners.set(event, listener);
      source.on(event, listener);
    }

    for (const event of options.clearTimeoutOn ?? []) {
      if (clearListeners.has(event)) continue;
      const listener = () => {
        if (settled) return;
        clearTimeout(timer);
        removeClearListeners();
      };
      clearListeners.set(event, listener);
      source.on(event, listener);
    }
  });
}
