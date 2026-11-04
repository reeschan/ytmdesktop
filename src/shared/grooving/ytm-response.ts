import { GroovingMoodItem, GroovingMoodSection, GroovingTrack } from "./index";

// Reads the JSON of the YTM internal API (browse / next / search) into Grooving's tracks and mood items.
// The shapes were checked on the development build (2026-11-03).
// When YTM changes a shape, the readers return { ok: false } instead of throwing, so Grooving can report it.
// This module is imported by the page script too, so it must not import anything but ./index.

export type GroovingRead<T> = { ok: true; value: T } | { ok: false };

const UNREADABLE: { ok: false } = { ok: false };
const read = <T>(value: T): GroovingRead<T> => ({ ok: true, value });

type PathKey = string | number;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

// Follows a path of keys and indexes, returning undefined as soon as a step does not exist
function at(value: unknown, ...path: PathKey[]): unknown {
  let current = value;
  for (const key of path) {
    if (typeof key === "number") {
      if (!Array.isArray(current)) return undefined;
      current = current[key];
    } else {
      if (!isRecord(current)) return undefined;
      current = current[key];
    }
  }
  return current;
}

function arrayAt(value: unknown, ...path: PathKey[]): unknown[] | null {
  const found = at(value, ...path);
  return Array.isArray(found) ? found : null;
}

function stringAt(value: unknown, ...path: PathKey[]): string | null {
  const found = at(value, ...path);
  return typeof found === "string" && found.trim() !== "" ? found : null;
}

const PAGE_TYPE = ["browseEndpointContextSupportedConfigs", "browseEndpointContextMusicConfig", "pageType"];
const BROWSE_PAGE_TYPE = ["navigationEndpoint", "browseEndpoint", ...PAGE_TYPE];
const MUSIC_VIDEO_TYPE = [
  "overlay",
  "musicItemThumbnailOverlayRenderer",
  "content",
  "musicPlayButtonRenderer",
  "playNavigationEndpoint",
  "watchEndpoint",
  "watchEndpointMusicSupportedConfigs",
  "watchEndpointMusicConfig",
  "musicVideoType"
];
const PAGE_TYPE_ARTIST = "MUSIC_PAGE_TYPE_ARTIST";
const PAGE_TYPE_ALBUM = "MUSIC_PAGE_TYPE_ALBUM";
const PAGE_TYPE_TRACK_RELATED = "MUSIC_PAGE_TYPE_TRACK_RELATED";
const VIDEO_TYPE_PODCAST_EPISODE = "MUSIC_VIDEO_TYPE_PODCAST_EPISODE";

// Runs that only separate names (" • ", "、", " & ", ", ")
const SEPARATOR_RUN = /^\s*(•|、|&|,|，)?\s*$/;
// The run that separates the artists from the album, the year, the views or the length
const SECTION_RUN = /^\s*•\s*$/;

type Run = { text: string; pageType: string | null };

function runsAt(value: unknown, ...path: PathKey[]): Run[] {
  const runs = arrayAt(value, ...path) ?? [];
  const result: Run[] = [];
  for (const run of runs) {
    const text = at(run, "text");
    if (typeof text !== "string") continue;
    const pageType = at(run, ...BROWSE_PAGE_TYPE);
    result.push({ text, pageType: typeof pageType === "string" ? pageType : null });
  }
  return result;
}

const flexColumnRuns = (row: unknown, column: number): Run[] =>
  runsAt(row, "flexColumns", column, "musicResponsiveListItemFlexColumnRenderer", "text", "runs");

// The artists of a track row: the runs that link to an artist page, or else the names before the first " • "
function readArtists(runs: Run[]): string[] {
  const linked = runs.filter(run => run.pageType === PAGE_TYPE_ARTIST).map(run => run.text.trim());
  if (linked.length > 0) return linked.filter(name => name !== "");
  const sectionEnd = runs.findIndex(run => SECTION_RUN.test(run.text));
  const names = sectionEnd === -1 ? runs : runs.slice(0, sectionEnd);
  return names
    .filter(run => run.pageType !== PAGE_TYPE_ALBUM && !SEPARATOR_RUN.test(run.text))
    .map(run => run.text.trim())
    .filter(name => name !== "");
}

