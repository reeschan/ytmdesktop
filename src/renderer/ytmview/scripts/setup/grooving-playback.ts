// Grooving: preview a track, replace the queue and save a private playlist, on main's request.
// The steps follow what PBI-401 checked on the dev build (docs/pbi/notes/grooving.devcheck.md, sections 1, 5, 6 and 7).
import ytmhook from "../ytmhook";
import type protectedapimanager from "../protectedapimanager";
import { GROOVING_PREVIEW_START_RATIO, GroovingPageCall, type GroovingPageResult } from "~shared/grooving";
import { GroovingPacePriority } from "~shared/grooving/pace";
import { groovingPacer } from "./grooving-pace";

type GroovingProtectedAPI = ReturnType<typeof protectedapimanager.createOrGetAPI>;

// Player states of the YTM player
const PLAYER_PLAYING = 1;
const PLAYER_BUFFERING = 3;

// Upper bounds of the waits. Each handler but savePlaylist stays well under the 30 s of invokeMessage:
//   previewStart  PREVIEW_WAIT 5 + QUEUE_ADD 10 + ITEM_APPEAR 5 + PLAYBACK_SWITCH 8 = 28 s
//   savePlaylist  SAVE_WAIT 10 + INNERTUBE 15 = 25 s, plus the wait behind a replaceQueue in serialize
//                 (REPLACE_SETTLE 10 s): 35 s at worst. That is over the 30 s of invokeMessage, so main waits
//                 GROOVING_SAVE_TIMEOUT_MS (40 s, ~shared/grooving) for it
//   replaceQueue  REPLACE_SETTLE 10 s; previewEnd  PLAYBACK_SWITCH 8 + PAUSE_RECHECK 0.8 = 8.8 s
const ITEM_APPEAR_TIMEOUT_MS = 5_000;
const PLAYBACK_SWITCH_TIMEOUT_MS = 8_000;
const REPLACE_SETTLE_TIMEOUT_MS = 10_000;
const STORE_QUIET_MS = 800;
const PAUSE_RECHECK_MS = 800;
const POLL_INTERVAL_MS = 100;
// The save request itself, counted from when the pacer starts it
const INNERTUBE_TIMEOUT_MS = 15_000;
// One queueAdd request, counted inside the pacer's task so a request that never answers still frees the slot
const QUEUE_ADD_TIMEOUT_MS = 10_000;
// How long a request the user waits for may wait for its turn in the pacer: the preview's is shorter,
// since after its request it still waits for the item to appear and for playback to switch
const PREVIEW_WAIT_TIMEOUT_MS = 5_000;
const SAVE_WAIT_TIMEOUT_MS = 10_000;

// What previewStart remembers, kept until previewEnd
type PreviewMemory = {
  // null: the preview started from an empty queue. There is no track to go back to;
  // previewEnd pauses and empties the queue again
  originalVideoId: string | null;
  originalIndex: number;
  positionSeconds: number;
  wasPlaying: boolean;
  // Tracks this preview inserted and has not removed yet (normally one)
  inserted: string[];
};

let preview: PreviewMemory | null = null;

// Handlers run one at a time, so a previewEnd never interleaves with a previewStart
let chain: Promise<unknown> = Promise.resolve();

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task);
  chain = run.catch(() => undefined);
  return run;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === "string" ? err : "unknown error";
}

function handle<T>(api: GroovingProtectedAPI, name: string, label: string, run: (args: unknown[]) => Promise<GroovingPageResult<T>>) {
  api.handleMessage(name, (event: Event) =>
    serialize(async () => {
      try {
        const args = (event as CustomEvent<{ args: unknown[] }>).detail?.args ?? [];
        return [await run(args)];
      } catch (err) {
        console.error(`[ytmd-err(grooving.${label})]`, err);
        const failed: GroovingPageResult<T> = { ok: false, error: errorMessage(err) };
        return [failed];
      }
    })
  );
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

async function waitFor(condition: () => boolean, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      if (condition()) return true;
    } catch {
      /* the store or the player is between states; look again */
    }
    if (Date.now() >= deadline) return false;
    await sleep(POLL_INTERVAL_MS);
  }
}

function getStore(): any {
  const store = ytmhook.ytmStateStore?.store;
  if (!store) throw new Error("the YTM store is not ready");
  return store;
}

