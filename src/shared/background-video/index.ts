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

export type BackgroundVideoInput = {
  enabled: boolean;
  fileFound: boolean;
  window: WindowVisibility;
};

export type BackgroundVideoDecision = {
  video: BackgroundVideoPlayback;
  ytmBackground: YtmBackground;
};

export type BackgroundVideoViewState = {
  playback: BackgroundVideoPlayback;
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
 * Decides how the background video is shown and whether the YTM view background is transparent.
 * The video is shown only when it is enabled and its file is found; otherwise the YTM view keeps the theme background.
 */
export function decideBackgroundVideo(input: BackgroundVideoInput): BackgroundVideoDecision {
  if (!input.enabled || !input.fileFound) {
    return { video: BackgroundVideoPlayback.NotShown, ytmBackground: YtmBackground.Theme };
  }

  return { video: WINDOW_PLAYBACK[input.window], ytmBackground: YtmBackground.Transparent };
}
