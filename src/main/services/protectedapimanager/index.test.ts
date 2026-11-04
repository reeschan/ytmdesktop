import type { MessagePortMain } from "electron";
import { describe, expect, it, vi } from "vitest";
import { ProtectedAPI } from ".";

// The manager loads electron, which cannot be loaded in the test environment
vi.mock("electron", () => ({ ipcMain: { on: vi.fn() }, MessagePortMain: class {} }));
vi.mock("electron-log", () => ({ default: { info: vi.fn() } }));

// Only what setPort uses: the listeners it adds, the start of the port and the posted messages
function fakePort() {
  return { on: vi.fn(), start: vi.fn(), postMessage: vi.fn() } as unknown as MessagePortMain;
}

describe("ProtectedAPI.waitForBind", () => {
  it("resolves true when a port is bound after the wait started", async () => {
    const api = new ProtectedAPI("Test");
    expect(api.bindCount).toBe(0);
    expect(api.isBound).toBe(false);

    const wait = api.waitForBind(api.bindCount, 1000);
    api.setPort(fakePort());

    await expect(wait).resolves.toBe(true);
    expect(api.bindCount).toBe(1);
    expect(api.isBound).toBe(true);
  });

  it("resolves false when no port binds in time", async () => {
    const api = new ProtectedAPI("Test");

    await expect(api.waitForBind(api.bindCount, 20)).resolves.toBe(false);
    expect(api.bindCount).toBe(0);
  });

  it("resolves true at once when a port is already bound", async () => {
    const api = new ProtectedAPI("Test");
    api.setPort(fakePort());

    await expect(api.waitForBind(0, 20)).resolves.toBe(true);
    // The next document needs one more port
    await expect(api.waitForBind(api.bindCount, 20)).resolves.toBe(false);
  });

  it("counts only ports, not the unbinding of a dead one", async () => {
    const api = new ProtectedAPI("Test");
    api.setPort(fakePort());
    api.setPort(null);

    expect(api.bindCount).toBe(1);
    expect(api.isBound).toBe(false);
  });
});
