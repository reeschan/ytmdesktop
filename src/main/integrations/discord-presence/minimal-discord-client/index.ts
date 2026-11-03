import EventEmitter from "events";
import IPCClient, { OPCode } from "./ipc";
import { DiscordActivity } from "./types";
import { randomUUID } from "crypto";
import log from "electron-log";
import { getIPCPathCandidates } from "./ipc-path";

const IPC_PIPE_COUNT = 10;

export default class DiscordClient extends EventEmitter {
  private clientId: string | null = null;
  private connectionPromise: Promise<void> | null = null;
  private ipcClient = new IPCClient();
  private connected = false;

  constructor(clientId: string) {
    super();

    this.clientId = clientId;
  }

  // A socket error is followed by a close event, so only the first of the two does the cleanup.
  private handleDisconnect = () => {
    if (!this.connected) return;
    this.connected = false;
    this.emit("close");
  };

  public connect() {
    if (this.connectionPromise) return this.connectionPromise;
    this.ipcClient.removeAllListeners();

    // Promise chaining is OK here, we're looping through different IPC paths and seeing which one works
    // eslint-disable-next-line no-async-promise-executor
    this.connectionPromise = new Promise(async (resolve, reject) => {
      // For each pipe number, every candidate path is tried in order before moving to the next number.
      const ipcPaths = Array.from({ length: IPC_PIPE_COUNT }, (_, id) =>
        getIPCPathCandidates(process.platform, process.env, id)
      ).flat();
      log.debug(`dipc: initiated connection loop over ${ipcPaths.length} paths`);
      for (const ipcPath of ipcPaths) {
        try {
          await new Promise<void>((ipcResolve, ipcReject) => {
            log.debug("dipc: connecting to discord at", ipcPath);
            this.ipcClient.once("close", () => {
              this.ipcClient.removeAllListeners();
              log.debug("dipc: failed to connect to discord at", ipcPath);
              ipcReject();
            });
            this.ipcClient.once("error", error => {
              log.debug("dipc: socket error connecting to discord", error);
            });
            this.ipcClient.once("connect", () => {
              log.debug("dipc: connected to discord at", ipcPath);
              this.ipcClient.removeAllListeners();
              ipcResolve();
            });
            this.ipcClient.connect(ipcPath);
          });

          this.connected = true;
          this.ipcClient.send(
            {
              v: 1,
              client_id: this.clientId
            },
            OPCode.HANDSHAKE
          );
          this.emit("connect");

          this.ipcClient.on("close", this.handleDisconnect);
          this.ipcClient.on("error", (error: unknown) => {
            log.debug("dipc: socket error after connecting to discord", error);
            this.handleDisconnect();
          });
          this.ipcClient.on("data", (op: OPCode, json: unknown) => {
            switch (op) {
              case OPCode.PING: {
                this.ipcClient.send(json, OPCode.PONG);
                break;
              }

              default: {
                break;
              }
            }
          });

          this.connectionPromise = null;
          resolve();

          return;
        } catch {
          // Try the next candidate path.
        }
      }

      this.connectionPromise = null;
      reject();
    });

    return this.connectionPromise;
  }

  public close() {
    if (this.connected) {
      this.ipcClient.once("close", () => {
        this.ipcClient.removeAllListeners();
      });
      this.ipcClient.close();
    }
  }

  public destroy() {
    this.connected = false;
    this.removeAllListeners();
    this.ipcClient.destroy();
  }

  public setActivity(activity: DiscordActivity) {
    this.ipcClient.send({
      cmd: "SET_ACTIVITY",
      args: {
        pid: process.pid,
        activity
      },
      nonce: randomUUID()
    });
  }

  public clearActivity() {
    this.ipcClient.send({
      cmd: "SET_ACTIVITY",
      args: {
        pid: process.pid
      },
      nonce: randomUUID()
    });
  }
}
