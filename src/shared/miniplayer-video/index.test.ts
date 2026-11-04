import { describe, expect, it } from "vitest";
import {
  MINIPLAYER_VIDEO_MARGINS,
  MiniplayerVideoIpc,
  MiniplayerVideoMessage,
  MiniplayerVideoState,
  MiniplayerVideoStep,
  miniplayerVideoBounds,
  nextMiniplayerVideoStep,
  showsLiveVideo
} from "~shared/miniplayer-video";
import { VideoType } from "~shared/playerstatestore/types";

const ALL_VIDEO_TYPES = Object.values(VideoType).filter((value): value is VideoType => typeof value === "number");

function state(overrides: Partial<MiniplayerVideoState>): MiniplayerVideoState {
  return {
    open: true,
    videoType: VideoType.MusicVideo,
    videoId: "a",
    mountedId: null,
    attachedToMiniplayer: false,
    ...overrides
  };
}

describe("MINIPLAYER_VIDEO_MARGINS", () => {
  it("keeps 36px above for the title bar and 80px below for the controls", () => {
    expect(MINIPLAYER_VIDEO_MARGINS).toEqual({ top: 36, bottom: 80 });
  });
});

describe("miniplayerVideoBounds", () => {
  it("leaves 36px above and 80px below and uses the full width", () => {
    expect(miniplayerVideoBounds({ width: 400, height: 400 })).toEqual({ x: 0, y: 36, width: 400, height: 284 });
  });

  it("has a height of 0 when the window is exactly as tall as the margins", () => {
    expect(miniplayerVideoBounds({ width: 300, height: 116 })).toEqual({ x: 0, y: 36, width: 300, height: 0 });
  });

  it("has a height of 0 when the window is shorter than the margins", () => {
    expect(miniplayerVideoBounds({ width: 300, height: 50 })).toEqual({ x: 0, y: 36, width: 300, height: 0 });
    expect(miniplayerVideoBounds({ width: 300, height: 0 }).height).toBe(0);
  });

  it("uses the margins it is given", () => {
    expect(miniplayerVideoBounds({ width: 200, height: 100 }, { top: 10, bottom: 20 })).toEqual({ x: 0, y: 10, width: 200, height: 70 });
  });
});

describe("showsLiveVideo", () => {
  it("is true only for MusicVideo and MusicUploaded", () => {
    expect(ALL_VIDEO_TYPES).toHaveLength(5);
    for (const videoType of ALL_VIDEO_TYPES) {
      expect(showsLiveVideo(videoType), VideoType[videoType]).toBe(videoType === VideoType.MusicVideo || videoType === VideoType.MusicUploaded);
    }
  });
});

describe("nextMiniplayerVideoStep", () => {
  it("releases a song without a moving picture while attached", () => {
    for (const videoType of [VideoType.MusicAudio, VideoType.PodcastEpisode, VideoType.Unknown]) {
      expect(nextMiniplayerVideoStep(state({ videoType, mountedId: "a", attachedToMiniplayer: true })), VideoType[videoType]).toBe(
        MiniplayerVideoStep.Release
      );
    }
  });

  it("does nothing for a song without a moving picture while not attached", () => {
    expect(nextMiniplayerVideoStep(state({ videoType: VideoType.MusicAudio, attachedToMiniplayer: false }))).toBe(MiniplayerVideoStep.None);
  });

  it("attaches and mounts a song with a moving picture while not attached", () => {
    for (const videoType of [VideoType.MusicVideo, VideoType.MusicUploaded]) {
      expect(nextMiniplayerVideoStep(state({ videoType, attachedToMiniplayer: false })), VideoType[videoType]).toBe(
        MiniplayerVideoStep.AttachAndMount
      );
    }
  });

  it("does nothing while the same song is mounted", () => {
    expect(nextMiniplayerVideoStep(state({ videoId: "a", mountedId: "a", attachedToMiniplayer: true }))).toBe(MiniplayerVideoStep.None);
  });

  it("mounts again when the song changes", () => {
    expect(nextMiniplayerVideoStep(state({ videoId: "b", mountedId: "a", attachedToMiniplayer: true }))).toBe(MiniplayerVideoStep.Remount);
  });

  it("mounts again when attached but nothing is mounted", () => {
    expect(nextMiniplayerVideoStep(state({ videoId: "a", mountedId: null, attachedToMiniplayer: true }))).toBe(MiniplayerVideoStep.Remount);
  });

  it("releases when closed while attached", () => {
    expect(nextMiniplayerVideoStep(state({ open: false, mountedId: "a", attachedToMiniplayer: true }))).toBe(MiniplayerVideoStep.Release);
  });

  it("does nothing when closed while not attached", () => {
    for (const videoType of ALL_VIDEO_TYPES) {
      expect(nextMiniplayerVideoStep(state({ open: false, videoType, attachedToMiniplayer: false })), VideoType[videoType]).toBe(
        MiniplayerVideoStep.None
      );
    }
  });
});

describe("names shared by the main process and the YTM view", () => {
  it("are all different", () => {
    const names = [...Object.values(MiniplayerVideoIpc), ...Object.values(MiniplayerVideoMessage)];
    expect(new Set(names).size).toBe(names.length);
  });
});
