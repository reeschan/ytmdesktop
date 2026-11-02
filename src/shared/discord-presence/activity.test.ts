import { describe, expect, it } from "vitest";
import { LikeStatus, VideoDetails, VideoState, VideoType } from "~shared/playerstatestore/types";
import {
  ActivityInput,
  buildActivity,
  DEFAULT_PRESENCE_DISPLAY_SETTINGS,
  DiscordActivityStatusDisplayType,
  DiscordActivityType,
  PresenceDisplaySettings
} from "~shared/discord-presence/activity";

const ZERO_WIDTH_SPACE = "​";
const NOW_MS = 1_700_000_000_000;

const VIDEO_DETAILS: VideoDetails = {
  album: "Album Name",
  albumId: "MPREb_album",
  author: "Artist Name",
  channelId: "UC_channel",
  durationSeconds: 200,
  thumbnails: [
    { url: "https://lh3.googleusercontent.com/small", width: 60, height: 60 },
    { url: "https://lh3.googleusercontent.com/large", width: 544, height: 544 },
    { url: "https://lh3.googleusercontent.com/medium", width: 226, height: 226 }
  ],
  title: "Song Title",
  id: "videoId123",
  likeStatus: LikeStatus.Indifferent,
  videoType: VideoType.MusicAudio,
  isLive: false
};

function input(overrides: Partial<ActivityInput> = {}, details: Partial<VideoDetails> = {}): ActivityInput {
  return {
    videoDetails: { ...VIDEO_DETAILS, ...details },
    videoState: VideoState.Playing,
    progressSeconds: 50,
    nowMs: NOW_MS,
    ...overrides
  };
}

function withTemplates(templates: Partial<PresenceDisplaySettings["templates"]>): PresenceDisplaySettings {
  return {
    ...DEFAULT_PRESENCE_DISPLAY_SETTINGS,
    templates: { ...DEFAULT_PRESENCE_DISPLAY_SETTINGS.templates, ...templates }
  };
}

describe("buildActivity", () => {
  it("builds the same activity as before with the default settings", () => {
    expect(buildActivity(DEFAULT_PRESENCE_DISPLAY_SETTINGS, input())).toEqual({
      type: DiscordActivityType.Listening,
      status_display_type: 1,
      details: "Song Title",
      details_url: "https://music.youtube.com/watch?v=videoId123",
      state: "Artist Name",
      state_url: "https://music.youtube.com/channel/UC_channel",
      timestamps: {
        start: NOW_MS - 50 * 1000,
        end: NOW_MS + 150 * 1000
      },
      assets: {
        large_image: "https://lh3.googleusercontent.com/large",
        large_text: "Album Name",
        large_url: "https://music.youtube.com/browse/MPREb_album",
        small_image: "play-border",
        small_text: "Playing"
      },
      instance: false,
      buttons: [{ label: "Play on YTMDesktop", url: "ytmd://play/videoId123" }]
    });
  });

  it("uses the logo when the thumbnail URL is longer than 256 characters", () => {
    const longUrl = "https://example.com/" + "a".repeat(300);
    const activity = buildActivity(DEFAULT_PRESENCE_DISPLAY_SETTINGS, input({}, { thumbnails: [{ url: longUrl, width: 10, height: 10 }] }));
    expect(activity.assets?.large_image).toBe("ytmd-logo");
  });

  it("puts the title and the artist on the first line", () => {
    const activity = buildActivity(withTemplates({ details: "{title} / {artist}" }), input());
    expect(activity.details).toBe("Song Title / Artist Name");
  });

  it("leaves {album} empty and omits large_text when the song has no album", () => {
    const withoutAlbum = input({}, { album: null, albumId: null });
    expect(buildActivity(DEFAULT_PRESENCE_DISPLAY_SETTINGS, withoutAlbum).assets?.large_text).toBeUndefined();
    expect(buildActivity(DEFAULT_PRESENCE_DISPLAY_SETTINGS, withoutAlbum).assets?.large_url).toBeUndefined();
    expect(buildActivity(withTemplates({ state: "[{album}]" }), withoutAlbum).state).toBe("[]");
  });

  it("falls back to the title when the first line is empty", () => {
    const activity = buildActivity(withTemplates({ details: "{album}" }), input({}, { album: null }));
    expect(activity.details).toBe("Song Title");
    expect(activity.details_url).toBe("https://music.youtube.com/watch?v=videoId123");
  });

  it("treats a first line of only spaces as empty", () => {
    const activity = buildActivity(withTemplates({ details: "  {album}  " }), input({}, { album: null }));
    expect(activity.details).toBe("Song Title");
  });

  it("omits state and state_url when the second line is empty", () => {
    const activity = buildActivity(withTemplates({ state: " {album} " }), input({}, { album: null }));
    expect(activity.state).toBeUndefined();
    expect(activity.state_url).toBeUndefined();
  });

  it("truncates results longer than 128 characters to 125 characters and an ellipsis", () => {
    const longTitle = "x".repeat(200);
    const activity = buildActivity(withTemplates({ largeText: "{title}" }), input({}, { title: longTitle }));
    expect(activity.details).toBe("x".repeat(125) + "...");
    expect(activity.details).toHaveLength(128);
    expect(activity.assets?.large_text).toBe("x".repeat(125) + "...");
  });

  it("keeps results of exactly 128 characters", () => {
    const title = "y".repeat(128);
    expect(buildActivity(DEFAULT_PRESENCE_DISPLAY_SETTINGS, input({}, { title })).details).toBe(title);
  });

  it("pads results shorter than 2 characters with zero width spaces", () => {
    const activity = buildActivity(DEFAULT_PRESENCE_DISPLAY_SETTINGS, input({}, { title: "A", author: "B" }));
    expect(activity.details).toBe("A" + ZERO_WIDTH_SPACE);
    expect(activity.state).toBe("B" + ZERO_WIDTH_SPACE);
  });

  it("omits the button when showButton is false", () => {
    const activity = buildActivity({ ...DEFAULT_PRESENCE_DISPLAY_SETTINGS, showButton: false }, input());
    expect(activity.buttons).toBeUndefined();
  });

  it("uses the chosen status display type", () => {
    const activity = buildActivity({ ...DEFAULT_PRESENCE_DISPLAY_SETTINGS, statusDisplay: DiscordActivityStatusDisplayType.Details }, input());
    expect(activity.status_display_type).toBe(2);
  });

  it.each([VideoState.Paused, VideoState.Buffering, VideoState.Unknown])("has no timestamps and shows the pause image in state %s", videoState => {
    const activity = buildActivity(DEFAULT_PRESENCE_DISPLAY_SETTINGS, input({ videoState }));
    expect(activity.timestamps?.start).toBeUndefined();
    expect(activity.timestamps?.end).toBeUndefined();
    expect(activity.assets?.small_image).toBe("pause-border");
    expect(activity.assets?.small_text).toBe("Paused");
  });

  it("keeps unknown template fields as they are", () => {
    const activity = buildActivity(withTemplates({ details: "{title} ({year})", state: "{constructor}" }), input());
    expect(activity.details).toBe("Song Title ({year})");
    expect(activity.state).toBe("{constructor}");
  });
});
