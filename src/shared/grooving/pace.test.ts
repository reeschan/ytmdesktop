import { describe, expect, it } from "vitest";
import { createGroovingCache, createGroovingCallWindow, createGroovingPacer, GROOVING_PACE_TASK_HOLD_MAX_MS, type GroovingPaceClock } from "./pace";

class FakeClock implements GroovingPaceClock {
  time = 0;
  value = 0;
  sleepers: { at: number; resolve: () => void; reject: (error: unknown) => void; signal?: AbortSignal; abort: () => void }[] = [];
  now = () => this.time;
  random = () => this.value;
  sleep = (ms: number, signal?: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
      const entry = { at: this.time + ms, resolve, reject, signal, abort: () => {} };
      entry.abort = () => {
        this.sleepers = this.sleepers.filter(s => s !== entry);
        reject(new DOMException("Aborted", "AbortError"));
      };
      if (signal?.aborted) return entry.abort();
      signal?.addEventListener("abort", entry.abort, { once: true });
      this.sleepers.push(entry);
    });
  async flush() {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  }
  async advance(ms: number) {
    const end = this.time + ms;
    await this.flush();
    while (true) {
      const next = this.sleepers.filter(s => s.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!next) break;
      this.time = next.at;
      this.sleepers = this.sleepers.filter(s => s !== next);
      next.signal?.removeEventListener("abort", next.abort);
      next.resolve();
      await this.flush();
    }
    this.time = end;
    await this.flush();
  }
}

describe("grooving pacer", () => {
  it("waits for completion and the start gap, but not after a long task", async () => {
    const clock = new FakeClock();
    const pacer = createGroovingPacer(clock);
    const starts: number[] = [];
    let finish!: () => void;
    const first = pacer.run("user", () => {
      starts.push(clock.now());
      return new Promise<void>(r => {
        finish = r;
      });
    });
    const second = pacer.run("user", async () => {
      starts.push(clock.now());
    });
    await clock.advance(3000);
    expect(starts).toEqual([0]);
    finish();
    await clock.flush();
    await Promise.all([first, second]);
    expect(starts).toEqual([0, 3000]);
    const third = pacer.run("user", async () => {
      starts.push(clock.now());
    });
    await clock.advance(799);
    expect(starts).toHaveLength(2);
    await clock.advance(1);
    await third;
    expect(starts[2]).toBe(3800);
  });
  it("draws the gap once per start", async () => {
    const clock = new FakeClock();
    clock.value = 0.999;
    const pacer = createGroovingPacer(clock);
    const starts: number[] = [];
    await pacer.run("user", async () => {
      starts.push(clock.now());
    });
    const next = pacer.run("user", async () => {
      starts.push(clock.now());
    });
    await clock.advance(1998);
    expect(starts).toHaveLength(1);
    await clock.advance(1);
    await next;
    expect(starts[1]).toBeGreaterThanOrEqual(1998.8);
  });
  it("limits 21 starts in a window", async () => {
    const clock = new FakeClock();
    const pacer = createGroovingPacer(clock);
    const starts: number[] = [];
    const tasks = Array.from({ length: 21 }, () =>
      pacer.run("user", async () => {
        starts.push(clock.now());
      })
    );
    await clock.advance(59_999);
    expect(starts).toHaveLength(20);
    await clock.advance(1);
    await Promise.all(tasks);
    expect(starts[20]).toBe(60_000);
  });
  it("reserves capacity for users and wakes background when the window opens", async () => {
    const clock = new FakeClock();
    const pacer = createGroovingPacer(clock);
    const order: string[] = [];
    const jobs = Array.from({ length: 8 }, (_, i) =>
      pacer.run("user", async () => {
        order.push(String(i));
      })
    );
    await clock.advance(5600);
    await Promise.all(jobs);
    expect(order).toHaveLength(8);
    const bg = pacer.run("background", async () => {
      order.push("bg");
    });
    const user = pacer.run("user", async () => {
      order.push("user");
    });
    await clock.advance(800);
    await user;
    expect(order.at(-1)).toBe("user");
    expect(order).not.toContain("bg");
    await clock.advance(54_400);
    await bg;
    expect(order.at(-1)).toBe("bg");
    const c2 = new FakeClock();
    const p2 = createGroovingPacer(c2);
    let started = false;
    const seven = Array.from({ length: 7 }, () => p2.run("user", async () => {}));
    await c2.advance(4800);
    await Promise.all(seven);
    const allowed = p2.run("background", async () => {
      started = true;
    });
    await c2.advance(800);
    await allowed;
    expect(started).toBe(true);
  });
  it("releases a stuck task after the hold limit", async () => {
    const clock = new FakeClock();
    const pacer = createGroovingPacer(clock);
    let finish!: () => void;
    let started = false;
    const stuck = pacer.run(
      "user",
      () =>
        new Promise<void>(r => {
          finish = r;
        })
    );
    const next = pacer.run("user", async () => {
      started = true;
    });
    await clock.advance(GROOVING_PACE_TASK_HOLD_MAX_MS - 1);
    expect(started).toBe(false);
    await clock.advance(1);
    await next;
    expect(started).toBe(true);
    finish();
    await stuck;
  });
  it("honors FIFO, cancellation, synchronous throws and rejected tasks", async () => {
    const clock = new FakeClock();
    const pacer = createGroovingPacer(clock);
    const order: string[] = [];
    const stopped = new AbortController();
    stopped.abort();
    await expect(pacer.run("user", async () => {}, stopped.signal)).rejects.toMatchObject({ name: "AbortError" });
    const broken = pacer.run("user", () => {
      throw new Error("sync");
    });
    const brokenCheck = expect(broken).rejects.toThrow("sync");
    const controller = new AbortController();
    const cancelled = pacer.run(
      "user",
      async () => {
        order.push("cancelled");
      },
      controller.signal
    );
    const cancelledCheck = expect(cancelled).rejects.toMatchObject({ name: "AbortError" });
    const one = pacer.run("user", async () => {
      order.push("one");
      throw new Error("async");
    });
    const oneCheck = expect(one).rejects.toThrow("async");
    const two = pacer.run("user", async () => {
      order.push("two");
    });
    controller.abort();
    await clock.advance(1600);
    await Promise.all([brokenCheck, cancelledCheck, oneCheck, two]);
    expect(order).toEqual(["one", "two"]);
  });
});

