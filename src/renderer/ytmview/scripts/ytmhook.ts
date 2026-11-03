import { DEFAULT_POLL_INTERVALS, pollUntil } from "~shared/ytm-startup";

export class YTMHook {
  private _ytmStateStore;
  private _ytmPlayerController;
  private readyPromise?: Promise<boolean>;
  public get ytmStateStore(): any {
    return this._ytmStateStore;
  }
  public get ytmPlayerController(): any {
    return this._ytmPlayerController;
  }

  public init() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    // This hook is designed to capture addProvider calls which contain the dependency injection into elements within YTM
    // eslint-disable-next-line @typescript-eslint/unbound-method -- The original set is kept to be called with .call(this) below
    const mapSet = Map.prototype.set;
    Object.defineProperty(Map.prototype, "set", {
      value: function (key, value) {
        if (key?.name === "PLAYER_CONTROLLER_TOKEN") {
          if (value?.useClass) {
            const OriginalClass = value.useClass;

            value.useClass = new Proxy(OriginalClass, {
              construct(target, args, newTarget) {
                const instance = Reflect.construct(target, args, newTarget);
                self._ytmPlayerController = instance;
                return instance;
              },
              get(target, prop, receiver) {
                return Reflect.get(target, prop, receiver);
              }
            });
          }
        }

        if (key?.name === "STATE_STORE_TOKEN") {
          if (value?.useFactory) {
            const originalFactory = value.useFactory;

            value.useFactory = new Proxy(originalFactory, {
              apply(target, thisArg, args) {
                const instance = Reflect.apply(target, thisArg, args);
                self._ytmStateStore = instance;
                return instance;
              }
            });
          }
        }

        return mapSet.call(this, key, value);
      }
    });
  }

  public ready(): Promise<boolean> {
    if (!this.readyPromise) {
      const controller = new AbortController();
      const onPageHide = () => controller.abort();
      window.addEventListener("pagehide", onPageHide, { once: true });
      this.readyPromise = pollUntil(() => Boolean(this._ytmStateStore && this._ytmPlayerController), {
        ...DEFAULT_POLL_INTERVALS,
        signal: controller.signal
      }).finally(() => window.removeEventListener("pagehide", onPageHide));
    }
    return this.readyPromise;
  }
}

export default new YTMHook();