// The largest thumbnail (YTM lists them from small to large)
function readThumbnailUrl(thumbnails: unknown[] | null): string | null {
  if (!thumbnails) return null;
  for (let i = thumbnails.length - 1; i >= 0; i--) {
    const url = stringAt(thumbnails[i], "url");
    if (url) return url;
  }
  return null;
}

type RowRead = { kind: "track"; track: GroovingTrack } | { kind: "skip" } | { kind: "broken" };

// Reads one musicResponsiveListItemRenderer. Rows without a videoId (such as "shuffle all") and podcast episodes are skipped
function readTrackRow(row: unknown): RowRead {
  const videoId = stringAt(row, "playlistItemData", "videoId");
  if (!videoId) return { kind: "skip" };
  if (at(row, ...MUSIC_VIDEO_TYPE) === VIDEO_TYPE_PODCAST_EPISODE) return { kind: "skip" };
  const title = flexColumnRuns(row, 0)
    .map(run => run.text)
    .join("")
    .trim();
  if (!title) return { kind: "broken" };
  const artists = readArtists(flexColumnRuns(row, 1));
  const thumbnailUrl = readThumbnailUrl(arrayAt(row, "thumbnail", "musicThumbnailRenderer", "thumbnail", "thumbnails"));
  return { kind: "track", track: { videoId, title, artists, thumbnailUrl } };
}

// Reads the track rows of the given lists of items. A missing list is empty (a shelf with no rows);
// fails only when rows exist but none could be read
function readTrackRows(itemLists: (unknown[] | null)[]): GroovingRead<GroovingTrack[]> {
  const tracks: GroovingTrack[] = [];
  let broken = 0;
  for (const items of itemLists) {
    for (const item of items ?? []) {
      const row = at(item, "musicResponsiveListItemRenderer");
      if (row === undefined) continue;
      const result = readTrackRow(row);
      if (result.kind === "track") tracks.push(result.track);
      else if (result.kind === "broken") broken++;
    }
  }
  if (tracks.length === 0 && broken > 0) return UNREADABLE;
  return read(tracks);
}

// The renderers of one kind inside a sectionListRenderer's contents, in order
function sectionRenderers(sectionContents: unknown[], renderer: string): unknown[] {
  return sectionContents.map(section => at(section, renderer)).filter(isRecord);
}

const singleColumnSections = (json: unknown): unknown[] | null =>
  arrayAt(json, "contents", "singleColumnBrowseResultsRenderer", "tabs", 0, "tabRenderer", "content", "sectionListRenderer", "contents");

const MOOD_SECTION_BY_GRID_INDEX: GroovingMoodSection[] = [GroovingMoodSection.Moods, GroovingMoodSection.Genres];

// FEmusic_moods_and_genres. The sections are told apart by position: with 3 or more grids, the 1st is the per-user
// recommendations (not read), the 2nd is the moods and activities, the 3rd is the genres. With exactly 2 grids (a user
// without recommendations), the 1st is the moods and the 2nd the genres. Their names come in the hl language, so names are not used.
export function readMoodsAndGenres(json: unknown): GroovingRead<GroovingMoodItem[]> {
  const sections = singleColumnSections(json);
  if (!sections) return UNREADABLE;
  const grids = sectionRenderers(sections, "gridRenderer");
  if (grids.length < 2) return UNREADABLE;
  const first = grids.length === 2 ? 0 : 1;
  const moods: GroovingMoodItem[] = [];
  for (const [index, section] of MOOD_SECTION_BY_GRID_INDEX.entries()) {
    const items = arrayAt(grids[first + index], "items");
    if (!items) return UNREADABLE;
    for (const item of items) {
      const button = at(item, "musicNavigationButtonRenderer");
      const name = runsAt(button, "buttonText", "runs")
        .map(run => run.text)
        .join("")
        .trim();
      const params = stringAt(button, "clickCommand", "browseEndpoint", "params");
      if (name && params) moods.push({ name, section, params });
    }
  }
  if (moods.length === 0) return UNREADABLE;
  return read(moods);
}