describe("grooving cache", () => {
  it("expires at the TTL and keeps entries without expiry", async () => {
    const clock = new FakeClock();
    const cache = createGroovingCache<string>(clock);
    cache.set("short", "a", 100);
    cache.set("forever", "b", null);
    cache.set("zero", "c", 0);
    expect(cache.get("zero")).toBeUndefined();
    await clock.advance(99);
    expect(cache.get("short")).toBe("a");
    await clock.advance(1);
    expect(cache.get("short")).toBeUndefined();
    await clock.advance(1_000_000);
    expect(cache.get("forever")).toBe("b");
  });
});

describe("grooving call window", () => {
  it("lets limit calls through and refuses the next", () => {
    const clock = new FakeClock();
    const window = createGroovingCallWindow(3, 1000, clock);
    expect([window.take(), window.take(), window.take()]).toEqual([true, true, true]);
    expect(window.take()).toBe(false);
  });

  it("frees one place when the oldest call leaves the window", () => {
    const clock = new FakeClock();
    const window = createGroovingCallWindow(3, 1000, clock);
    for (const time of [0, 1, 2]) {
      clock.time = time;
      expect(window.take()).toBe(true);
    }
    clock.time = 999;
    expect(window.take()).toBe(false);
    clock.time = 1000;
    expect(window.take()).toBe(true);
    expect(window.take()).toBe(false);
  });

  it("does not count a refused take", () => {
    const clock = new FakeClock();
    const window = createGroovingCallWindow(2, 1000, clock);
    expect([window.take(), window.take()]).toEqual([true, true]);
    clock.time = 500;
    expect([window.take(), window.take()]).toEqual([false, false]);
    clock.time = 1000;
    expect([window.take(), window.take()]).toEqual([true, true]);
    expect(window.take()).toBe(false);
  });

  it("is free again exactly windowMs later", () => {
    const clock = new FakeClock();
    const window = createGroovingCallWindow(1, 1000, clock);
    clock.time = 10;
    expect(window.take()).toBe(true);
    clock.time = 1009;
    expect(window.take()).toBe(false);
    clock.time = 1010;
    expect(window.take()).toBe(true);
  });
});
