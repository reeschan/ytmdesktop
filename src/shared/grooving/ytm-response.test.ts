import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GroovingMoodSection } from "./index";
import {
  GroovingRead,
  readHistoryTracks,
  readMoodCategoryPlaylists,
  readMoodsAndGenres,
  readPlaylistTracks,
  readRelatedBrowseId,
  readRelatedTracks,
  readSearchTracks
} from "./ytm-response";

// Each test reads a fresh copy, so a test can cut keys out of it
const fixture = (name: string): Record<string, unknown> => JSON.parse(readFileSync(new URL(`./__fixtures__/${name}.json`, import.meta.url), "utf8"));

// Follows the path and deletes the last key, to break a fixture the way a YTM change would
function removeKey(json: unknown, path: (string | number)[]): unknown {
  let current = json as Record<string | number, unknown>;
  for (const key of path.slice(0, -1)) current = current[key] as Record<string | number, unknown>;
  const last = path[path.length - 1];
  expect(current[last]).toBeDefined();
  delete current[last];
  return json;
}

const thumb = (n: number): string => `https://example.invalid/thumb/${n}.jpg`;

function value<T>(result: GroovingRead<T>): T {
  if (!result.ok) throw new Error("expected the response to be read");
  return result.value;
}

// The shapes every reader must reject: not an object, an empty object, a wrong type at the top
const broken: [string, unknown][] = [
  ["null", null],
  ["undefined", undefined],
  ["an empty object", {}],
  ["a string", "contents"],
  ["an array", []],
  ["contents of a wrong type", { contents: 42 }]
];

const SINGLE_COLUMN_SECTIONS = [
  "contents",
  "singleColumnBrowseResultsRenderer",
  "tabs",
  0,
  "tabRenderer",
  "content",
  "sectionListRenderer",
  "contents"
];
const PLAYLIST_SECTIONS = ["contents", "twoColumnBrowseResultsRenderer", "secondaryContents", "sectionListRenderer", "contents"];
const ROW = "musicResponsiveListItemRenderer";
const TITLE_COLUMN = ["flexColumns", 0];

describe("readMoodsAndGenres", () => {
  it("reads the 2nd grid as moods and the 3rd as genres, skipping the recommendations", () => {
    expect(value(readMoodsAndGenres(fixture("moods-and-genres")))).toEqual([
      { name: "エナジー", section: GroovingMoodSection.Moods, params: "ggMPOg1uX2lRZUZiMnNrQnJW" },
      { name: "ゲーム", section: GroovingMoodSection.Moods, params: "ggMPOg1uX3NmUVV4Vzl3WGQ0" },
      { name: "スリープ", section: GroovingMoodSection.Moods, params: "ggMPOg1uX1MxaFQ3Z0JMZkN4" },
      { name: "J-Pop", section: GroovingMoodSection.Genres, params: "ggMPOg1uX1R6ZWQ0MTBwOUp5" },
      { name: "J-Rock", section: GroovingMoodSection.Genres, params: "ggMPOg1uX0NzY1lVNktUZ1Z4" },
      { name: "K-Pop", section: GroovingMoodSection.Genres, params: "ggMPOg1uX0JrbjBDOFFPSzJW" }
    ]);
  });

  it.each(broken)("is unreadable for %s", (_, json) => {
    expect(readMoodsAndGenres(json)).toEqual({ ok: false });
  });

  it("is unreadable when the section list is gone", () => {
    expect(readMoodsAndGenres(removeKey(fixture("moods-and-genres"), SINGLE_COLUMN_SECTIONS))).toEqual({ ok: false });
  });

  it("reads the 1st grid as moods and the 2nd as genres when there are exactly 2 grids (no recommendations)", () => {
    expect(value(readMoodsAndGenres(removeKey(fixture("moods-and-genres"), [...SINGLE_COLUMN_SECTIONS, 0, "gridRenderer"])))).toEqual([
      { name: "エナジー", section: GroovingMoodSection.Moods, params: "ggMPOg1uX2lRZUZiMnNrQnJW" },
      { name: "ゲーム", section: GroovingMoodSection.Moods, params: "ggMPOg1uX3NmUVV4Vzl3WGQ0" },
      { name: "スリープ", section: GroovingMoodSection.Moods, params: "ggMPOg1uX1MxaFQ3Z0JMZkN4" },
      { name: "J-Pop", section: GroovingMoodSection.Genres, params: "ggMPOg1uX1R6ZWQ0MTBwOUp5" },
      { name: "J-Rock", section: GroovingMoodSection.Genres, params: "ggMPOg1uX0NzY1lVNktUZ1Z4" },
      { name: "K-Pop", section: GroovingMoodSection.Genres, params: "ggMPOg1uX0JrbjBDOFFPSzJW" }
    ]);
  });

  it("is unreadable when there is only 1 grid", () => {
    const json = fixture("moods-and-genres");
    for (const section of [0, 1]) removeKey(json, [...SINGLE_COLUMN_SECTIONS, section, "gridRenderer"]);
    expect(readMoodsAndGenres(json)).toEqual({ ok: false });
  });

  it("is unreadable when a grid has no items", () => {
    expect(readMoodsAndGenres(removeKey(fixture("moods-and-genres"), [...SINGLE_COLUMN_SECTIONS, 1, "gridRenderer", "items"]))).toEqual({
      ok: false
    });
  });

  it("is unreadable when no item has params", () => {
    const json = fixture("moods-and-genres");
    for (const grid of [1, 2]) {
      for (const item of [0, 1, 2]) {
        removeKey(json, [...SINGLE_COLUMN_SECTIONS, grid, "gridRenderer", "items", item, "musicNavigationButtonRenderer", "clickCommand"]);
      }
    }
    expect(readMoodsAndGenres(json)).toEqual({ ok: false });
  });
});

