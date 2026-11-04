import EventEmitter from "node:events";
import { describe, expect, it, vi } from "vitest";
import type { ServiceHost as ServiceHostType } from "../../services/servicehost";

vi.mock("electron", () => ({}));
vi.mock("electron-log", () => ({ default: { info: () => {}, error: () => {} } }));
vi.mock("../../services/configstore", () => ({ default: class ConfigStore {} }));
vi.mock("../../services/ytmviewmanager", () => ({ default: class YTMViewManager {} }));

const { default: VolumeRatio } = await import("./index");
const { default: IntegrationManager } = await import("../../services/integrationmanager");
const { ServiceHost } = await import("../../services/servicehost");
const { default: enableScript } = await import("./script/enable.script?raw");

const settle = () => new Promise(resolve => setTimeout(resolve, 0));

describe("VolumeRatio", () => {
  it("injects the enable script once per YTM view, however often the view is recreated", async () => {
    const sentScripts: string[] = [];
    const ytmViewManager = Object.assign(new EventEmitter(), {
      ready: async () => {},
      getView: () => ({ webContents: { send: (_channel: string, script: string) => sentScripts.push(script) } })
    });
    const host = { getService: () => ytmViewManager } as unknown as ServiceHostType;

    const volumeRatio = new VolumeRatio();
    volumeRatio[ServiceHost.INJECT](host);
    await volumeRatio[IntegrationManager.ENABLE]();

    ytmViewManager.emit("view-recreated");
    await settle();
    ytmViewManager.emit("view-recreated");
    await settle();

    expect(sentScripts.filter(script => script === enableScript)).toHaveLength(3);
    expect(ytmViewManager.listenerCount("view-recreated")).toBe(1);
  });
});