function getPlayer(): any {
  const player = ytmhook.ytmPlayerController?.playerApi;
  if (!player) throw new Error("the YTM player is not ready");
  return player;
}

// Read the queue again every time (other code moves it too)
function getQueue(): any {
  return getStore().getState().queue;
}

function getItems(): any[] {
  return getQueue()?.items ?? [];
}

function itemRenderer(item: any): any {
  if (!item) return null;
  if (item.playlistPanelVideoRenderer) return item.playlistPanelVideoRenderer;
  return item.playlistPanelVideoWrapperRenderer?.primaryRenderer?.playlistPanelVideoRenderer ?? null;
}

function itemVideoId(item: any): string | null {
  const renderer = itemRenderer(item);
  return renderer?.videoId ?? renderer?.navigationEndpoint?.watchEndpoint?.videoId ?? null;
}

// YTM's selectedItemIndex is not kept up to date, so look for the selected item (same as main's PlayerStateStore)
function selectedIndex(items: any[]): number {
  return items.findIndex(item => itemRenderer(item)?.selected === true);
}

function currentVideoId(): string | null {
  return getPlayer().getVideoData()?.video_id ?? null;
}

function isPlayingState(state: number) {
  return state === PLAYER_PLAYING || state === PLAYER_BUFFERING;
}

// The index of videoId in the queue, the one nearest to near, skipping the index skip
function findIndex(items: any[], videoId: string, near: number, skip = -1): number {
  let found = -1;
  for (let i = 0; i < items.length; i++) {
    if (i === skip || itemVideoId(items[i]) !== videoId) continue;
    if (found === -1 || Math.abs(i - near) < Math.abs(found - near)) found = i;
  }
  return found;
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && (err.name === "AbortError" || err.name === "TimeoutError");
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out")), timeoutMs);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      err => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

// The save request the user waits for, through the shared pacer. A wait for the turn that runs out becomes a plain failure
async function saveRequest<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await groovingPacer.run(GroovingPacePriority.User, task, AbortSignal.timeout(SAVE_WAIT_TIMEOUT_MS));
  } catch (err) {
    if (isAbortError(err)) throw new Error("timed out asking YTM");
    throw err;
  }
}

// How to ask YTM for the queue items of one track
type QueueItemsRequest = { insertAtEnd: boolean };
// The same, through the shared pacer with the given priority
type PacedQueueItemsRequest = QueueItemsRequest & { priority: GroovingPacePriority };

// Ask YTM for the queue items of one track (same as queueAdd in remote.ts). Nothing is added to the store here
function requestQueueItems(videoId: string, options: QueueItemsRequest): Promise<any[]> {
  const ytmusicAppElement = document.querySelector("ytmusic-app");
  if (!ytmusicAppElement) return Promise.reject(new Error("ytmusic-app is missing"));
  const queueAddEndpoint: Record<string, unknown> = { queueTarget: { videoId } };
  if (options.insertAtEnd) queueAddEndpoint.queueInsertPosition = "INSERT_AT_END";
  const returnValue: any[] = [];
  ytmusicAppElement.dispatchEvent(
    new CustomEvent("yt-action", {
      bubbles: true,
      cancelable: false,
      composed: true,
      detail: {
        actionName: "yt-service-request",
        args: [ytmusicAppElement, { queueAddEndpoint }],
        optionalAction: false,
        returnValue
      }
    })
  );
  const ajaxPromise = returnValue[0]?.ajaxPromise;
  if (!ajaxPromise) return Promise.reject(new Error("queueAddEndpoint gave no request"));
  return new Promise<any[]>((resolve, reject) => {
    ajaxPromise.then(
      (response: any) => {
        const queueDatas = response?.data?.queueDatas;
        resolve(Array.isArray(queueDatas) ? queueDatas.map((data: any) => data?.content).filter(Boolean) : []);
      },
      () => reject(new Error("queueAddEndpoint failed"))
    );
  });
}

// requestQueueItems through the shared pacer. The deadline sits inside the task: the ajax promise may never settle
function fetchQueueItems(videoId: string, options: PacedQueueItemsRequest, signal: AbortSignal): Promise<any[]> {
  const { insertAtEnd, priority } = options;
  return groovingPacer.run(priority, () => withTimeout(requestQueueItems(videoId, { insertAtEnd }), QUEUE_ADD_TIMEOUT_MS), signal);
}

