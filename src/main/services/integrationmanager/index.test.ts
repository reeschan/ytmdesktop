import { describe, expect, it, vi } from "vitest";
import type { StoreSchema } from "~shared/store/schema";
import type { ServiceHost as ServiceHostType } from "../servicehost";
import type IntegrationType from "../../integrations/integration";

vi.mock("electron", () => ({}));
vi.mock("electron-log", () => ({ default: { info: () => {}, error: () => {} } }));
vi.mock("../configstore", () => ({ default: class ConfigStore {} }));
vi.mock("../ytmviewmanager", () => ({ default: class YTMViewManager {} }));

const { default: IntegrationManager, IntegrationManagerHook } = await import("./index");
const { default: Integration } = await import("../../integrations/integration");
const { ServiceHost } = await import("../servicehost");

type StoreListener = (newState: StoreSchema, oldState: StoreSchema) => void;

function storeState(companionServerEnabled: boolean) {
  return { integrations: { companionServerEnabled } } as StoreSchema;
}

function createManager(failingEnables: number) {
  let enabled = true;
  let storeListener: StoreListener | null = null;
  const configStore = {
    get: () => enabled,
    onDidAnyChange: (listener: StoreListener) => (storeListener = listener)
  };
  const host = { getService: () => configStore } as unknown as ServiceHostType;

  const enableAttempts = { count: 0 };
  class TestIntegration extends Integration {
    public name = "Test";
    public storeEnableProperty: IntegrationType["storeEnableProperty"] = "integrations.companionServerEnabled";
    protected onSetup() {}
    protected async onEnabled() {
      enableAttempts.count++;
      if (enableAttempts.count <= failingEnables) throw new Error("port in use");
    }
    protected onDisabled() {}
  }

  const manager = new IntegrationManager();
  manager[ServiceHost.INJECT](host);
  manager.onPostInitialized();
  manager.createIntegrations([TestIntegration]);

  return {
    manager,
    enableAttempts,
    // Mimics a settings change, which reconciles with the new and old state
    changeStore: (nextEnabled: boolean) => {
      const previous = enabled;
      enabled = nextEnabled;
      storeListener!(storeState(nextEnabled), storeState(previous));
    }
  };
}

function nextEnableError(manager: InstanceType<typeof IntegrationManager>) {
  return new Promise<[{ name: string; isEnabled: boolean }, Error]>(resolve => manager.once("enable-error", (integration, error) => resolve([integration, error])));
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0));

describe("IntegrationManager", () => {
  it("emits enable-error instead of rejecting when an integration fails to enable", async () => {
    const { manager } = createManager(1);
    const enableError = nextEnableError(manager);

    manager.runHook(IntegrationManagerHook.AppReady);

    const [integration, error] = await enableError;
    expect(integration.name).toBe("Test");
    expect(integration.isEnabled).toBe(false);
    expect(error.message).toBe("port in use");
  });

  it("does not retry a failed integration on unrelated settings changes", async () => {
    const { manager, enableAttempts, changeStore } = createManager(1);
    manager.runHook(IntegrationManagerHook.AppReady);
    await settle();

    changeStore(true);
    await settle();

    expect(enableAttempts.count).toBe(1);
  });

  it("tries a failed integration again after it is turned off and on", async () => {
    const { manager, enableAttempts, changeStore } = createManager(1);
    manager.runHook(IntegrationManagerHook.AppReady);
    await settle();

    changeStore(false);
    await settle();
    changeStore(true);
    await settle();

    expect(enableAttempts.count).toBe(2);
  });
});
