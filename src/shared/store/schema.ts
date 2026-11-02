import { BundledTheme } from "~shared/theme";

export enum TrayIconStyle {
  Auto = 0,
  White = 1,
  Black = 2
}

// Every bundled theme, plus the theme file
export const ThemeSelection = {
  ...BundledTheme,
  File: "file" // Uses the theme file at appearance.themeFilePath
} as const;
export type ThemeSelection = (typeof ThemeSelection)[keyof typeof ThemeSelection];

export type StoreSchema = {
  metadata: {
    version: 1;
    appVersion: string;
  };
  general: {
    disableHardwareAcceleration: boolean;
    hideToTrayOnClose: boolean;
    showNotificationOnSongChange: boolean;
    startOnBoot: boolean;
    startMinimized: boolean;
  };
  appearance: {
    alwaysShowVolumeSlider: boolean;
    customCSSEnabled: boolean;
    customCSSPath: string | null;
    zoom: number;
    trayIconStyle: TrayIconStyle;
    theme: ThemeSelection;
    themeFilePath: string | null;
    backgroundVideoEnabled: boolean;
    backgroundVideoPath: string | null;
    backgroundVideoMaskOpacity: number; // 0-100 (%)
    backgroundVideoMaskBlur: number; // 0-20 (px)
  };
  playback: {
    continueWhereYouLeftOff: boolean;
    continueWhereYouLeftOffPaused: boolean;
    enableSpeakerFill: boolean;
    progressInTaskbar: boolean;
    ratioVolume: boolean;
  };
  integrations: {
    companionServerEnabled: boolean;
    companionServerAuthTokens: string | null; // array[object] | Encrypted for security
    companionServerCORSWildcardEnabled: boolean;
    discordPresenceEnabled: boolean;
    discordPresenceDetailsTemplate: string;
    discordPresenceStateTemplate: string;
    discordPresenceLargeTextTemplate: string;
    discordPresenceShowButton: boolean;
    discordPresenceStatusDisplay: number; // Discord status_display_type (0 = Name, 1 = State, 2 = Details)
    lastFMEnabled: boolean;
    enhancedMediaServiceEnabled: boolean;
  };
  shortcuts: {
    playPause: string;
    next: string;
    previous: string;
    thumbsUp: string;
    thumbsDown: string;
    volumeUp: string;
    volumeDown: string;
    volumeMute: string;
    toggleShuffle: string;
    toggleRepeat: string;
  };
  state: {
    lastUrl: string;
    lastPlaylistId: string;
    lastVideoId: string;
    windowBounds: Electron.Rectangle | null;
    windowMaximized: boolean;
    miniplayerWindowBounds: Electron.Rectangle | null;
  };
  lastfm: {
    sessionKey: string | null;
    scrobblePercent: number;
  };
  developer: {
    enableDevTools: boolean;
  };
};

export type MemoryStoreSchema = {
  discordPresenceConnectionFailed: boolean;

  themeUnreadableItems: string[];
  themeFileMissing: boolean;
  backgroundVideoFileMissing: boolean;

  shortcutsPlayPauseRegisterFailed: boolean;
  shortcutsNextRegisterFailed: boolean;
  shortcutsPreviousRegisterFailed: boolean;
  shortcutsThumbsUpRegisterFailed: boolean;
  shortcutsThumbsDownRegisterFailed: boolean;
  shortcutsVolumeUpRegisterFailed: boolean;
  shortcutsVolumeDownRegisterFailed: boolean;
  shortcutsVolumeMuteRegisterFailed: boolean;
  shortcutsToggleShuffleRegisterFailed: boolean;
  shortcutsToggleRepeatRegisterFailed: boolean;

  companionServerAuthWindowEnabled: boolean;

  safeStorageAvailable: boolean;

  autoUpdaterDisabled: boolean;
  autoUpdaterChecking: boolean;
  autoUpdaterNotAvailable: boolean;
  autoUpdaterAvailable: boolean;
  autoUpdaterDownloaded: boolean;
  autoUpdaterErrored: boolean;

  ytmViewLoadTimedout: boolean;
  ytmViewLoading: boolean;
  ytmViewLoadingError: boolean;
  ytmViewLoadingStatus: string;
  ytmViewUnresponsive: boolean;

  appLoadingStatus: string;

  lastFMAuthenticationStep: number;
  lastFMToken: string;
};
