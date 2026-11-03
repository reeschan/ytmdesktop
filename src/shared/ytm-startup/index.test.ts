import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_FONT_TIMEOUT_MS,
  DEFAULT_POLL_INTERVALS,
  DEFAULT_STARTUP_TIMEOUT_MS,
  pollUntil,
  sleep,
  Sleep,
  TimeoutResult,
  withTimeout
} from "~shared/ytm-startup";

const INTERVALS = { fastIntervalMs: 250, fastWindowMs: 10_000, slowIntervalMs: 2_000 };

/**
 * Tracks whether the promise has settled and with what, so a test can look at it between timer steps
 */
function track<T>(promise: Promise<T>) {
  const state: { settled: boolean; value?: T; error?: unknown } = { settled: false };
  promise.then(
    value => {
      state.settled = true;
      state.value = value;
    },
    (error: unknown) => {
      state.settled = true;
      state.error = error;
    }
  );
  return state;
}

describe("defaults", () => {
  it("waits 10 seconds for a startup step and 3 seconds for a font", () => {
    expect(DEFAULT_STARTUP_TIMEOUT_MS).toBe(10_000);
    expect(DEFAULT_FONT_TIMEOUT_MS).toBe(3_000);
  });

  it("polls every 250ms for 10 seconds, then every 2 seconds", () => {
    expect(DEFAULT_POLL_INTERVALS).toEqual(INTERVALS);
  });
});

describe("pollUntil", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("checks at the fast interval during the fast window and at the slow interval after it", async () => {
    const calls: number[] = [];
    const controller = new AbortController();
    const result = track(
      pollUntil(
        () => {
          calls.push(Date.now());
          return false;
        },
        { ...INTERVALS, signal: controller.signal }
      )
    );

    await vi.advanceTimersByTimeAsync(16_000);

    const fast = Array.from({ length: 41 }, (_, i) => i * 250);
    expect(calls).toEqual([...fast, 12_000, 14_000, 16_000]);
    expect(result.settled).toBe(false);
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);
  });

  it("resolves to true once the check returns true and calls it no more", async () => {
    let count = 0;
    const check = vi.fn(() => ++count === 3);
    const result = track(pollUntil(check, INTERVALS));

    await vi.advanceTimersByTimeAsync(500);
    expect(result).toEqual({ settled: true, value: true });
    expect(check).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(check).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("resolves to true at once when the first check returns true", async () => {
    const check = vi.fn(() => true);
    await expect(pollUntil(check, INTERVALS)).resolves.toBe(true);
    expect(check).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("goes on polling when the check throws", async () => {
    let count = 0;
    const check = vi.fn(() => {
      count++;
      if (count <= 2) throw new Error("not ready");
      return count === 4;
    });
    const result = track(pollUntil(check, INTERVALS));

    await vi.advanceTimersByTimeAsync(750);
    expect(result).toEqual({ settled: true, value: true });
    expect(check).toHaveBeenCalledTimes(4);
  });

  it("resolves to false when the signal is aborted while waiting, and calls the check no more", async () => {
    const controller = new AbortController();
    const check = vi.fn(() => false);
    const result = track(pollUntil(check, { ...INTERVALS, signal: controller.signal }));

    await vi.advanceTimersByTimeAsync(600);
    expect(check).toHaveBeenCalledTimes(3);

    controller.abort();
    await vi.advanceTimersByTimeAsync(0);
    expect(result).toEqual({ settled: true, value: false });
    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(check).toHaveBeenCalledTimes(3);
  });

  it("resolves to false without checking when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const check = vi.fn(() => true);

    await expect(pollUntil(check, { ...INTERVALS, signal: controller.signal })).resolves.toBe(false);
    expect(check).not.toHaveBeenCalled();
  });

  it("uses the given clock and sleep", async () => {
    vi.useRealTimers();
    let time = 1_000;
    const waits: number[] = [];
    const fakeSleep: Sleep = async ms => {
      waits.push(ms);
      time += ms;
    };
    const check = vi.fn(() => time >= 1_000 + 1_500);

    await expect(
      pollUntil(check, { fastIntervalMs: 100, fastWindowMs: 300, slowIntervalMs: 400, now: () => time, sleep: fakeSleep })
    ).resolves.toBe(true);
    expect(waits).toEqual([100, 100, 100, 400, 400, 400]);
    expect(check).toHaveBeenCalledTimes(7);
  });
});

describe("sleep", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves after the given time", async () => {
    const result = track(sleep(1_000));
    await vi.advanceTimersByTimeAsync(999);
    expect(result.settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(result.settled).toBe(true);
  });

  it("resolves early and clears its timer when the signal is aborted", async () => {
    const controller = new AbortController();
    const result = track(sleep(1_000, controller.signal));
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);
    expect(result.settled).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("withTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves to done and the value when the promise settles first, and clears the deadline timer", async () => {
    const promise = new Promise<string>(resolve => setTimeout(() => resolve("value"), 100));
    const result = track(withTimeout(promise, 1_000));

    await vi.advanceTimersByTimeAsync(100);
    expect(result).toEqual({ settled: true, value: { done: true, value: "value" } satisfies TimeoutResult<string> });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("resolves to not done when the deadline comes first", async () => {
    const promise = new Promise<string>(() => {});
    const result = track(withTimeout(promise, 1_000));

    await vi.advanceTimersByTimeAsync(999);
    expect(result.settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(result).toEqual({ settled: true, value: { done: false } satisfies TimeoutResult<string> });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("passes on a rejection that comes before the deadline and clears the deadline timer", async () => {
    const error = new Error("failed");
    const result = track(withTimeout(Promise.reject(error), 1_000));

    await vi.advanceTimersByTimeAsync(0);
    expect(result).toEqual({ settled: true, error });
    expect(vi.getTimerCount()).toBe(0);
  });
});