// Never dispatch ADD_ITEMS with no items (devcheck section 5 saw YTM start another track right after one)
function addItems(items: any[], index: number) {
  if (items.length === 0) return;
  const store = getStore();
  const queue = store.getState().queue;
  store.dispatch({
    type: "ADD_ITEMS",
    payload: {
      nextQueueItemId: queue.nextQueueItemId,
      index,
      items,
      shuffleEnabled: queue.shuffleEnabled,
      shouldAssignIds: true
    }
  });
}

function removeItem(index: number) {
  getStore().dispatch({ type: "REMOVE_ITEM", payload: index });
}

// Play a queue item through its own watchEndpoint, a move inside the queue (same as playQueueIndex in remote.ts)
function playItem(item: any) {
  const watchEndpoint = itemRenderer(item)?.navigationEndpoint?.watchEndpoint;
  if (!watchEndpoint) throw new Error("the queue item has no watchEndpoint");
  document.dispatchEvent(new CustomEvent("yt-navigate", { detail: { endpoint: { watchEndpoint } } }));
}

// Wait until videoId plays, its length is known and the selected item is the one with that videoId
async function waitPlaying(videoId: string, timeoutMs: number): Promise<boolean> {
  return waitFor(() => {
    if (currentVideoId() !== videoId) return false;
    if (!(getPlayer().getDuration() > 0)) return false;
    const items = getItems();
    return itemVideoId(items[selectedIndex(items)]) === videoId;
  }, timeoutMs);
}

// Remove the tracks the preview inserted, looked up again by videoId, never the selected item
function removeInserted(memory: PreviewMemory, keep: string | null) {
  // memory.inserted is reassigned below, not changed in place, so the loop sees the list as it was
  for (const videoId of memory.inserted) {
    if (videoId === keep) continue;
    const items = getItems();
    const selected = selectedIndex(items);
    const index = findIndex(items, videoId, selected + 1, selected);
    if (index >= 0) removeItem(index);
    memory.inserted = memory.inserted.filter(id => id !== videoId);
  }
}

// The end of a preview that started from an empty queue: remove the tracks it inserted, the selected item too.
// For each, only the one item nearest to the selected one (the user or YTM may have added the same track meanwhile).
// Call it only after pausing: with the selected item gone and the player still going, YTM may play the next or an autoplay track
function removeAllInserted(memory: PreviewMemory) {
  for (const videoId of memory.inserted) {
    const items = getItems();
    const index = findIndex(items, videoId, selectedIndex(items));
    if (index >= 0) removeItem(index);
  }
  memory.inserted = [];
}

// The original track's index now: the remembered index when it still holds that track, else the nearest one.
// -1 when it is gone, and always for a preview that started from an empty queue
function findOriginal(memory: PreviewMemory): number {
  const originalVideoId = memory.originalVideoId;
  if (originalVideoId === null) return -1;
  const items = getItems();
  if (itemVideoId(items[memory.originalIndex]) === originalVideoId) return memory.originalIndex;
  return findIndex(items, originalVideoId, memory.originalIndex);
}

// The index the preview track goes right after: the original track, or for a preview that started from an empty queue
// the selected item (the track previewed now), -1 when none is selected (the track goes first)
function insertAfter(memory: PreviewMemory): number {
  if (memory.originalVideoId === null) return selectedIndex(getItems());
  return findOriginal(memory);
}

