import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoreSchema } from "~shared/store/schema";
import ConfigStore from "../configstore";
import { ServiceHost } from "../servicehost";
import WatchDog from "../watchdog";
import StateManager from ".";

// The real services load electron, which cannot be loaded in the test environment
vi.mock("electron-log", () => ({ default: { info: vi.fn() } }));
vi.mock("../configstore", () => ({
  default: class {
    public get = vi.fn();
    public set = vi.fn();
  }
}));
vi.mock("../watchdog", () => ({
  default: class {
    private listeners: (() => void)[] = [];
    public on(_event: string, listener: () => void) {
      this.listeners.push(listener);
    }
    public crash() {
      for (const listener of this.listeners) listener();
    }
  }
}));

type FakeConfigStore = { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };
type FakeWatchDog = { crash: () => void };

const WRITE_DELAY_MS = 30 * 1000;
const FORCED_WRITE_UPDATES = 512;

function initialState(): StoreSchema["state"] {
  return {
    lastUrl: "",
    lastPlaylistId: "",
    lastVideoId: "",
    lastVideoProgress: 0,
    windowBounds: null,
    windowMaximized: false,
    miniplayerWindowBounds: null,
    groovingRunInProgress: false,
    groovingNoticePending: false
  };
}

function createStateManager() {
  const configStore = new ConfigStore() as unknown as FakeConfigStore;
  configStore.get.mockReturnValue(initialState());
  const watchDog = new WatchDog() as unknown as FakeWatchDog;
  const services = new Map<unknown, unknown>([
    [ConfigStore, configStore],
    [WatchDog, watchDog]
  ]);
  const host = { getService: (service: unknown) => services.get(service) } as unknown as ServiceHost;

  const stateManager = new StateManager();
  stateManager[ServiceHost.INJECT](host);
  stateManager.onPreInitialized();
  stateManager.onInitialized();
  stateManager.onPostInitialized();

  return { stateManager, configStore, watchDog };
}

