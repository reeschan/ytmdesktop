import type protectedapimanager from "../protectedapimanager";
import {
  GROOVING_FAMILIAR_MINIMUM,
  GroovingDirection,
  GroovingMoodSection,
  GroovingPageCall,
  type GroovingMoodItem,
  type GroovingPageResult,
  type GroovingSeedSong,
  type GroovingSourceRequest,
  type GroovingSources,
  type GroovingTrack
} from "~shared/grooving";
import { createGroovingCache, GROOVING_YTM_CACHE_TTL_MS, GroovingPacePriority, type GroovingCache } from "~shared/grooving/pace";
import {
  readHistoryTracks,
  readMoodCategoryPlaylists,
  readMoodsAndGenres,
  readPlaylistTracks,
  readRelatedBrowseId,
  readRelatedTracks,
  readSearchTracks,
  type GroovingRead
} from "~shared/grooving/ytm-response";
import { groovingPacer } from "./grooving-pace";

type API = ReturnType<typeof protectedapimanager.createOrGetAPI>;
// The innertube endpoints read here. The value is part of the URL (/youtubei/v1/<value>) and of the cache keys
const InnertubeEndpoint = {
  Browse: "browse",
  Next: "next",
  Search: "search"
} as const;
type InnertubeEndpoint = (typeof InnertubeEndpoint)[keyof typeof InnertubeEndpoint];
const SEARCH_SONGS = "EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D";

const RELATED_SEED_COUNT = 1;
const MOOD_PLAYLIST_COUNT = 2;
const MOODS_BROWSE_ID = "FEmusic_moods_and_genres";

// The budget of one handler call. Shorter than invokeMessage's 30 seconds, so the page answers
// { ok: false, error: "timeout" } before main gives up on the call without a reason.
const HANDLER_TIMEOUT_MS = 25_000;

// Only readable responses are kept. Keys are `<path> <JSON.stringify(body)>`.
const moodsCache = createGroovingCache<GroovingMoodItem[]>();
const tracksCache = createGroovingCache<GroovingTrack[]>();
const playlistIdsCache = createGroovingCache<string[]>();
const browseIdCache = createGroovingCache<string>();

async function innertube(path: InnertubeEndpoint, body: Record<string, unknown>, signal: AbortSignal): Promise<unknown> {
  const config = (window as unknown as { ytcfg?: { get: (key: string) => unknown } }).ytcfg;
  const cookies = document.cookie.split(";").map(part => part.trim());
  const cookie = (name: string) => cookies.find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
  const sapisid = cookie("SAPISID") || cookie("__Secure-3PAPISID");
  if (!sapisid || !config?.get || !config.get("INNERTUBE_CONTEXT")) throw new Error("authentication-unavailable");
  const request = async () => {
    const seconds = Math.floor(Date.now() / 1000);
    const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(`${seconds} ${sapisid} ${location.origin}`));
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    const response = await fetch(`/youtubei/v1/${path}?prettyPrint=false`, {
      method: "POST",
      credentials: "include",
      signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `SAPISIDHASH ${seconds}_${hash}`,
        "X-Origin": location.origin,
        "X-Goog-AuthUser": String((config.get("SESSION_INDEX") as string | number | undefined) ?? 0)
      },
      body: JSON.stringify({ context: config.get("INNERTUBE_CONTEXT"), ...body })
    });
    if (!response.ok) throw new Error(`${path}:http-${response.status}`);
    return (await response.json()) as unknown;
  };
  return groovingPacer.run(GroovingPacePriority.User, request, signal);
}

// ttlMs: how long a readable response is kept (default GROOVING_YTM_CACHE_TTL_MS; null keeps it with no expiry)
type FetchReadOptions = { ttlMs?: number | null };