describe("readMoodCategoryPlaylists", () => {
  it("reads the browseIds of the playlists in all the carousels", () => {
    expect(value(readMoodCategoryPlaylists(fixture("mood-category")))).toEqual([
      "VLRDCLAK5uy_mVJ3RRi_YBfUJnZnQxLAedQQcXHujbUcg",
      "VLRDCLAK5uy_kPqJ_FiGk-lbXtgM4IF42uokskSJZiVTI",
      "VLRDCLAK5uy_lGEOjy5U8xV41C8_LyqNnAZKOH6sGyutI",
      "VLRDCLAK5uy_miMSxuvE6h6QxKk8pnABxR-CbiRcA5KiI",
      "VLRDCLAK5uy_k6PkYWus1Mt-aKrbb0Ne8SkA2BgAk1Yy4",
      "VLRDCLAK5uy_nBQm8_YpP--R6zU8p3dypKm1QKqzWY6qU",
      "VLRDCLAK5uy_k1VVBVsS6pu1pVkYZK2B0EWic3i4j_TY4",
      "VLRDCLAK5uy_kP2172rQNb3KFXz880xp6M98R_ME5CIKA",
      "VLRDCLAK5uy_lBGRuQnsG37Akr1CY4SxL0VWFbPrbO4gs"
    ]);
  });

  it.each(broken)("is unreadable for %s", (_, json) => {
    expect(readMoodCategoryPlaylists(json)).toEqual({ ok: false });
  });

  it("is unreadable when the carousels are gone", () => {
    const json = fixture("mood-category");
    for (const section of [0, 1, 2]) removeKey(json, [...SINGLE_COLUMN_SECTIONS, section, "musicCarouselShelfRenderer"]);
    expect(readMoodCategoryPlaylists(json)).toEqual({ ok: false });
  });

  it("is unreadable when no playlist has a browseId", () => {
    const json = fixture("mood-category");
    for (const section of [0, 1, 2]) {
      for (const item of [0, 1, 2]) {
        removeKey(json, [
          ...SINGLE_COLUMN_SECTIONS,
          section,
          "musicCarouselShelfRenderer",
          "contents",
          item,
          "musicTwoRowItemRenderer",
          "navigationEndpoint"
        ]);
      }
    }
    expect(readMoodCategoryPlaylists(json)).toEqual({ ok: false });
  });
});

