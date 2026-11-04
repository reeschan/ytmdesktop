import { afterEach, describe, expect, it } from "vitest";
import { YTMHook } from "./ytmhook";

const originalSet = Object.getOwnPropertyDescriptor(Map.prototype, "set")!;

describe("YTMHook", () => {
  afterEach(() => {
    Object.defineProperty(Map.prototype, "set", originalSet);
  });

  it("lets any key through Map.prototype.set, including null and undefined", () => {
    const hook = new YTMHook();
    hook.init();

    const map = new Map<unknown, unknown>();
    for (const key of [null, undefined, 0, false, "key", Symbol("key")]) {
      expect(map.set(key, key)).toBe(map);
      expect(map.get(key)).toBe(key);
    }
  });

  it("does not throw when a token key is given a null or undefined value", () => {
    const hook = new YTMHook();
    hook.init();

    const map = new Map<unknown, unknown>();
    expect(() => map.set({ name: "PLAYER_CONTROLLER_TOKEN" }, null)).not.toThrow();
    expect(() => map.set({ name: "STATE_STORE_TOKEN" }, undefined)).not.toThrow();
  });

  it("captures the player controller when its class is constructed", () => {
    const hook = new YTMHook();
    hook.init();

    class Player {}
    const provider = { useClass: Player };
    new Map().set({ name: "PLAYER_CONTROLLER_TOKEN" }, provider);

    const player = new provider.useClass();
    expect(player).toBeInstanceOf(Player);
    expect(hook.ytmPlayerController).toBe(player);
  });

  it("captures the state store when its factory is called", () => {
    const hook = new YTMHook();
    hook.init();

    const store = {};
    const provider = { useFactory: () => store };
    new Map().set({ name: "STATE_STORE_TOKEN" }, provider);

    expect(provider.useFactory()).toBe(store);
    expect(hook.ytmStateStore).toBe(store);
  });
});
