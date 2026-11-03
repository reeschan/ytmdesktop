import { describe, expect, it } from "vitest";
import {
  DISCORD_CONNECTION_FAILED_AFTER_MS,
  DISCORD_RETRY_INITIAL_DELAY_MS,
  DISCORD_RETRY_MAX_DELAY_MS,
  retryDelayMs
} from "~shared/discord-presence/connection";

describe("retryDelayMs", () => {
  it("waits the initial delay on the first retry", () => {
    expect(retryDelayMs(1, 5000, 60000)).toBe(5000);
  });

  it("doubles the delay on each retry", () => {
    expect(retryDelayMs(2, 5000, 60000)).toBe(10000);
    expect(retryDelayMs(3, 5000, 60000)).toBe(20000);
    expect(retryDelayMs(4, 5000, 60000)).toBe(40000);
  });

  it("stops growing at the max delay", () => {
    expect(retryDelayMs(5, 5000, 60000)).toBe(60000);
    expect(retryDelayMs(6, 5000, 60000)).toBe(60000);
  });

  it("returns the finite max delay for a large retry count", () => {
    const delay = retryDelayMs(1000, 5000, 60000);
    expect(delay).toBe(60000);
    expect(Number.isFinite(delay)).toBe(true);
  });

  it("treats a retry count below 1 as the first retry", () => {
    expect(retryDelayMs(0, 5000, 60000)).toBe(5000);
    expect(retryDelayMs(-3, 5000, 60000)).toBe(5000);
  });

  it("falls back to the initial delay for a non-numeric retry count", () => {
    expect(retryDelayMs(Number.NaN, 5000, 60000)).toBe(5000);
  });

  it("uses the given delays instead of fixed ones", () => {
    expect(retryDelayMs(1, 100, 250)).toBe(100);
    expect(retryDelayMs(2, 100, 250)).toBe(200);
    expect(retryDelayMs(3, 100, 250)).toBe(250);
  });
});

describe("Discord connection defaults", () => {
  it("retries from 5 seconds up to 60 seconds", () => {
    expect(retryDelayMs(1, DISCORD_RETRY_INITIAL_DELAY_MS, DISCORD_RETRY_MAX_DELAY_MS)).toBe(5000);
    expect(retryDelayMs(1000, DISCORD_RETRY_INITIAL_DELAY_MS, DISCORD_RETRY_MAX_DELAY_MS)).toBe(60000);
  });

  it("reports a failed connection after 30 seconds", () => {
    expect(DISCORD_CONNECTION_FAILED_AFTER_MS).toBe(30000);
  });
});
