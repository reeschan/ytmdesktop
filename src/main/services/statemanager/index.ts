import { StoreSchema } from "~shared/store/schema";
import Service from "../service";
import ConfigStore from "../configstore";
import WatchDog from "../watchdog";
import { DependencyConstructor } from "~shared/types";
import log from "electron-log";

function shallowEqual<T extends Record<string, unknown>>(obj1: T, obj2: T): boolean {
  return Object.keys(obj1).length === Object.keys(obj2).length && Object.keys(obj1).every(key => Object.hasOwn(obj2, key) && obj1[key] === obj2[key]);
}

export default class StateManager extends Service {
  public static override readonly dependencies: DependencyConstructor<Service>[] = [ConfigStore, WatchDog];

  private currentState: StoreSchema["state"] | null = null;
  private diskWriteTimer: NodeJS.Timeout | null = null;
  private diskStale = false;
  private stateUpdates = 0;
  private panicked = false;

  private _initialized = false;
  public get initialized() {
    return this._initialized;
  }

  public override onPreInitialized() {}

  public onInitialized() {
    if (this._initialized) throw new Error("StateManager is already initialized!");
    this._initialized = true;

    log.info("StateManager initialized");
  }

  public override onPostInitialized() {
    const configStore = this.getDependency(ConfigStore);
    const watchDog = this.getDependency(WatchDog);

    this.currentState = configStore.get("state");
    watchDog.on("crash", () => {
      this.panic();
    });
  }

  public override onTerminated() {
    this.forceWrite();
  }

  /**
   * @param options.deferWrite Keeps the change in memory without scheduling a disk write, for values that change every second.
   * The change is written with the next scheduled write or forceWrite.
   */
  public updateState(partialState: Partial<StoreSchema["state"]>, options: { deferWrite?: boolean } = {}) {
    if (this.panicked) return;
    if (!this._initialized) return;

    if (this.currentState) {
      const newState = { ...this.currentState, ...partialState };
      if (!shallowEqual(this.currentState, newState)) {
        this.currentState = newState;
        this.diskStale = true;
        if (options.deferWrite) return;

        this.stateUpdates++;
        // If a significant amount of changes to the state happen then we just force write it immediately
        if (this.stateUpdates >= 512) {
          this.clearDiskWriteTimer();
          this.write();
        } else if (!this.diskWriteTimer) {
          // The timer is not rearmed by later changes, so pending changes are written at most 30 seconds after the first one even while the state keeps changing
          this.diskWriteTimer = setTimeout(() => {
            this.diskWriteTimer = null;
            this.write();
          }, 30 * 1000);
        }
      }
    }
  }

  public forceWrite() {
    if (this.panicked) return;
    if (!this._initialized) return;

    this.clearDiskWriteTimer();
    this.write();
  }

  private clearDiskWriteTimer() {
    if (this.diskWriteTimer) clearTimeout(this.diskWriteTimer);
    this.diskWriteTimer = null;
  }

  private write() {
    if (this.panicked) return;

    if (this.diskStale) {
      const configStore = this.getDependency(ConfigStore);
      configStore.set("state", this.currentState);
      this.diskStale = false;
      this.stateUpdates = 0;
    }
  }

  /**
   * Stops and prevents any state writing
   */
  private panic() {
    this.panicked = true;
    this.clearDiskWriteTimer();
  }
}
