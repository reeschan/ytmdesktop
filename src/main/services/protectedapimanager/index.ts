import { ipcMain, MessagePortMain } from "electron";
import Service from "../service";
import EventEmitter from "node:events";
import { ProtectedAPIOpCode } from "~shared/types";
import log from "electron-log";
import { randomUUID } from "node:crypto";

// How long invokeMessage waits for the other end's result
const INVOKE_TIMEOUT_MS = 30 * 1000;

export default class ProtectedAPIManager extends Service {
  private mainPort: MessagePortMain | null = null;
  private apis = new Map<string, ProtectedAPI>();

  public override onPreInitialized(): void {}
  public override onInitialized(): void {
    ipcMain.on("protectedApi:bindPort", event => {
      this.setMainPort(event.ports[0]);
    });

    log.info("ProtectedAPIManager initialized");
  }
  public override onPostInitialized(): void {}
  public override onTerminated(): void {}

  /**
   * Sets the main port for the Protected API. This will reset all APIs currently active to have no port and thus become inactive until bound again
   * @param port
   */
  public setMainPort(port: MessagePortMain) {
    this.mainPort = port;
    if (!this.mainPort) return;

    // Reset the ports on all APIs as when setting the main port the other ports are no longer valid
    for (const [name, api] of this.apis) {
      log.info(`protectedapi: unbinding api '${name}' port`);
      api.setPort(null);
    }

    this.mainPort.on("message", event => {
      if (event.data.op === ProtectedAPIOpCode.ProvideAPIPort) {
        const protectedApi = this.createOrGetAPI(event.data.name);
        protectedApi.setPort(event.ports[0]);
      }
    });
    this.mainPort.start();

    log.info("protectedapi: main port bound");
  }

  public createOrGetAPI(name: string): ProtectedAPI {
    if (this.apis.has(name)) return this.apis.get(name)!;

    const protectedApi = new ProtectedAPI(name);
    this.apis.set(name, protectedApi);

    log.info(`protectedapi: api '${name}' created`);

    return protectedApi;
  }
}

export class ProtectedAPI extends EventEmitter {
  private port: MessagePortMain | null = null;
  private waitingInvokes = new Map<string, (...args: unknown[]) => void>();
  // How many ports have been bound so far, so a caller can tell the port of a new document from the one it knew
  private boundCount = 0;
  // Calls waiting for a newer port, released when one is bound or given up on after their time
  private bindWaiters: { afterCount: number; resolve: (bound: boolean) => void; timer: ReturnType<typeof setTimeout> }[] = [];

  public readonly name;

  constructor(name: string) {
    super();
    this.name = name;
  }

  /** Counts the ports bound (set with a port) over the API's life. A new document binds one more */
  public get bindCount(): number {
    return this.boundCount;
  }

  /** Whether a port is bound now. A reload leaves this false until the new document's page binds its own */
  public get isBound(): boolean {
    return this.port !== null;
  }

  /**
   * Waits until a port is bound after the given count, at most timeoutMs. True at once when one already was,
   * false when none came in time. The caller reads `bindCount` before and passes it here
   */
  public waitForBind(afterCount: number, timeoutMs: number): Promise<boolean> {
    if (this.boundCount > afterCount) return Promise.resolve(true);

    return new Promise(resolve => {
      const waiter = {
        afterCount,
        resolve,
        timer: setTimeout(() => {
          const index = this.bindWaiters.indexOf(waiter);
          if (index !== -1) this.bindWaiters.splice(index, 1);
          resolve(false);
        }, timeoutMs)
      };
      this.bindWaiters.push(waiter);
    });
  }

  public setPort(port: MessagePortMain | null) {
    this.port = port;
    if (!this.port) return;

    this.boundCount++;
    this.releaseBindWaiters();

    this.port.on("message", event => {
      if (event.data.op === ProtectedAPIOpCode.Message) {
        this.emit(event.data.name, ...event.data.args);
      }

      if (event.data.op === ProtectedAPIOpCode.InvokeResponse) {
        if (this.waitingInvokes.has(event.data.id)) {
          const callback = this.waitingInvokes.get(event.data.id);
          this.waitingInvokes.delete(event.data.id);
          if (callback) callback(...event.data.args);
        }
      }
    });
    this.port.on("close", () => {
      log.info(`protectedapi: api '${this.name}' port closed unbinding`);
      this.port = null;
    });
    this.port.start();

    log.info(`protectedapi: api '${this.name}' port bound`);
  }

  // Called after the count went up, so every call waiting for this port or an earlier one can go on
  private releaseBindWaiters() {
    const waiting = this.bindWaiters;
    this.bindWaiters = [];
    for (const waiter of waiting) {
      if (this.boundCount > waiter.afterCount) {
        clearTimeout(waiter.timer);
        waiter.resolve(true);
      } else {
        this.bindWaiters.push(waiter);
      }
    }
  }

  /**
   * Posts a RPC message to the other end of the ProtectedAPI
   * @param name RPC name
   * @param args RPC arguments
   */
  public postMessage(name: string, ...args: unknown[]) {
    this.port?.postMessage({
      op: ProtectedAPIOpCode.Message,
      name,
      args
    });
  }

  /**
   * Posts a RPC message to the other end of the ProtectedAPI and waits for the result, at most INVOKE_TIMEOUT_MS
   * @param name RPC name
   * @param args RPC arguments
   */
  public async invokeMessage(name: string, ...args: unknown[]): Promise<unknown[]> {
    return this.invokeMessageWithTimeout(INVOKE_TIMEOUT_MS, name, ...args);
  }

  /**
   * Posts a RPC message to the other end of the ProtectedAPI and waits for the result, rejecting when none came within the time
   * @param timeoutMs How long to wait for the result
   * @param name RPC name
   * @param args RPC arguments
   */
  public async invokeMessageWithTimeout(timeoutMs: number, name: string, ...args: unknown[]): Promise<unknown[]> {
    const invokeId = randomUUID();
    return new Promise((resolve, reject) => {
      this.waitingInvokes.set(invokeId, (...args: unknown[]) => {
        resolve(args);
      });

      this.port?.postMessage({
        op: ProtectedAPIOpCode.Invoke,
        id: invokeId,
        name,
        args
      });

      setTimeout(() => {
        if (this.waitingInvokes.has(invokeId)) {
          this.waitingInvokes.delete(invokeId);
          reject();
        }
      }, timeoutMs);
    });
  }
}