async function previewStart(args: unknown[]): Promise<GroovingPageResult<null>> {
  const videoId = args[0];
  if (typeof videoId !== "string" || videoId === "") return { ok: false, error: "videoId must be a non-empty string" };

  const player = getPlayer();
  const firstPreview = preview === null;
  if (preview === null) {
    const items = getItems();
    const selected = selectedIndex(items);
    if (items.length === 0) {
      // The queue is empty: preview the track alone, and on previewEnd pause and empty the queue again
      preview = { originalVideoId: null, originalIndex: -1, positionSeconds: 0, wasPlaying: false, inserted: [] };
    } else if (selected < 0) {
      // Items but none marked selected (YTM's mark is not always there): no track to go back to, so do not preview
      return { ok: false, error: "no track is selected" };
    } else {
      const originalVideoId = currentVideoId() ?? itemVideoId(items[selected]);
      if (!originalVideoId) return { ok: false, error: "the selected track has no videoId" };
      preview = {
        originalVideoId,
        originalIndex: selected,
        positionSeconds: Number(player.getCurrentTime()) || 0,
        wasPlaying: isPlayingState(player.getPlayerState()),
        inserted: []
      };
    }
  } else if (preview.inserted.includes(videoId) && currentVideoId() === videoId) {
    // Already previewing this track
    return { ok: true, value: null };
  }
  const memory = preview;
  const fromEmpty = memory.originalVideoId === null;

  try {
    // Fail at once when the original track is already gone, before waiting for the pacer
    if (!fromEmpty && findOriginal(memory) < 0) return { ok: false, error: "the original track is no longer in the queue" };

    // 2. Insert the track right after the original one (the fill of replaceQueue never adds between the two).
    //    From an empty queue: first at index 0, then right after the track previewed now
    let fetched: any[];
    try {
      fetched = await fetchQueueItems(
        videoId,
        { insertAtEnd: false, priority: GroovingPacePriority.User },
        AbortSignal.timeout(PREVIEW_WAIT_TIMEOUT_MS)
      );
    } catch (err) {
      // The wait for the pacer's turn ran out: fail now, well inside invokeMessage's 30 s and without holding serialize
      if (isAbortError(err)) return { ok: false, error: "timed out waiting for YTM" };
      throw err;
    }
    if (fetched.length === 0) return { ok: false, error: "YTM returned no queue item for the track" };
    // Look the original up again: the fill of replaceQueue may have added tracks before it while this waited.
    // Nothing awaits from here to the dispatch, so the fill cannot move it in between
    const anchor = insertAfter(memory);
    if (!fromEmpty && anchor < 0) return { ok: false, error: "the original track is no longer in the queue" };
    addItems(fetched, anchor + 1);
    memory.inserted.push(videoId);
    const appeared = await waitFor(() => {
      const items = getItems();
      const after = insertAfter(memory);
      return findIndex(items, videoId, after + 1, after) >= 0;
    }, ITEM_APPEAR_TIMEOUT_MS);
    if (!appeared) return { ok: false, error: "the inserted track did not appear in the queue" };

    // 3. Play it through its queue item, then wait for its length
    const items = getItems();
    const after = insertAfter(memory);
    playItem(items[findIndex(items, videoId, after + 1, after)]);
    if (!(await waitPlaying(videoId, PLAYBACK_SWITCH_TIMEOUT_MS))) return { ok: false, error: "the preview track did not start" };

    // 4. Seek to a third of the track
    player.seekTo(player.getDuration() * GROOVING_PREVIEW_START_RATIO, true);
    if (!isPlayingState(player.getPlayerState())) player.playVideo();

    // Previewing another track: the earlier inserted one is no longer selected, remove it
    removeInserted(memory, videoId);
    return { ok: true, value: null };
  } finally {
    // Nothing was inserted on the first try: there is nothing to put back
    if (firstPreview && memory.inserted.length === 0 && preview === memory) preview = null;
  }
}

async function previewEnd(): Promise<GroovingPageResult<null>> {
  const memory = preview;
  if (memory === null) return { ok: true, value: null };

  const originalVideoId = memory.originalVideoId;
  const fromEmpty = originalVideoId === null;
  let error: string | null = null;
  try {
    const player = getPlayer();

    // 5. Back to the original item, then to the remembered position
    const items = getItems();
    const original = findOriginal(memory);
    if (originalVideoId === null) {
      // From an empty queue: no track to go back to. Pause before the items are removed (else YTM may play on),
      // and once more if it still plays after a moment (devcheck section 6)
      player.pauseVideo();
      await sleep(PAUSE_RECHECK_MS);
      if (isPlayingState(player.getPlayerState())) player.pauseVideo();
    } else if (original < 0) {
      error = "the original track is no longer in the queue";
    } else {
      if (currentVideoId() !== originalVideoId || selectedIndex(items) !== original) {
        playItem(items[original]);
        if (!(await waitPlaying(originalVideoId, PLAYBACK_SWITCH_TIMEOUT_MS))) error = "the original track did not start again";
      }
      if (error === null) {
        player.seekTo(memory.positionSeconds, true);
        if (!memory.wasPlaying) {
          // It was stopped: keep it stopped. Pause once more if it still plays after a moment (devcheck section 6)
          player.pauseVideo();
          await sleep(PAUSE_RECHECK_MS);
          if (isPlayingState(player.getPlayerState())) player.pauseVideo();
        }
      }
    }
  } catch (err) {
    error = errorMessage(err);
  }

  // 6. Remove the inserted track even when going back failed; forget the memory either way.
  //    From an empty queue the selected item goes too, so the queue is empty again
  try {
    if (fromEmpty) removeAllInserted(memory);
    else removeInserted(memory, null);
  } catch (err) {
    error ??= errorMessage(err);
  } finally {
    if (preview === memory) preview = null;
  }

  return error === null ? { ok: true, value: null } : { ok: false, error };
}

