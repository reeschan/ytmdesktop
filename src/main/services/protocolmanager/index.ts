import { app, net, protocol } from "electron";
import Service from "../service";
import log from "electron-log";
import YTMViewManager from "../ytmviewmanager";
import { DependencyConstructor } from "~shared/types";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";
import ProtectedAPIManager from "../protectedapimanager";
import ConfigStore from "../configstore";

// Serves the background video file chosen in the settings and nothing else
export const BACKGROUND_VIDEO_FILE_HOST = "background-video-file";

const VIDEO_CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm"
};
const DEFAULT_CONTENT_TYPE = "application/octet-stream";

type ByteRange = {
  start: number;
  // Inclusive
  end: number;
};

/**
 * Parses a single range of an HTTP Range header (for example "bytes=0-1023" or "bytes=-500")
 *
 * @returns The range clamped to the size, or null when it is malformed or not satisfiable
 */
function parseByteRange(header: string, size: number): ByteRange | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === "" && match[2] === "")) return null;

  if (match[1] === "") {
    const suffixLength = Number(match[2]);
    if (suffixLength === 0 || size === 0) return null;
    return { start: Math.max(0, size - suffixLength), end: size - 1 };
  }

  const start = Number(match[1]);
  const end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  if (start >= size || start > end) return null;
  return { start, end };
}

function fileStream(filePath: string, range: ByteRange): ReadableStream<Uint8Array> {
  return Readable.toWeb(fs.createReadStream(filePath, { start: range.start, end: range.end })) as ReadableStream<Uint8Array>;
}

export default class ProtocolManager extends Service {
  public static override readonly dependencies: DependencyConstructor<Service>[] = [YTMViewManager, ProtectedAPIManager, ConfigStore];

  private _initialized = false;
  public get initialized() {
    return this._initialized;
  }

  public override onPreInitialized() {
    // Register a custom protocol for use within the app - https://www.electronjs.org/docs/latest/tutorial/security#18-avoid-usage-of-the-file-protocol-and-prefer-usage-of-custom-protocols
    protocol.registerSchemesAsPrivileged([
      {
        scheme: "ytmd-app",
        privileges: {
          standard: true,
          secure: true,
          // Lets <video> stream and seek through partial responses
          stream: true
        }
      }
    ]);
  }

  public onInitialized() {
    if (this._initialized) throw new Error("ProtocolManager is already initialized!");
    this._initialized = true;

    // Create a handler for the in app ytmd-app protocol
    protocol.handle("ytmd-app", this.handleYTMDAppProtocol.bind(this));

    // Register a `ytmd` protocol into the system to allow opening songs inside YTMD
    // This will register the protocol in development, this is intentional and should stay this way for development purposes
    if (!app.isDefaultProtocolClient("ytmd")) {
      if (process.defaultApp) {
        if (process.argv.length >= 2) {
          log.info("Application set as default protcol client for 'ytmd'");
          app.setAsDefaultProtocolClient("ytmd", process.execPath, [path.resolve(process.argv[1])]);
        }
      } else {
        log.info("Application set as default protcol client for 'ytmd'");
        app.setAsDefaultProtocolClient("ytmd", process.execPath);
      }
    }

    log.info("ProtocolManager initialized");
  }

  public override onPostInitialized(): void {}

  public override onTerminated(): void {}

  public handleYTMDProtocol(url: string) {
    const ytmViewManager = this.getDependency(YTMViewManager);
    const protectedApiManager = this.getDependency(ProtectedAPIManager);

    log.info("Handling ytmd protocol url", url);
    const urlPaths = url.split("://")[1];
    if (urlPaths) {
      const paths = urlPaths.split("/");
      if (paths.length > 0) {
        switch (paths[0]) {
          case "play": {
            if (paths.length >= 2) {
              const videoId = paths[1];
              const playlistId = paths[2];

              if (ytmViewManager.isInitialized()) {
                log.debug(`Navigating to videoId: ${videoId}, playlistId: ${playlistId}`);

                const remoteControlApi = protectedApiManager.createOrGetAPI("RemoteControl");
                remoteControlApi.postMessage("execute", "navigate", {
                  watchEndpoint: {
                    videoId: videoId,
                    playlistId: playlistId
                  }
                });
              }
            }
          }
        }
      }
    }
  }