describe("readPlaylistTracks", () => {
  it("reads the tracks of a playlist, leaving out the play count, the album and the continuation", () => {
    expect(value(readPlaylistTracks(fixture("playlist")))).toEqual([
      { videoId: "hcpa-L_6ssk", title: "Title 9", artists: ["Artist 10"], thumbnailUrl: thumb(34) },
      { videoId: "_GWKkqNoyEA", title: "Title 10", artists: ["Artist 11"], thumbnailUrl: thumb(36) },
      { videoId: "kIft-LUHHVA", title: "Title 11", artists: ["Artist 12"], thumbnailUrl: thumb(38) }
    ]);
  });

  it("reads the liked songs (VLLM), which have the playlist's shape", () => {
    expect(value(readPlaylistTracks(fixture("liked")))).toEqual([
      { videoId: "av9hRwPuhpw", title: "Title 7", artists: ["Artist 1"], thumbnailUrl: thumb(8) },
      { videoId: "KIT_12UkyFM", title: "Title 8", artists: ["Artist 9"], thumbnailUrl: thumb(10) }
    ]);
  });

  it.each(broken)("is unreadable for %s", (_, json) => {
    expect(readPlaylistTracks(json)).toEqual({ ok: false });
  });

  it("is empty when the playlist shelf is gone", () => {
    expect(readPlaylistTracks(removeKey(fixture("playlist"), [...PLAYLIST_SECTIONS, 0, "musicPlaylistShelfRenderer"]))).toEqual({
      ok: true,
      value: []
    });
  });

  it("is empty when the shelf has no contents (no liked songs)", () => {
    expect(readPlaylistTracks(removeKey(fixture("liked"), [...PLAYLIST_SECTIONS, 0, "musicPlaylistShelfRenderer", "contents"]))).toEqual({
      ok: true,
      value: []
    });
  });

  it("is empty when the secondary contents are gone (no liked songs)", () => {
    expect(readPlaylistTracks(removeKey(fixture("liked"), ["contents", "twoColumnBrowseResultsRenderer", "secondaryContents"]))).toEqual({
      ok: true,
      value: []
    });
  });

  it("is unreadable when the two-column renderer is gone", () => {
    expect(readPlaylistTracks(removeKey(fixture("liked"), ["contents", "twoColumnBrowseResultsRenderer"]))).toEqual({ ok: false });
  });

  it("is unreadable when the rows have no titles", () => {
    const json = fixture("liked");
    for (const row of [0, 1]) removeKey(json, [...PLAYLIST_SECTIONS, 0, "musicPlaylistShelfRenderer", "contents", row, ROW, ...TITLE_COLUMN]);
    expect(readPlaylistTracks(json)).toEqual({ ok: false });
  });

  it("is not a history or search response", () => {
    expect(readPlaylistTracks(fixture("history"))).toEqual({ ok: false });
    expect(readPlaylistTracks(fixture("search"))).toEqual({ ok: false });
  });
});

describe("readHistoryTracks", () => {
  it("reads the tracks of every day's shelf, with all the artists and without the views", () => {
    expect(value(readHistoryTracks(fixture("history")))).toEqual([
      { videoId: "Tkx4HOLIrEM", title: "Title 1", artists: ["Artist 1", "Artist 2", "Artist 3", "Artist 4"], thumbnailUrl: thumb(2) },
      { videoId: "c5qJc8ArTUo", title: "Title 2", artists: ["Artist 5"], thumbnailUrl: thumb(3) },
      { videoId: "HXJZ5sigL-E", title: "Title 3", artists: ["Artist 6"], thumbnailUrl: thumb(4) },
      { videoId: "SySRldWdFs0", title: "Title 4", artists: ["Artist 7"], thumbnailUrl: thumb(5) },
      { videoId: "OWDcn7hl16A", title: "Title 5", artists: ["Artist 8"], thumbnailUrl: thumb(6) },
      { videoId: "M1GYqy0tHV0", title: "Title 6", artists: ["Artist 1"], thumbnailUrl: thumb(7) }
    ]);
  });

  it("leaves out podcast episodes", () => {
    const json = fixture("history");
    const row = [...SINGLE_COLUMN_SECTIONS, 0, "musicShelfRenderer", "contents", 1, ROW];
    let config = json as Record<string, unknown>;
    for (const key of [
      ...row,
      "overlay",
      "musicItemThumbnailOverlayRenderer",
      "content",
      "musicPlayButtonRenderer",
      "playNavigationEndpoint",
      "watchEndpoint",
      "watchEndpointMusicSupportedConfigs",
      "watchEndpointMusicConfig"
    ]) {
      config = config[key] as Record<string, unknown>;
    }
    config.musicVideoType = "MUSIC_VIDEO_TYPE_PODCAST_EPISODE";
    expect(value(readHistoryTracks(json)).map(track => track.videoId)).not.toContain("c5qJc8ArTUo");
  });

  it("skips a row without a videoId and a row without a thumbnail keeps a null URL", () => {
    const json = fixture("history");
    const shelf = [...SINGLE_COLUMN_SECTIONS, 0, "musicShelfRenderer", "contents"];
    removeKey(json, [...shelf, 0, ROW, "playlistItemData"]);
    removeKey(json, [...shelf, 1, ROW, "thumbnail"]);
    const tracks = value(readHistoryTracks(json));
    expect(tracks.map(track => track.videoId)).toEqual(["c5qJc8ArTUo", "HXJZ5sigL-E", "SySRldWdFs0", "OWDcn7hl16A", "M1GYqy0tHV0"]);
    expect(tracks[0].thumbnailUrl).toBeNull();
  });

  it.each(broken)("is unreadable for %s", (_, json) => {
    expect(readHistoryTracks(json)).toEqual({ ok: false });
  });

  it("is empty when the shelves are gone (a new user with no history)", () => {
    const json = fixture("history");
    for (const section of [0, 1]) removeKey(json, [...SINGLE_COLUMN_SECTIONS, section, "musicShelfRenderer"]);
    expect(readHistoryTracks(json)).toEqual({ ok: true, value: [] });
  });

  it("is empty for a section list with only a message", () => {
    const json = {
      contents: {
        singleColumnBrowseResultsRenderer: { tabs: [{ tabRenderer: { content: { sectionListRenderer: { contents: [{ messageRenderer: {} }] } } } }] }
      }
    };
    expect(readHistoryTracks(json)).toEqual({ ok: true, value: [] });
  });

  it("reads the other shelves when a shelf has no contents", () => {
    const json = removeKey(fixture("history"), [...SINGLE_COLUMN_SECTIONS, 1, "musicShelfRenderer", "contents"]);
    expect(value(readHistoryTracks(json)).map(track => track.videoId)).toEqual(["Tkx4HOLIrEM", "c5qJc8ArTUo", "HXJZ5sigL-E"]);
  });

  it("is unreadable when the section list is gone", () => {
    expect(readHistoryTracks(removeKey(fixture("history"), SINGLE_COLUMN_SECTIONS))).toEqual({ ok: false });
  });

  it("is unreadable when no row has a title column", () => {
    const json = fixture("history");
    for (const section of [0, 1]) {
      for (const row of [0, 1, 2]) removeKey(json, [...SINGLE_COLUMN_SECTIONS, section, "musicShelfRenderer", "contents", row, ROW, ...TITLE_COLUMN]);
    }
    expect(readHistoryTracks(json)).toEqual({ ok: false });
  });
});