async function fetchRead<T>(
  path: InnertubeEndpoint,
  body: Record<string, unknown>,
  reader: (json: unknown) => GroovingRead<T>,
  cache: GroovingCache<T>,
  signal: AbortSignal,
  options: FetchReadOptions = {}
): Promise<T> {
  const ttlMs = options.ttlMs === undefined ? GROOVING_YTM_CACHE_TTL_MS : options.ttlMs;
  const key = `${path} ${JSON.stringify(body)}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const result = reader(await innertube(path, body, signal));
  if (!result.ok) throw new Error(`${path}:unreadable`);
  cache.set(key, result.value, ttlMs);
  return result.value;
}

async function optional<T>(task: Promise<T>): Promise<T | null> {
  try {
    return await task;
  } catch {
    return null;
  }
}

// Also used by the continuation's Related call (grooving-playback.ts)
export async function relatedTracks(history: GroovingTrack[], signal: AbortSignal): Promise<GroovingTrack[]> {
  const results = await Promise.all(
    history
      .slice(0, RELATED_SEED_COUNT)
      .map(async track => {
        const id = await fetchRead(InnertubeEndpoint.Next, { videoId: track.videoId, isAudioOnly: true }, readRelatedBrowseId, browseIdCache, signal);
        return optional(fetchRead(InnertubeEndpoint.Browse, { browseId: id }, readRelatedTracks, tracksCache, signal));
      })
      .map(optional)
  );
  return results.flatMap(tracks => tracks ?? []);
}

async function moodTracks(params: string, signal: AbortSignal, playlistCount = MOOD_PLAYLIST_COUNT): Promise<GroovingTrack[] | null> {
  const ids = await fetchRead(
    InnertubeEndpoint.Browse,
    { browseId: "FEmusic_moods_and_genres_category", params },
    readMoodCategoryPlaylists,
    playlistIdsCache,
    signal
  );
  const playlists = await Promise.all(
    ids.slice(0, playlistCount).map(id => optional(fetchRead(InnertubeEndpoint.Browse, { browseId: id }, readPlaylistTracks, tracksCache, signal)))
  );
  return playlists.some(tracks => tracks !== null) ? playlists.flatMap(tracks => tracks ?? []) : null;
}

// A blend reads only the genres' playlists (the moods item is left to the LLM's search).
// MOOD_PLAYLIST_COUNT playlists are shared among the genres: 2 for one genre, 1 each for two.
// Never fails: a genre that cannot be read adds nothing, and the search fills up.
async function blendTracks(items: unknown[], signal: AbortSignal): Promise<GroovingTrack[]> {
  const genres = items.filter(
    (item): item is GroovingMoodItem =>
      typeof item === "object" &&
      item !== null &&
      (item as GroovingMoodItem).section === GroovingMoodSection.Genres &&
      typeof (item as GroovingMoodItem).params === "string"
  );
  if (genres.length === 0) return [];
  const playlistCount = Math.max(1, Math.floor(MOOD_PLAYLIST_COUNT / genres.length));
  const results = await Promise.all(genres.map(genre => optional(moodTracks(genre.params, signal, playlistCount))));
  return results.flatMap(tracks => tracks ?? []);
}

// The seed song of a "From a song" run: the track playing now (its videoId) or the first search result for
// "<title> <artist>" when the song was recognized (videoId null). null when it is not on YouTube Music
async function seedTrack(song: GroovingSeedSong, signal: AbortSignal): Promise<GroovingTrack | null> {
  if (song.videoId !== null) return { videoId: song.videoId, title: song.title, artists: [song.artist], thumbnailUrl: song.thumbnail };
  const found = await search([`${song.title} ${song.artist}`.trim()], signal);
  return found[0] ?? null;
}

// Below GROOVING_FAMILIAR_MINIMUM the related tracks are short, so the seed artist's songs fill the mood up.
// The added tracks keep the same shape as the mood's playlists, so the existing "filled" mark tells about them
async function fillFromSeedArtist(mood: GroovingTrack[], artist: string, signal: AbortSignal): Promise<GroovingTrack[]> {
  const name = artist.trim();
  if (name === "" || mood.length >= GROOVING_FAMILIAR_MINIMUM) return mood;
  const found = await optional(search([name], signal));
  return found && found.length > 0 ? [...mood, ...found] : mood;
}

async function collectSources(request: GroovingSourceRequest, signal: AbortSignal): Promise<GroovingSources> {
  if (
    !request ||
    !Object.values(GroovingDirection).includes(request.direction) ||
    typeof request.historyShared !== "boolean" ||
    !request.mood ||
    (request.mood.kind !== "text" && request.mood.kind !== "item" && request.mood.kind !== "blend" && request.mood.kind !== "song") ||
    (request.mood.kind === "blend" && !Array.isArray(request.mood.items))
  )
    throw new Error("invalid-request");
  const seed = request.mood.kind === "song" ? request.mood.song : null;
  // The seed song is looked up first: when it cannot be found, the other lists are not read and the run fails with seed-not-found
  const seedFound = seed === null ? null : await seedTrack(seed, signal);
  if (seed !== null && seedFound === null) return { history: [], liked: [], related: [], mood: [], seedMissing: true };

  const historyTask = optional(fetchRead(InnertubeEndpoint.Browse, { browseId: "FEmusic_history" }, readHistoryTracks, tracksCache, signal));
  const likedTask = optional(fetchRead(InnertubeEndpoint.Browse, { browseId: "VLLM" }, readPlaylistTracks, tracksCache, signal));
  // A song's related tracks (mood) take the place of the history's related tracks, so those are not read
  const relatedTask =
    seed === null && request.historyShared && request.direction !== GroovingDirection.Discover
      ? historyTask.then(history => (history ? relatedTracks(history, signal) : []))
      : Promise.resolve([]);
  const moodTask =
    seedFound !== null
      ? relatedTracks([seedFound], signal)
      : request.mood.kind === "item"
        ? optional(moodTracks(request.mood.item.params, signal))
        : request.mood.kind === "blend"
          ? blendTracks(request.mood.items, signal)
          : Promise.resolve(null);
  const [history, liked, mood, related] = await Promise.all([historyTask, likedTask, moodTask, relatedTask]);
  if (history === null && liked === null) throw new Error("sources:unreadable");
  if (request.mood.kind === "item" && request.direction !== GroovingDirection.Familiar && (!mood || mood.length === 0))
    throw new Error("mood:unreadable");
  const moodList = mood ?? [];
  if (seedFound !== null) {
    const filled = await fillFromSeedArtist(moodList, seedFound.artists[0] ?? "", signal);
    return {
      history: history ?? [],
      liked: liked ?? [],
      related,
      mood: filled,
      seedVideoId: seedFound.videoId,
      seedFilled: filled.length > moodList.length
    };
  }
  return { history: history ?? [], liked: liked ?? [], related, mood: moodList };
}

async function search(queries: string[], signal: AbortSignal): Promise<GroovingTrack[]> {
  if (!Array.isArray(queries) || queries.some(query => typeof query !== "string")) throw new Error("invalid-request");
  if (queries.length === 0) return [];
  const results = await Promise.all(
    queries.map(query => optional(fetchRead(InnertubeEndpoint.Search, { query, params: SEARCH_SONGS }, readSearchTracks, tracksCache, signal)))
  );
  if (results.every(result => result === null)) throw new Error("search:unreadable");
  return results.flatMap(result => result ?? []);
}

// The abort reasons tell a deadline apart from Grooving being closed
const Stop = { Timeout: "timeout", Cancelled: "cancelled" } as const;

// The controllers of the calls in progress. Each call adds its own and removes it when it ends,
// so a cancelled controller is never used again.
const running = new Set<AbortController>();

async function deadline<T>(run: (signal: AbortSignal) => Promise<T>): Promise<GroovingPageResult<T>> {
  const controller = new AbortController();
  running.add(controller);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Listens before run does, so an abort answers with its reason even when run fails at the same time
    const stopped = new Promise<GroovingPageResult<T>>(resolve => {
      controller.signal.addEventListener(
        "abort",
        () => resolve({ ok: false, error: controller.signal.reason === Stop.Cancelled ? Stop.Cancelled : Stop.Timeout }),
        { once: true }
      );
      timer = setTimeout(() => controller.abort(Stop.Timeout), HANDLER_TIMEOUT_MS);
    });
    return await Promise.race([stopped, run(controller.signal).then(value => ({ ok: true as const, value }))]);
  } finally {
    clearTimeout(timer);
    running.delete(controller);
  }
}

// Grooving was closed: the calls in progress stop (those waiting in the pacer do not start, fetches are aborted)
// and answer { ok: false, error: "cancelled" }. The caches are kept.
export function cancelGroovingYtm(): void {
  for (const controller of running) controller.abort(Stop.Cancelled);
}

export function setupGroovingYtm(api: API): void {
  api.handleMessage(GroovingPageCall.GetMoods, async () => {
    try {
      return [
        await deadline(signal =>
          fetchRead(InnertubeEndpoint.Browse, { browseId: MOODS_BROWSE_ID }, readMoodsAndGenres, moodsCache, signal, { ttlMs: null })
        )
      ];
    } catch {
      return [{ ok: false, error: "moods:unreadable" }];
    }
  });
  api.handleMessage(GroovingPageCall.CollectSources, async event => {
    try {
      return [await deadline(signal => collectSources((event as CustomEvent<{ args: GroovingSourceRequest[] }>).detail.args[0], signal))];
    } catch {
      return [{ ok: false, error: "sources:unreadable" }];
    }
  });
  api.handleMessage(GroovingPageCall.Search, async event => {
    try {
      return [await deadline(signal => search((event as CustomEvent<{ args: string[][] }>).detail.args[0], signal))];
    } catch {
      return [{ ok: false, error: "search:unreadable" }];
    }
  });
}