  private async handleYTMDAppProtocol(req: Request) {
    const { host, pathname } = new URL(req.url);
    if (host === BACKGROUND_VIDEO_FILE_HOST) {
      log.debug(`${req.method} ytmd-app://${host}${pathname}`);
      return this.handleBackgroundVideoFile(req);
    }

    let rootPath: string | undefined = undefined;
    switch (host) {
      case "updater": {
        rootPath = path.resolve(process.resourcesPath, `app.asar/.vite/renderer/windows/updater`);
        break;
      }

      case "main": {
        rootPath = path.resolve(process.resourcesPath, `app.asar/.vite/renderer/windows/main`);
        break;
      }

      case "titlebar": {
        rootPath = path.resolve(process.resourcesPath, `app.asar/.vite/renderer/windows/titlebar`);
        break;
      }

      case "settings": {
        rootPath = path.resolve(process.resourcesPath, `app.asar/.vite/renderer/windows/settings`);
        break;
      }

      case "authorize-companion": {
        rootPath = path.resolve(process.resourcesPath, `app.asar/.vite/renderer/windows/authorize-companion`);
        break;
      }

      case "miniplayer": {
        rootPath = path.resolve(process.resourcesPath, `app.asar/.vite/renderer/windows/miniplayer`);
        break;
      }

      case "changelog": {
        rootPath = path.resolve(process.resourcesPath, `app.asar/.vite/renderer/windows/changelog`);
        break;
      }

      case "background-video": {
        rootPath = path.resolve(process.resourcesPath, `app.asar/.vite/renderer/windows/background-video`);
        break;
      }
    }

    log.debug(`${req.method} ytmd-app://${host}${pathname}`);

    if (!rootPath) {
      log.debug(`Root path not found, dropping request`);
      return new Response(null, {
        status: 404
      })
    }

    let desiredPath = pathname;
    if (pathname === "/") desiredPath = "/index.html";

    const assetsRegex = /^[/\\]+(assets[/\\]+)+/;
    if (assetsRegex.test(desiredPath)) {
      desiredPath = desiredPath.replace(assetsRegex, "");
      rootPath = path.resolve(process.resourcesPath, `app.asar/.vite/renderer/assets`);
    }

    desiredPath = desiredPath.replace(/^[/\\]+/, "");

    if (!this.isSafePath(rootPath, desiredPath)) {
      log.warn("Requested path violated the safe path policy");
      return new Response("Policy Violation", {
        status: 403,
        headers: { "Content-Type": "text/html" }
      });
    }

    const fileUrlPath = pathToFileURL(path.resolve(rootPath, desiredPath)).toString();
    log.debug(`Path inferenced to ${fileUrlPath}`);

    return net.fetch(fileUrlPath);
  }

  /**
   * Responds with the background video file from the settings whatever the requested path is, so no other file can be read
   */
  private async handleBackgroundVideoFile(req: Request): Promise<Response> {
    const configStore = this.getDependency(ConfigStore);
    // The file is served only while the background video is enabled, even if a path is still set
    if (!configStore.get("appearance.backgroundVideoEnabled")) return new Response(null, { status: 404 });

    const filePath = configStore.get("appearance.backgroundVideoPath");
    if (!filePath) return new Response(null, { status: 404 });

    let size: number;
    try {
      const stats = await fs.promises.stat(filePath);
      if (!stats.isFile()) return new Response(null, { status: 404 });
      size = stats.size;
    } catch {
      return new Response(null, { status: 404 });
    }

    const headers: Record<string, string> = {
      "Content-Type": VIDEO_CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? DEFAULT_CONTENT_TYPE,
      "Accept-Ranges": "bytes"
    };
    const sendBody = req.method !== "HEAD";

    const rangeHeader = req.headers.get("Range");
    if (rangeHeader === null) {
      headers["Content-Length"] = String(size);
      const body = sendBody && size > 0 ? fileStream(filePath, { start: 0, end: size - 1 }) : null;
      return new Response(body, { status: 200, headers });
    }

    const range = parseByteRange(rangeHeader, size);
    if (!range) {
      headers["Content-Range"] = `bytes */${size}`;
      return new Response(null, { status: 416, headers });
    }

    headers["Content-Range"] = `bytes ${range.start}-${range.end}/${size}`;
    headers["Content-Length"] = String(range.end - range.start + 1);
    return new Response(sendBody ? fileStream(filePath, range) : null, { status: 206, headers });
  }

  private isSafePath(rootPath: string, requestedPath: string) {
    const pathToServe = path.resolve(rootPath, requestedPath);
    const relativePath = path.relative(rootPath, pathToServe);
    const isSafe = relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
    return isSafe;
  }
}
