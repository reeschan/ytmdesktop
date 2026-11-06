import { nativeImage, net } from "electron";
import log from "electron-log";
import { ThemeColors } from "~shared/theme";
import { extractJacketColors } from "~shared/theme/jacket";
import { PlayerState, Thumbnail } from "~shared/playerstatestore/types";
import type PlayerStateStore from "../playerstatestore";

// The smallest jacket that is at least this wide is loaded, so the colors are read from a detailed enough image
const MIN_THUMBNAIL_WIDTH = 64;
// The image is shrunk to this size before the pixels are read, keeping the work per song small
const JACKET_SIZE = 64;
const FETCH_TIMEOUT_MS = 5000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
// The results of the last jackets are reused, in the order they were last used
const CACHE_LIMIT = 20;
// The hosts YouTube serves the images from. The player state comes from the page, so only images from these are read
const ALLOWED_IMAGE_HOSTS = ["ytimg.com", "googleusercontent.com", "ggpht.com"];

export type JacketWatcher = {
  /**
   * Starts applying the colors of the jacket of the playing song. Calling it again does nothing
   */
  start(): void;
  /**
   * Stops watching the player and discards the results that are still being read
   */
  stop(): void;
};

type JacketWatcherDependencies = {
  playerStateStore: PlayerStateStore;
  apply: (colors: ThemeColors) => void;
};

type PendingRead = {
  controller: AbortController;
  timer: ReturnType<typeof setTimeout>;
};

/**
 * Returns the URL of the thumbnail to read: the smallest one that is at least 64px wide, or the largest one when none is.
 * Returns null when the list has no usable URL
 */
function selectThumbnailUrl(thumbnails: readonly Thumbnail[]): string | null {
  let smallest: Thumbnail | null = null;
  let largest: Thumbnail | null = null;

  for (const thumbnail of thumbnails) {
    if (typeof thumbnail?.url !== "string" || thumbnail.url.length === 0) continue;

    if (largest === null || thumbnail.width > largest.width) largest = thumbnail;
    if (thumbnail.width < MIN_THUMBNAIL_WIDTH) continue;
    if (smallest === null || thumbnail.width < smallest.width) smallest = thumbnail;
  }

  return smallest?.url ?? largest?.url ?? null;
}

/**
 * Returns whether the URL is an https URL on one of the hosts YouTube serves the images from
 */
function isAllowedJacketUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;

    const hostname = parsed.hostname.toLowerCase();
    return ALLOWED_IMAGE_HOSTS.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

/**
 * Reads the pixels of the image at the URL, shrinks them to 64x64 and builds the Jacket colors from them.
 * Returns null for every failure (a failed request, a time out, an image Electron cannot read, an aborted read)
 */
async function readJacketColors(url: string, signal: AbortSignal): Promise<ThemeColors | null> {
  try {
    const response = await net.fetch(url, { signal });
    if (!response.ok) return null;

    const contentLength = response.headers.get("content-length");
    if (contentLength !== null && Number(contentLength) > MAX_RESPONSE_BYTES) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_RESPONSE_BYTES) return null;

    // Only PNG and JPEG are decoded here; anything else (for example WebP) becomes an empty image
    const image = nativeImage.createFromBuffer(buffer);
    if (image.isEmpty()) return null;

    const resized = image.resize({ width: JACKET_SIZE, height: JACKET_SIZE });
    const { width, height } = resized.getSize();
    if (width === 0 || height === 0) return null;

    // The raw bitmap of Electron is BGRA (see createFromBitmap in the Electron types), so the order is passed as "bgra"
    return extractJacketColors({ data: resized.toBitmap(), width, height, order: "bgra" });
  } catch (error) {
    // An aborted read is expected when the song changes, so it is not logged
    if (!signal.aborted) log.warn(`ThemeManager could not read the jacket '${url}'`, error);
    return null;
  }
}

/**
 * Watches the playing song and applies the colors made from its jacket.
 * The colors are not applied when the song has no readable jacket, when an ad is playing or when the song changed while it was read
 */
export function createJacketWatcher(dependencies: JacketWatcherDependencies): JacketWatcher {
  let listener: ((state: PlayerState) => void) | null = null;
  // Increased for every song and on stop, so only the result of the last request is applied
  let generation = 0;
  let lastUrl: string | null = null;
  let pendingRead: PendingRead | null = null;
  const cache = new Map<string, ThemeColors>();

  function abortPendingRead() {
    if (pendingRead === null) return;

    clearTimeout(pendingRead.timer);
    pendingRead.controller.abort();
    pendingRead = null;
  }

  function remember(url: string, colors: ThemeColors) {
    // Reinserted so the map keeps the order of the last use
    cache.delete(url);
    cache.set(url, colors);
    while (cache.size > CACHE_LIMIT) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  }

  function applyColors(colors: ThemeColors) {
    try {
      dependencies.apply(colors);
    } catch (error) {
      log.warn("ThemeManager could not apply the jacket colors", error);
    }
  }

  async function load(url: string, requestGeneration: number) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    pendingRead = { controller, timer };

    try {
      const colors = await readJacketColors(url, controller.signal);
      if (colors === null) return;
      // The song may have changed, or Jacket may have been left, while the image was read
      if (requestGeneration !== generation) return;

      remember(url, colors);
      applyColors(colors);
    } finally {
      clearTimeout(timer);
      if (pendingRead?.controller === controller) pendingRead = null;
    }
  }

  function selectColors(state: PlayerState) {
    if (state.adPlaying || state.videoDetails === null) return;

    const url = selectThumbnailUrl(state.videoDetails.thumbnails);
    // Without a readable jacket the colors stay as they are, so the read of the previous song is dropped here
    if (url === null || !isAllowedJacketUrl(url)) {
      generation++;
      abortPendingRead();
      lastUrl = null;
      return;
    }

    // The player reports the song again every second, and can replace the thumbnail once the queue is known
    if (url === lastUrl) return;

    lastUrl = url;
    const requestGeneration = ++generation;
    abortPendingRead();

    const cached = cache.get(url);
    if (cached !== undefined) {
      remember(url, cached);
      applyColors(cached);
      return;
    }

    load(url, requestGeneration).catch(error => {
      log.warn("ThemeManager could not load the jacket", error);
    });
  }

  function handleStateChanged(state: PlayerState) {
    try {
      selectColors(state);
    } catch (error) {
      // A listener that throws would escape into the player state update
      log.warn("ThemeManager could not select the jacket", error);
    }
  }

  return {
    start() {
      if (listener !== null) return;

      lastUrl = null;
      abortPendingRead();
      listener = handleStateChanged;
      dependencies.playerStateStore.on("state-changed", listener);
      // The song may already be playing when Jacket is selected
      handleStateChanged(dependencies.playerStateStore.getState());
    },

    stop() {
      if (listener !== null) {
        dependencies.playerStateStore.off("state-changed", listener);
        listener = null;
      }

      // Results still being read must not be applied to the theme that replaces Jacket
      generation++;
      abortPendingRead();
      lastUrl = null;
    }
  };
}