describe("readRelatedBrowseId", () => {
  const TABS = ["contents", "singleColumnMusicWatchNextResultsRenderer", "tabbedRenderer", "watchNextTabbedResultsRenderer", "tabs"];

  it("finds the related tab by its page type", () => {
    expect(readRelatedBrowseId(fixture("next"))).toEqual({ ok: true, value: "MPTRt_btHriMNNtpA-4" });
  });

  it("finds it wherever the tab is", () => {
    const json = fixture("next");
    let tabs = json as Record<string | number, unknown>;
    for (const key of TABS) tabs = tabs[key] as Record<string | number, unknown>;
    (tabs as unknown as unknown[]).reverse();
    expect(readRelatedBrowseId(json)).toEqual({ ok: true, value: "MPTRt_btHriMNNtpA-4" });
  });

  it.each(broken)("is unreadable for %s", (_, json) => {
    expect(readRelatedBrowseId(json)).toEqual({ ok: false });
  });

  it("is unreadable when the tabs are gone", () => {
    expect(readRelatedBrowseId(removeKey(fixture("next"), TABS))).toEqual({ ok: false });
  });

  it("is unreadable when no tab has the related page type (the lyrics tab is not taken)", () => {
    expect(readRelatedBrowseId(removeKey(fixture("next"), [...TABS, 3, "tabRenderer", "endpoint"]))).toEqual({ ok: false });
  });

  it("is unreadable when the related tab has no browseId", () => {
    expect(readRelatedBrowseId(removeKey(fixture("next"), [...TABS, 3, "tabRenderer", "endpoint", "browseEndpoint", "browseId"]))).toEqual({
      ok: false
    });
  });
});