// Resolves after the store has not notified for quietMs, or false at the deadline
function waitStoreQuiet(quietMs: number, deadline: number): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    const store = getStore();
    let quietTimer: ReturnType<typeof setTimeout> | null = null;
    let unsubscribe: (() => void) | null = null;
    const finish = (quiet: boolean) => {
      if (quietTimer) clearTimeout(quietTimer);
      clearTimeout(deadlineTimer);
      unsubscribe?.();
      resolve(quiet);
    };
    const restart = () => {
      if (quietTimer) clearTimeout(quietTimer);
      quietTimer = setTimeout(() => finish(true), quietMs);
    };
    const deadlineTimer = setTimeout(() => finish(false), Math.max(0, deadline - Date.now()));
    const result = store.subscribe(restart);
    unsubscribe = typeof result === "function" ? result : null;
    restart();
  });
}

// The fill of replaceQueue: one generation per replaceQueue. A newer replaceQueue moves the number on and aborts the old signal
let fillGeneration = 0;
let fillController: AbortController | null = null;

// Where the fill adds its next track: right after the track it added last (first the replaced queue's first track),
// looked up again by videoId near where it was. Tracks a preview inserted there are stepped over, so a preview track stays
// right after its original (removeInserted finds it at selected + 1). -1 when that track is gone
function fillPosition(lastVideoId: string, lastIndex: number): number {
  const items = getItems();
  const last = findIndex(items, lastVideoId, lastIndex);
  if (last < 0) return -1;
  let index = last + 1;
  while (index < items.length && preview !== null && preview.inserted.includes(itemVideoId(items[index]) ?? "")) index++;
  return index;
}

// Add the rest of a replaced queue one track at a time, outside serialize, through the pacer as background requests.
// Stops when a newer replaceQueue started (generation) or the queue's head is no longer the first track. Never rejects
async function fillQueue(generation: number, signal: AbortSignal, first: string, rest: string[]): Promise<void> {
  // Still the current replaceQueue, and the queue still starts with its first track
  const current = () => generation === fillGeneration && itemVideoId(getItems()[0]) === first;
  let lastVideoId = first;
  let lastIndex = 0;
  let skipped = 0;
  try {
    for (const videoId of rest) {
      if (!current()) return;
      let fetched: any[];
      try {
        // No wait limit here: the turn may take a while and that is fine. Only the generation's abort stops the wait
        fetched = await fetchQueueItems(videoId, { insertAtEnd: true, priority: GroovingPacePriority.Background }, signal);
      } catch {
        if (signal.aborted) return;
        skipped++;
        continue;
      }
      // From the check to the dispatch nothing awaits, so a newer replaceQueue cannot come in between
      if (!current()) return;
      if (fetched.length === 0) {
        skipped++;
        continue;
      }
      const index = fillPosition(lastVideoId, lastIndex);
      if (index < 0) return;
      addItems(fetched, index);
      lastVideoId = itemVideoId(fetched[fetched.length - 1]) ?? videoId;
      lastIndex = index + fetched.length - 1;
    }
  } catch (err) {
    console.warn("[ytmd-grooving] replaceQueue stopped adding the rest", errorMessage(err));
  } finally {
    if (skipped > 0) console.warn(`[ytmd-grooving] replaceQueue skipped ${skipped} of ${rest.length} tracks`);
    if (generation === fillGeneration) fillController = null;
  }
}

