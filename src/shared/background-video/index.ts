export const WindowVisibility = {
  Visible: "visible",
  // Minimized or hidden to the tray
  Hidden: "hidden",
  Fullscreen: "fullscreen"
} as const;
export type WindowVisibility = (typeof WindowVisibility)[keyof typeof WindowVisibility];

export const BackgroundVideoPlayback = {
  NotShown: "notShown",
  Playing: "playing",
  Paused: "paused",
  Hidden: "hidden"
} as const;
export type BackgroundVideoPlayback = (typeof BackgroundVideoPlayback)[keyof typeof BackgroundVideoPlayback];

export const YtmBackground = {
  Theme: "theme",
  Transparent: "transparent"
} as const;
export type YtmBackground = (typeof YtmBackground)[keyof typeof YtmBackground];

export const BackgroundVideoSource = {
  // The video the YouTube Music player is playing
  Playing: "playing",
  // The video file at appearance.backgroundVideoPath
  File: "file",
  Spectrum: "spectrum"
} as const;
export type BackgroundVideoSource = (typeof BackgroundVideoSource)[keyof typeof BackgroundVideoSource];

export const BackgroundVideoMotion = {
  // Every frame is drawn
  Continuous: "continuous",
  // A single frame is drawn, again only when the content changes (for example another song or a pause)
  Still: "still"
} as const;
export type BackgroundVideoMotion = (typeof BackgroundVideoMotion)[keyof typeof BackgroundVideoMotion];

// IPC channels between the main process and the YTM view
export const BackgroundVideoIpc = {
  // Main process to the YTM view, carries a YtmBackgroundState
  State: "backgroundVideo:ytmState",
  // YTM view to the main process, carries a YtmBackgroundReport
  Report: "backgroundVideo:ytmReport"
} as const;
export type BackgroundVideoIpc = (typeof BackgroundVideoIpc)[keyof typeof BackgroundVideoIpc];

// window.postMessage ops between the YTM view preload and the YTM page scripts
export const BackgroundVideoMessage = {
  // Preload to the page scripts, carries a YtmBackgroundState
  State: "ytmd-background-video-state",
  // Page scripts to the preload, carries a YtmBackgroundReport
  Report: "ytmd-background-video-report"
} as const;
export type BackgroundVideoMessage = (typeof BackgroundVideoMessage)[keyof typeof BackgroundVideoMessage];

export type BackgroundVideoInput = {
  enabled: boolean;
  source: BackgroundVideoSource;
  // Whether the playing video has a picture to show
  videoAvailable: boolean;
  fileFound: boolean;
  window: WindowVisibility;
  reducedMotion: boolean;
};

export type BackgroundVideoDecision = {
  video: BackgroundVideoPlayback;
  ytmBackground: YtmBackground;
  motion: BackgroundVideoMotion;
};

export const YtmBackgroundContent = {
  Video: "video",
  Spectrum: "spectrum"
} as const;
export type YtmBackgroundContent = (typeof YtmBackgroundContent)[keyof typeof YtmBackgroundContent];

// State of the background drawn inside the YTM view
export type YtmBackgroundState = {
  show: boolean;
  content: YtmBackgroundContent;
  playback: BackgroundVideoPlayback;
  motion: BackgroundVideoMotion;
  maskOpacity: number;
  maskBlur: number;
  maskColor: string;
};

// What the YTM view reports about the video it plays
export type YtmBackgroundReport = {
  available: boolean;
  reducedMotion: boolean;
};

export type BackgroundVideoViewState = {
  playback: BackgroundVideoPlayback;
  motion: BackgroundVideoMotion;
  src: string | null;
  maskOpacity: number;
  maskBlur: number;
  maskColor: string;
};

const WINDOW_PLAYBACK: Record<WindowVisibility, BackgroundVideoPlayback> = {
  [WindowVisibility.Visible]: BackgroundVideoPlayback.Playing,
  [WindowVisibility.Hidden]: BackgroundVideoPlayback.Paused,
  [WindowVisibility.Fullscreen]: BackgroundVideoPlayback.Hidden
};

/**
 * Decides how the background video is shown, whether the YTM view background is transparent and whether the video moves.
 * A video source needs a picture; the spectrum needs normal motion. Otherwise the theme background is kept.
 * Motion is still while motion is reduced.
 */
export function decideBackgroundVideo(input: BackgroundVideoInput): BackgroundVideoDecision {
  const motion = input.reducedMotion ? BackgroundVideoMotion.Still : BackgroundVideoMotion.Continuous;
  const pictureFound =
    input.source === BackgroundVideoSource.Spectrum
      ? !input.reducedMotion
      : input.source === BackgroundVideoSource.Playing
        ? input.videoAvailable
        : input.fileFound;
  if (!input.enabled || !pictureFound) {
    return { video: BackgroundVideoPlayback.NotShown, ytmBackground: YtmBackground.Theme, motion };
  }

  return { video: WINDOW_PLAYBACK[input.window], ytmBackground: YtmBackground.Transparent, motion };
}
