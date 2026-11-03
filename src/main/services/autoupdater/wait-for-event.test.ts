import EventEmitter from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitForFirstEvent } from "./wait-for-event";

type Outcome = { value: string; timedOut: boolean };

const EVENTS = ["done", "failed"] as const;

const RESULTS: Record<(typeof EVENTS)[number], Outcome> = {
  done: { value: "done", timedOut: false },
  failed: { value: "failed", timedOut: false }
};

const TIMEOUT_MS = 1000;
const TIMEOUT_RESULT: Outcome = { value: "timeout", timedOut: true };

function totalListeners(emitter: EventEmitter) {
  return EVENTS.reduce((sum, event) => sum + emitter.listenerCount(event), 0);
}

describe("waitForFirstEvent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with the value mapped to the first event that arrives", async () => {
    const emitter = new EventEmitter();
    const promise = waitForFirstEvent(emitter, RESULTS, { timeoutMs: TIMEOUT_MS, timeoutResult: TIMEOUT_RESULT });

    emitter.emit("failed");

    await expect(promise).resolves.toEqual(RESULTS.failed);
  });

  it("resolves with the timeout value when no event arrives within the limit", async () => {
    const emitter = new EventEmitter();
    const promise = waitForFirstEvent(emitter, RESULTS, { timeoutMs: TIMEOUT_MS, timeoutResult: TIMEOUT_RESULT });

    vi.advanceTimersByTime(TIMEOUT_MS);

    await expect(promise).resolves.toEqual(TIMEOUT_RESULT);
  });

  it("does not resolve before the limit passes", async () => {
    const emitter = new EventEmitter();
    let resolved = false;
    void waitForFirstEvent(emitter, RESULTS, { timeoutMs: TIMEOUT_MS, timeoutResult: TIMEOUT_RESULT }).then(() => {
      resolved = true;
    });

    vi.advanceTimersByTime(TIMEOUT_MS - 1);
    await Promise.resolve();

    expect(resolved).toBe(false);
  });

  it("adds a listener for every mapped event while waiting", () => {
    const emitter = new EventEmitter();
    void waitForFirstEvent(emitter, RESULTS, { timeoutMs: TIMEOUT_MS, timeoutResult: TIMEOUT_RESULT });

    for (const event of EVENTS) expect(emitter.listenerCount(event)).toBe(1);
  });

  it("removes every listener and the timer after an event arrives", async () => {
    const emitter = new EventEmitter();
    const promise = waitForFirstEvent(emitter, RESULTS, { timeoutMs: TIMEOUT_MS, timeoutResult: TIMEOUT_RESULT });

    emitter.emit("done");
    await promise;

    expect(totalListeners(emitter)).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("removes every listener and the timer after the limit passes", async () => {
    const emitter = new EventEmitter();
    const promise = waitForFirstEvent(emitter, RESULTS, { timeoutMs: TIMEOUT_MS, timeoutResult: TIMEOUT_RESULT });

    vi.advanceTimersByTime(TIMEOUT_MS);
    await promise;

    expect(totalListeners(emitter)).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps the first event's value when other events or the limit come later", async () => {
    const emitter = new EventEmitter();
    const promise = waitForFirstEvent(emitter, RESULTS, { timeoutMs: TIMEOUT_MS, timeoutResult: TIMEOUT_RESULT });

    emitter.emit("done");
    emitter.emit("failed");
    vi.advanceTimersByTime(TIMEOUT_MS);

    await expect(promise).resolves.toEqual(RESULTS.done);
  });

  it("keeps the timeout value when events come after the limit", async () => {
    const emitter = new EventEmitter();
    const promise = waitForFirstEvent(emitter, RESULTS, { timeoutMs: TIMEOUT_MS, timeoutResult: TIMEOUT_RESULT });

    vi.advanceTimersByTime(TIMEOUT_MS);
    emitter.emit("done");

    await expect(promise).resolves.toEqual(TIMEOUT_RESULT);
  });

  describe("with events that clear the time limit", () => {
    const CLEAR_EVENTS = ["started"] as const;
    const OPTIONS = { timeoutMs: TIMEOUT_MS, timeoutResult: TIMEOUT_RESULT, clearTimeoutOn: CLEAR_EVENTS };

    it("does not time out once a clearing event arrives before the limit", async () => {
      const emitter = new EventEmitter();
      let resolved = false;
      const promise = waitForFirstEvent(emitter, RESULTS, OPTIONS);
      void promise.then(() => {
        resolved = true;
      });

      await vi.advanceTimersByTimeAsync(TIMEOUT_MS / 2);
      emitter.emit("started");
      await vi.advanceTimersByTimeAsync(TIMEOUT_MS * 30);

      expect(resolved).toBe(false);

      emitter.emit("done");

      await expect(promise).resolves.toEqual(RESULTS.done);
    });

    it("still times out when no event arrives within the limit", async () => {
      const emitter = new EventEmitter();
      const promise = waitForFirstEvent(emitter, RESULTS, OPTIONS);

      await vi.advanceTimersByTimeAsync(TIMEOUT_MS);

      await expect(promise).resolves.toEqual(TIMEOUT_RESULT);
    });

    it("keeps the timeout value when a clearing event comes after the limit", async () => {
      const emitter = new EventEmitter();
      const promise = waitForFirstEvent(emitter, RESULTS, OPTIONS);

      await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
      emitter.emit("started");
      emitter.emit("done");

      await expect(promise).resolves.toEqual(TIMEOUT_RESULT);
    });

    it("removes every listener and the timer after a clearing event and then a mapped event", async () => {
      const emitter = new EventEmitter();
      const promise = waitForFirstEvent(emitter, RESULTS, OPTIONS);

      expect(emitter.listenerCount("started")).toBe(1);

      emitter.emit("started");

      expect(vi.getTimerCount()).toBe(0);
      expect(emitter.listenerCount("started")).toBe(0);

      emitter.emit("failed");
      await promise;

      expect(totalListeners(emitter)).toBe(0);
    });

    it("removes the clearing listeners when the limit passes", async () => {
      const emitter = new EventEmitter();
      const promise = waitForFirstEvent(emitter, RESULTS, OPTIONS);

      vi.advanceTimersByTime(TIMEOUT_MS);
      await promise;

      expect(totalListeners(emitter) + emitter.listenerCount("started")).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