async function replaceQueue(args: unknown[]): Promise<GroovingPageResult<null>> {
  const videoIds = args[0];
  if (!Array.isArray(videoIds) || videoIds.length === 0 || !videoIds.every(id => typeof id === "string" && id !== "")) {
    return { ok: false, error: "videoIds must be a non-empty array of strings" };
  }
  const [first, ...rest] = videoIds as string[];
  const deadline = Date.now() + REPLACE_SETTLE_TIMEOUT_MS;

  // Stop the fill of the previous replaceQueue, before anything awaits: it checks the number before each add
  fillController?.abort();
  const generation = ++fillGeneration;
  const controller = new AbortController();
  fillController = controller;

  // The queue is replaced as a whole, so there is no original to go back to any more
  preview = null;

  // 1. Play the first track; YTM clears the old queue and leaves only this one
  document.dispatchEvent(new CustomEvent("yt-navigate", { detail: { endpoint: { watchEndpoint: { videoId: first } } } }));

  // 3. Wait until the first track plays alone in the queue and the store has been quiet for a while
  //    (adding earlier can be wiped by YTM's CLEAR, which comes after playback starts)
  const settled = () => {
    const queue = getQueue();
    const items = queue?.items ?? [];
    return currentVideoId() === first && items.length === 1 && itemVideoId(items[0]) === first && !queue.isGenerating;
  };
  let ready = false;
  while (!ready && Date.now() < deadline) {
    if (!(await waitFor(settled, Math.max(0, deadline - Date.now())))) break;
    if (!(await waitStoreQuiet(STORE_QUIET_MS, deadline))) break;
    ready = settled();
  }
  if (!ready) return { ok: false, error: "the queue did not settle on the first track" };

  // 2. Done for main once the first track plays alone. The rest is added behind it while it plays, outside serialize
  //    (only after the store settled: adding earlier can be wiped by YTM's CLEAR)
  if (rest.length > 0) void fillQueue(generation, controller.signal, first, rest);
  else fillController = null;
  return { ok: true, value: null };
}

function readCookie(name: string): string | null {
  for (const part of document.cookie.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return null;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, "0")).join("");
}

// The logged-in innertube call of devcheck section 1. SAPISID and the hash stay in the page and are never logged
async function innertube(path: string, body: Record<string, unknown>): Promise<any> {
  const ytcfg = (window as any).ytcfg;
  const sapisid = readCookie("SAPISID") ?? readCookie("__Secure-3PAPISID");
  if (!sapisid) throw new Error("not logged in to YouTube Music");
  if (!ytcfg?.get) throw new Error("ytcfg is missing");
  // A request the user waits for: through the pacer, with a limit on the wait. The fetch's own deadline starts with the task
  return saveRequest(async () => {
    const seconds = Math.floor(Date.now() / 1000);
    const hash = toHex(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(`${seconds} ${sapisid} ${location.origin}`)));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), INNERTUBE_TIMEOUT_MS);
    try {
      const response = await fetch(`/youtubei/v1/${path}?prettyPrint=false`, {
        method: "POST",
        credentials: "include",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `SAPISIDHASH ${seconds}_${hash}`,
          "X-Origin": location.origin,
          "X-Goog-AuthUser": String(ytcfg.get("SESSION_INDEX") ?? 0)
        },
        body: JSON.stringify({ context: ytcfg.get("INNERTUBE_CONTEXT"), ...body })
      });
      if (!response.ok) throw new Error(`${path} ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  });
}

// Not checked on the dev build yet (devcheck section 7): the body and the answer follow the planned call
async function savePlaylist(args: unknown[]): Promise<GroovingPageResult<{ playlistId: string }>> {
  const request = args[0] as { title?: unknown; videoIds?: unknown } | undefined;
  const title = request?.title;
  const videoIds = request?.videoIds;
  if (typeof title !== "string" || title === "") return { ok: false, error: "title must be a non-empty string" };
  if (!Array.isArray(videoIds) || !videoIds.every(id => typeof id === "string" && id !== "")) {
    return { ok: false, error: "videoIds must be an array of strings" };
  }

  const response = await innertube("playlist/create", { title, privacyStatus: "PRIVATE", videoIds });
  const playlistId = response?.playlistId;
  if (typeof playlistId !== "string" || playlistId === "") return { ok: false, error: "the answer has no playlistId" };
  return { ok: true, value: { playlistId } };
}

export function setupGroovingPlayback(api: GroovingProtectedAPI) {
  handle(api, GroovingPageCall.PreviewStart, "previewStart", previewStart);
  handle(api, GroovingPageCall.PreviewEnd, "previewEnd", () => previewEnd());
  handle(api, GroovingPageCall.ReplaceQueue, "replaceQueue", replaceQueue);
  handle(api, GroovingPageCall.SavePlaylist, "savePlaylist", savePlaylist);
}