describe("readRelatedTracks", () => {
  const SECTIONS = ["contents", "sectionListRenderer", "contents"];

  it("reads the track rows of the carousels and skips the playlists", () => {
    expect(value(readRelatedTracks(fixture("related")))).toEqual([
      { videoId: "l3U97lFQGww", title: "Title 12", artists: ["Artist 15"], thumbnailUrl: thumb(49) },
      { videoId: "q-DMjmi61y8", title: "Title 13", artists: ["Artist 16"], thumbnailUrl: thumb(51) },
      { videoId: "JX8UNk5bAK8", title: "Title 14", artists: ["Artist 17"], thumbnailUrl: thumb(53) },
      { videoId: "Q3rpbaEz910", title: "Title 15", artists: ["Artist 20"], thumbnailUrl: thumb(64) },
      { videoId: "KLCJyS1spVs", title: "Title 16", artists: ["Artist 21"], thumbnailUrl: thumb(66) },
      { videoId: "GbGX1Sx0gvo", title: "Title 9", artists: ["Artist 10"], thumbnailUrl: thumb(67) }
    ]);
  });

  it.each(broken)("is unreadable for %s", (_, json) => {
    expect(readRelatedTracks(json)).toEqual({ ok: false });
  });

  it("is unreadable when the section list is gone", () => {
    expect(readRelatedTracks(removeKey(fixture("related"), SECTIONS))).toEqual({ ok: false });
  });

  it("is empty when the carousels are gone", () => {
    const json = fixture("related");
    for (const section of [0, 1, 2]) removeKey(json, [...SECTIONS, section, "musicCarouselShelfRenderer"]);
    expect(readRelatedTracks(json)).toEqual({ ok: true, value: [] });
  });

  it("reads the other carousels when a carousel has no contents", () => {
    const json = removeKey(fixture("related"), [...SECTIONS, 0, "musicCarouselShelfRenderer", "contents"]);
    expect(value(readRelatedTracks(json)).map(track => track.videoId)).toEqual(["Q3rpbaEz910", "KLCJyS1spVs", "GbGX1Sx0gvo"]);
  });
});

describe("readSearchTracks", () => {
  const SECTIONS = ["contents", "tabbedSearchResultsRenderer", "tabs", 0, "tabRenderer", "content", "sectionListRenderer", "contents"];

  it("reads the song rows, leaving out the album and the length", () => {
    expect(value(readSearchTracks(fixture("search")))).toEqual([
      { videoId: "wvCbfw9P9W4", title: "Title 17", artists: ["Artist 22"], thumbnailUrl: thumb(69) },
      { videoId: "sE6X-ecBqk4", title: "Title 18", artists: ["Artist 23"], thumbnailUrl: thumb(71) },
      { videoId: "8SEn8VuebXk", title: "Title 19", artists: ["Artist 24"], thumbnailUrl: thumb(73) }
    ]);
  });

  it("falls back to the names before the first separator when no run links to an artist", () => {
    const json = fixture("search");
    const artistRun = [
      ...SECTIONS,
      0,
      "musicShelfRenderer",
      "contents",
      0,
      ROW,
      "flexColumns",
      1,
      "musicResponsiveListItemFlexColumnRenderer",
      "text",
      "runs",
      0
    ];
    removeKey(json, [...artistRun, "navigationEndpoint"]);
    expect(value(readSearchTracks(json))[0].artists).toEqual(["Artist 22"]);
  });

  it("splits unlinked artists on the separators", () => {
    const json = fixture("search");
    const runs = [...SECTIONS, 0, "musicShelfRenderer", "contents", 0, ROW, "flexColumns", 1, "musicResponsiveListItemFlexColumnRenderer", "text"];
    let text = json as Record<string | number, unknown>;
    for (const key of runs) text = text[key] as Record<string | number, unknown>;
    text.runs = [
      { text: "Artist A" },
      { text: " & " },
      { text: "Artist B" },
      { text: " • " },
      { text: "Album 10" },
      { text: " • " },
      { text: "4:33" }
    ];
    expect(value(readSearchTracks(json))[0].artists).toEqual(["Artist A", "Artist B"]);
  });

  it.each(broken)("is unreadable for %s", (_, json) => {
    expect(readSearchTracks(json)).toEqual({ ok: false });
  });

  it("is empty when the song shelf is gone (no results)", () => {
    expect(readSearchTracks(removeKey(fixture("search"), [...SECTIONS, 0, "musicShelfRenderer"]))).toEqual({ ok: true, value: [] });
  });

  it("is empty when the song shelf has no contents", () => {
    expect(readSearchTracks(removeKey(fixture("search"), [...SECTIONS, 0, "musicShelfRenderer", "contents"]))).toEqual({ ok: true, value: [] });
  });

  it("is unreadable when the section list is gone", () => {
    expect(readSearchTracks(removeKey(fixture("search"), SECTIONS))).toEqual({ ok: false });
  });

  it("is unreadable when the tabs are gone", () => {
    expect(readSearchTracks(removeKey(fixture("search"), ["contents", "tabbedSearchResultsRenderer", "tabs"]))).toEqual({ ok: false });
  });

  it("is unreadable when no row has a title column", () => {
    const json = fixture("search");
    for (const row of [0, 1, 2]) removeKey(json, [...SECTIONS, 0, "musicShelfRenderer", "contents", row, ROW, ...TITLE_COLUMN]);
    expect(readSearchTracks(json)).toEqual({ ok: false });
  });
});
