import { VideoType } from "~shared/playerstatestore/types";

export type MiniplayerVideoMargins = {
  // Space kept free above the video (for example the title bar)
  top: number;
  // Space kept free below the video (for example the playback controls)
  bottom: number;
};

// Matches the miniplayer layout: the title bar is 36px high and the controls are 80px high
export const MINIPLAYER_VIDEO_MARGINS: MiniplayerVideoMargins = {
  top: 36,
  bottom: 80
};

export type MiniplayerVideoSize = {
  width: number;
  height: number;
};

export type MiniplayerVideoBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Returns the area left between the top and bottom margins of the parent, using its full width.
 * The height is 0 when the parent is not taller than the margins.
 */
export function miniplayerVideoBounds(
  parent: MiniplayerVideoSize,
  margins: MiniplayerVideoMargins = MINIPLAYER_VIDEO_MARGINS
): MiniplayerVideoBounds {
  return {
    x: 0,
    y: margins.top,
    width: Math.max(0, parent.width),
    height: Math.max(0, parent.height - margins.top - margins.bottom)
  };
}

const LIVE_VIDEO_TYPES: ReadonlySet<VideoType> = new Set([VideoType.MusicVideo, VideoType.MusicUploaded]);

/**
 * Whether a song of the video type has a moving picture to show
 */
export function showsLiveVideo(videoType: VideoType): boolean {
  return LIVE_VIDEO_TYPES.has(videoType);
}

export const MiniplayerVideoStep = {
  // Attach the YTM view to the miniplayer and move the video into view
  AttachAndMount: "attachAndMount",
  // Move the video into view again (for example after the song changed)
  Remount: "remount",
  // Put the video back and return the YTM view to the main window
  Release: "release",
  None: "none"
} as const;
export type MiniplayerVideoStep = (typeof MiniplayerVideoStep)[keyof typeof MiniplayerVideoStep];

export type MiniplayerVideoState = {
  // Whether the miniplayer is open
  open: boolean;
  videoType: VideoType;
  // Id of the song being played
  videoId: string;
  // Id of the song whose video was last moved into view, null when none is
  mountedId: string | null;
  // Whether the YTM view is attached to the miniplayer
  attachedToMiniplayer: boolean;
};

/**
 * Decides the next step for showing the video in the miniplayer.
 * While closed or playing a song without a moving picture, the YTM view goes back when it is attached.
 * Otherwise it is attached and the video is moved, moved again when the song differs, or left as it is.
 */
export function nextMiniplayerVideoStep(state: MiniplayerVideoState): MiniplayerVideoStep {
  if (!state.open || !showsLiveVideo(state.videoType)) {
    return state.attachedToMiniplayer ? MiniplayerVideoStep.Release : MiniplayerVideoStep.None;
  }
  if (!state.attachedToMiniplayer) {
    return MiniplayerVideoStep.AttachAndMount;
  }

  return state.mountedId === state.videoId ? MiniplayerVideoStep.None : MiniplayerVideoStep.Remount;
}

// IPC channels from the main process to the YTM view
export const MiniplayerVideoIpc = {
  // Move the playing video into view
  Mount: "miniplayerVideo:mount",
  // Put the video back where it was
  Release: "miniplayerVideo:release"
} as const;
export type MiniplayerVideoIpc = (typeof MiniplayerVideoIpc)[keyof typeof MiniplayerVideoIpc];

// window.postMessage ops from the YTM view preload to the YTM page scripts
export const MiniplayerVideoMessage = {
  // Move the playing video into view
  Mount: "ytmd-miniplayer-video-mount",
  // Put the video back where it was
  Release: "ytmd-miniplayer-video-release"
} as const;
export type MiniplayerVideoMessage = (typeof MiniplayerVideoMessage)[keyof typeof MiniplayerVideoMessage];
