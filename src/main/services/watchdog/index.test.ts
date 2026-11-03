import type { LogMessage } from "electron-log";
import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ app: {}, clipboard: {}, crashReporter: {}, dialog: {} }));
vi.mock("electron-log", () => ({ default: {} }));

const { default: WatchDog, sanitizeLogMessage } = await import("./index");

function message(...data: unknown[]) {
  return { data, date: new Date(), level: "info" } as LogMessage;
}

describe("sanitizeLogMessage", () => {
  it("redacts the path of a URL in a plain string", () => {
    const result = sanitizeLogMessage(message("Loading https://music.youtube.com/watch?v=abc123&list=PL456"));

    expect(result && result.data).toEqual(["Loading https://music.youtube.com/[REDACTED]"]);
  });

  it("drops the third-party cookie warning", () => {
    expect(sanitizeLogMessage(message("Third-party cookie will be blocked. Learn more"))).toBe(false);
  });

  it("leaves values that are not strings as they are", () => {
    const error = new Error("https://music.youtube.com/watch?v=abc123");

    const result = sanitizeLogMessage(message(error, 42));

    expect(result && result.data).toEqual([error, 42]);
  });
});

describe("WatchDog.off", () => {
  it("removes only the given callback", () => {
    const watchDog = new WatchDog();
    const first = () => {};
    const second = () => {};
    const third = () => {};
    watchDog.on("crash", first);
    watchDog.on("crash", second);
    watchDog.on("crash", third);

    watchDog.off("crash", second);

    expect(watchDog["eventCallbacks"].crash).toEqual([first, third]);
  });
});