describe("StateManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes 30 seconds after the first change while the state keeps changing every second", () => {
    const { stateManager, configStore } = createStateManager();

    for (let progress = 1; progress <= 60; progress++) {
      stateManager.updateState({ lastVideoProgress: progress });
      if (progress === 30) {
        // 29 seconds have passed since the first change
        expect(configStore.set).not.toHaveBeenCalled();
      }
      vi.advanceTimersByTime(1000);
      if (progress === 30) {
        expect(configStore.set).toHaveBeenCalledTimes(1);
        expect(configStore.set).toHaveBeenLastCalledWith("state", expect.objectContaining({ lastVideoProgress: 30 }));
      }
    }

    // The changes after the first write are written 30 seconds after the first of them
    expect(configStore.set).toHaveBeenCalledTimes(2);
    expect(configStore.set).toHaveBeenLastCalledWith("state", expect.objectContaining({ lastVideoProgress: 60 }));
  });

  it("keeps other state changes made while the state keeps changing in the same write", () => {
    const { stateManager, configStore } = createStateManager();

    stateManager.updateState({ lastVideoId: "video-a" });
    for (let progress = 1; progress <= 29; progress++) {
      vi.advanceTimersByTime(1000);
      stateManager.updateState({ lastVideoProgress: progress });
    }
    vi.advanceTimersByTime(1000);

    expect(configStore.set).toHaveBeenCalledTimes(1);
    expect(configStore.set).toHaveBeenLastCalledWith("state", expect.objectContaining({ lastVideoId: "video-a", lastVideoProgress: 29 }));
  });

  it("writes 30 seconds after a single change", () => {
    const { stateManager, configStore } = createStateManager();

    stateManager.updateState({ lastVideoId: "video-a" });
    vi.advanceTimersByTime(WRITE_DELAY_MS - 1);
    expect(configStore.set).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(configStore.set).toHaveBeenCalledTimes(1);
    expect(configStore.set).toHaveBeenLastCalledWith("state", expect.objectContaining({ lastVideoId: "video-a" }));

    vi.advanceTimersByTime(WRITE_DELAY_MS * 2);
    expect(configStore.set).toHaveBeenCalledTimes(1);
  });

  it("does not write when the state does not change", () => {
    const { stateManager, configStore } = createStateManager();

    stateManager.updateState({ lastVideoProgress: 0 });
    vi.advanceTimersByTime(WRITE_DELAY_MS);

    expect(configStore.set).not.toHaveBeenCalled();
  });

  it("writes immediately on the 512th change without waiting for the timer", () => {
    const { stateManager, configStore } = createStateManager();

    for (let progress = 1; progress < FORCED_WRITE_UPDATES; progress++) {
      stateManager.updateState({ lastVideoProgress: progress });
    }
    expect(configStore.set).not.toHaveBeenCalled();

    stateManager.updateState({ lastVideoProgress: FORCED_WRITE_UPDATES });
    expect(configStore.set).toHaveBeenCalledTimes(1);
    expect(configStore.set).toHaveBeenLastCalledWith("state", expect.objectContaining({ lastVideoProgress: FORCED_WRITE_UPDATES }));

    vi.advanceTimersByTime(WRITE_DELAY_MS);
    expect(configStore.set).toHaveBeenCalledTimes(1);
  });

  it("starts a new timer for changes after the 512th change write", () => {
    const { stateManager, configStore } = createStateManager();

    for (let progress = 1; progress <= FORCED_WRITE_UPDATES; progress++) {
      stateManager.updateState({ lastVideoProgress: progress });
    }
    stateManager.updateState({ lastVideoProgress: FORCED_WRITE_UPDATES + 1 });
    vi.advanceTimersByTime(WRITE_DELAY_MS);

    expect(configStore.set).toHaveBeenCalledTimes(2);
    expect(configStore.set).toHaveBeenLastCalledWith("state", expect.objectContaining({ lastVideoProgress: FORCED_WRITE_UPDATES + 1 }));
  });

  it("forceWrite writes pending changes immediately and cancels the timer", () => {
    const { stateManager, configStore } = createStateManager();

    stateManager.updateState({ lastVideoId: "video-a" });
    stateManager.forceWrite();
    expect(configStore.set).toHaveBeenCalledTimes(1);
    expect(configStore.set).toHaveBeenLastCalledWith("state", expect.objectContaining({ lastVideoId: "video-a" }));

    vi.advanceTimersByTime(WRITE_DELAY_MS);
    expect(configStore.set).toHaveBeenCalledTimes(1);
  });

  it("forceWrite does not write when there are no pending changes", () => {
    const { stateManager, configStore } = createStateManager();

    stateManager.forceWrite();

    expect(configStore.set).not.toHaveBeenCalled();
  });

  it("starts a new timer for changes after forceWrite", () => {
    const { stateManager, configStore } = createStateManager();

    stateManager.updateState({ lastVideoId: "video-a" });
    stateManager.forceWrite();
    stateManager.updateState({ lastVideoId: "video-b" });
    vi.advanceTimersByTime(WRITE_DELAY_MS);

    expect(configStore.set).toHaveBeenCalledTimes(2);
    expect(configStore.set).toHaveBeenLastCalledWith("state", expect.objectContaining({ lastVideoId: "video-b" }));
  });

  describe("deferWrite", () => {
    it("does not write while only the playback position changes, and forceWrite writes the last position", () => {
      const { stateManager, configStore } = createStateManager();

      for (let progress = 1; progress <= 120; progress++) {
        stateManager.updateState({ lastVideoProgress: progress }, { deferWrite: true });
        vi.advanceTimersByTime(1000);
      }
      vi.advanceTimersByTime(WRITE_DELAY_MS * 10);
      expect(configStore.set).not.toHaveBeenCalled();

      stateManager.forceWrite();
      expect(configStore.set).toHaveBeenCalledTimes(1);
      expect(configStore.set).toHaveBeenLastCalledWith("state", expect.objectContaining({ lastVideoProgress: 120 }));
    });

    it("does not count toward the 512 changes write", () => {
      const { stateManager, configStore } = createStateManager();

      for (let progress = 1; progress <= FORCED_WRITE_UPDATES * 2; progress++) {
        stateManager.updateState({ lastVideoProgress: progress }, { deferWrite: true });
      }

      expect(configStore.set).not.toHaveBeenCalled();
    });

    it("is written along with the next normal update", () => {
      const { stateManager, configStore } = createStateManager();

      stateManager.updateState({ lastVideoProgress: 10 }, { deferWrite: true });
      vi.advanceTimersByTime(WRITE_DELAY_MS);
      stateManager.updateState({ lastVideoId: "video-a" });
      vi.advanceTimersByTime(WRITE_DELAY_MS);

      expect(configStore.set).toHaveBeenCalledTimes(1);
      expect(configStore.set).toHaveBeenLastCalledWith("state", expect.objectContaining({ lastVideoId: "video-a", lastVideoProgress: 10 }));
    });

    it("is written with a pending normal update without moving its timer", () => {
      const { stateManager, configStore } = createStateManager();

      stateManager.updateState({ lastVideoId: "video-a" });
      for (let progress = 1; progress < 30; progress++) {
        vi.advanceTimersByTime(1000);
        stateManager.updateState({ lastVideoProgress: progress }, { deferWrite: true });
      }
      expect(configStore.set).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1000);

      expect(configStore.set).toHaveBeenCalledTimes(1);
      expect(configStore.set).toHaveBeenLastCalledWith("state", expect.objectContaining({ lastVideoId: "video-a", lastVideoProgress: 29 }));

      // The position updates after the write do not schedule another one
      stateManager.updateState({ lastVideoProgress: 30 }, { deferWrite: true });
      vi.advanceTimersByTime(WRITE_DELAY_MS * 2);
      expect(configStore.set).toHaveBeenCalledTimes(1);
    });

    it("is written on termination", () => {
      const { stateManager, configStore } = createStateManager();

      stateManager.updateState({ lastVideoProgress: 90 }, { deferWrite: true });
      stateManager.onTerminated();

      expect(configStore.set).toHaveBeenCalledTimes(1);
      expect(configStore.set).toHaveBeenLastCalledWith("state", expect.objectContaining({ lastVideoProgress: 90 }));
    });
  });

  it("does not write after a crash", () => {
    const { stateManager, configStore, watchDog } = createStateManager();

    stateManager.updateState({ lastVideoId: "video-a" });
    watchDog.crash();
    vi.advanceTimersByTime(WRITE_DELAY_MS);
    stateManager.updateState({ lastVideoId: "video-b" });
    stateManager.forceWrite();
    vi.advanceTimersByTime(WRITE_DELAY_MS);

    expect(configStore.set).not.toHaveBeenCalled();
  });
});