// FEmusic_moods_and_genres_category: the browseIds (VL...) of the playlists in the carousels, without duplicates
export function readMoodCategoryPlaylists(json: unknown): GroovingRead<string[]> {
  const sections = singleColumnSections(json);
  if (!sections) return UNREADABLE;
  const carousels = sectionRenderers(sections, "musicCarouselShelfRenderer");
  if (carousels.length === 0) return UNREADABLE;
  const browseIds: string[] = [];
  for (const carousel of carousels) {
    for (const item of arrayAt(carousel, "contents") ?? []) {
      const browseId = stringAt(item, "musicTwoRowItemRenderer", "navigationEndpoint", "browseEndpoint", "browseId");
      if (browseId && browseId.startsWith("VL") && !browseIds.includes(browseId)) browseIds.push(browseId);
    }
  }
  if (browseIds.length === 0) return UNREADABLE;
  return read(browseIds);
}

// The track readers below: once the outer shape is there, no shelf, a shelf without contents and no rows are an empty list
// (a new user with no history, no liked songs, no search results). Only a missing outer shape is unreadable.

// browse "VL" + playlistId: a mood playlist, or the liked songs (VLLM). The outer shape is twoColumnBrowseResultsRenderer,
// since secondaryContents may be missing when there are no liked songs
export function readPlaylistTracks(json: unknown): GroovingRead<GroovingTrack[]> {
  const twoColumn = at(json, "contents", "twoColumnBrowseResultsRenderer");
  if (!isRecord(twoColumn)) return UNREADABLE;
  const sections = arrayAt(twoColumn, "secondaryContents", "sectionListRenderer", "contents") ?? [];
  const shelves = sectionRenderers(sections, "musicPlaylistShelfRenderer");
  return readTrackRows(shelves.map(shelf => arrayAt(shelf, "contents")));
}

// FEmusic_history: one musicShelfRenderer per period (today, yesterday, ...)
export function readHistoryTracks(json: unknown): GroovingRead<GroovingTrack[]> {
  const sections = singleColumnSections(json);
  if (!sections) return UNREADABLE;
  const shelves = sectionRenderers(sections, "musicShelfRenderer");
  return readTrackRows(shelves.map(shelf => arrayAt(shelf, "contents")));
}

// next: the browseId (MPTRt_...) of the related tab, found by its page type rather than its position or name
export function readRelatedBrowseId(json: unknown): GroovingRead<string> {
  const tabs = arrayAt(json, "contents", "singleColumnMusicWatchNextResultsRenderer", "tabbedRenderer", "watchNextTabbedResultsRenderer", "tabs");
  if (!tabs) return UNREADABLE;
  for (const tab of tabs) {
    const browseEndpoint = at(tab, "tabRenderer", "endpoint", "browseEndpoint");
    if (at(browseEndpoint, ...PAGE_TYPE) !== PAGE_TYPE_TRACK_RELATED) continue;
    const browseId = stringAt(browseEndpoint, "browseId");
    if (browseId) return read(browseId);
  }
  return UNREADABLE;
}

// browse of the related tab's browseId: the track rows of the carousels (the playlist and artist carousels are skipped)
export function readRelatedTracks(json: unknown): GroovingRead<GroovingTrack[]> {
  const sections = arrayAt(json, "contents", "sectionListRenderer", "contents");
  if (!sections) return UNREADABLE;
  const carousels = sectionRenderers(sections, "musicCarouselShelfRenderer");
  return readTrackRows(carousels.map(carousel => arrayAt(carousel, "contents")));
}

// search filtered to songs: the rows of the musicShelfRenderer in the first tab
export function readSearchTracks(json: unknown): GroovingRead<GroovingTrack[]> {
  const sections = arrayAt(json, "contents", "tabbedSearchResultsRenderer", "tabs", 0, "tabRenderer", "content", "sectionListRenderer", "contents");
  if (!sections) return UNREADABLE;
  const shelves = sectionRenderers(sections, "musicShelfRenderer");
  return readTrackRows(shelves.map(shelf => arrayAt(shelf, "contents")));
}
