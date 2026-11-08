<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import KeybindInput from "../../components/KeybindInput.vue";
import YTMDSetting from "../../components/YTMDSetting.vue";
import { StoreSchema, ThemeSelection, TrayIconStyle } from "~shared/store/schema";
import { ThemeItem } from "~shared/theme";
import { BackgroundVideoSource } from "~shared/background-video";
import { AuthToken } from "~shared/integrations/companion-server/types";
import { buildActivity, DiscordActivityStatusDisplayType, TemplateField } from "~shared/discord-presence/activity";
import { LikeStatus, PlayerState, VideoDetails, VideoState, VideoType } from "~shared/playerstatestore/types";
import {
  DEFAULT_SONG_RECOGNITION_SOURCE,
  SHAZAM_API_KEY_URL,
  SongRecognitionInputDevice,
  SongRecognitionSourceKind,
  SongRecognitionSourceSetting
} from "~shared/song-recognition";
import { isPcAudioAvailable } from "~shared/song-recognition/source";
import {
  GROOVING_API_KEY_URLS,
  GROOVING_DEFAULT_MODELS,
  GROOVING_PROVIDER_LABELS,
  GroovingConsent,
  GroovingConsentChoice,
  GroovingLanguage,
  GroovingProvider,
  GroovingUsage,
  GroovingUsageAmounts
} from "~shared/grooving";
import { groovingMonth } from "~shared/grooving/usage";
import { SettingsTab } from "~shared/types";
import logo from "~assets/icons/ytmd.png";

declare const YTMD_GIT_COMMIT_HASH: string | undefined;
declare const YTMD_GIT_BRANCH: string | undefined;

const ytmdVersion = await window.ytmd.getAppVersion();
const ytmdCommitHash = YTMD_GIT_COMMIT_HASH?.substring(0, 7);
const ytmdBranch = YTMD_GIT_BRANCH;

const processVersions = window.ytmd.processVersions;

const isDarwin = window.ytmd.isDarwin;
const isLinux = window.ytmd.isLinux;

// Opened from the YTM view with ?tab=integrations when an API key is missing
const initialTab = new URLSearchParams(location.search).get("tab") === SettingsTab.Integrations ? 4 : 1;
const currentTab = ref(initialTab);
const requiresRestart = ref(false);
const checkingForUpdate = ref(false);
const updateAvailable = ref(await window.ytmd.isAppUpdateAvailable());
const updateNotAvailable = ref(false);
const updateDownloaded = ref(await window.ytmd.isAppUpdateDownloaded());

const store = window.ytmd.store;
const memoryStore = window.ytmd.memoryStore;
const safeStorage = window.ytmd.safeStorage;

const safeStorageAvailable = ref<boolean>(await memoryStore.get("safeStorageAvailable"));

const general: StoreSchema["general"] = await store.get("general");
const appearance: StoreSchema["appearance"] = await store.get("appearance");
const playback: StoreSchema["playback"] = await store.get("playback");
const integrations: StoreSchema["integrations"] = await store.get("integrations");
const equalizer: StoreSchema["equalizer"] = await store.get("equalizer");
const shortcuts: StoreSchema["shortcuts"] = await store.get("shortcuts");
const lastFM: StoreSchema["lastfm"] = await store.get("lastfm");

const disableHardwareAcceleration = ref<boolean>(general.disableHardwareAcceleration);
const hideToTrayOnClose = ref<boolean>(general.hideToTrayOnClose);
const showNotificationOnSongChange = ref<boolean>(general.showNotificationOnSongChange);
const startOnBoot = ref<boolean>(general.startOnBoot);
const startMinimized = ref<boolean>(general.startMinimized);

const alwaysShowVolumeSlider = ref<boolean>(appearance.alwaysShowVolumeSlider);
const customCSSEnabled = ref<boolean>(appearance.customCSSEnabled);
const customCSSPath = ref<string>(appearance.customCSSPath);
const zoom = ref<number>(appearance.zoom);
const trayIconStyle = ref<number>(appearance.trayIconStyle);
const theme = ref<ThemeSelection>(appearance.theme);
const themeFilePath = ref<string | null>(appearance.themeFilePath);
const backgroundVideoEnabled = ref<boolean>(appearance.backgroundVideoEnabled);
const backgroundVideoSource = ref<BackgroundVideoSource>(appearance.backgroundVideoSource);
const backgroundVideoPath = ref<string | null>(appearance.backgroundVideoPath);
const backgroundVideoMaskOpacity = ref<number>(appearance.backgroundVideoMaskOpacity);
const backgroundVideoMaskBlur = ref<number>(appearance.backgroundVideoMaskBlur);

const themeOptions: Record<ThemeSelection, string> = {
  [ThemeSelection.Default]: "Default",
  [ThemeSelection.Midnight]: "Midnight",
  [ThemeSelection.Forest]: "Forest",
  [ThemeSelection.Glass]: "Glass",
  [ThemeSelection.Jacket]: "Jacket",
  [ThemeSelection.File]: "Theme file"
};

const themeItemNames: Record<ThemeItem, string> = {
  [ThemeItem.Background]: "Background",
  [ThemeItem.Surface]: "Surface",
  [ThemeItem.Text]: "Text",
  [ThemeItem.TextMuted]: "Muted text",
  [ThemeItem.Accent]: "Accent",
  [ThemeItem.Border]: "Border",
  [ThemeItem.SurfaceBlur]: "Surface blur"
};

const backgroundVideoSourceOptions: Record<BackgroundVideoSource, string> = {
  [BackgroundVideoSource.Playing]: "Playing video",
  [BackgroundVideoSource.File]: "Video file",
  [BackgroundVideoSource.Spectrum]: "Spectrum"
};

const continueWhereYouLeftOff = ref<boolean>(playback.continueWhereYouLeftOff);
const continueWhereYouLeftOffPaused = ref<boolean>(playback.continueWhereYouLeftOffPaused);
const enableSpeakerFill = ref<boolean>(playback.enableSpeakerFill);
const progressInTaskbar = ref<boolean>(playback.progressInTaskbar);
const ratioVolume = ref<boolean>(playback.ratioVolume);

const companionServerEnabled = ref<boolean>(integrations.companionServerEnabled);
const companionServerAuthTokens = ref<AuthToken[]>(
  safeStorageAvailable.value ? (JSON.parse(await safeStorage.decryptString(integrations.companionServerAuthTokens)) ?? []) : []
);
const companionServerCORSWildcardEnabled = ref<boolean>(integrations.companionServerCORSWildcardEnabled);
const discordPresenceEnabled = ref<boolean>(integrations.discordPresenceEnabled);
const discordPresenceDetailsTemplate = ref<string>(integrations.discordPresenceDetailsTemplate);
const discordPresenceStateTemplate = ref<string>(integrations.discordPresenceStateTemplate);
const discordPresenceLargeTextTemplate = ref<string>(integrations.discordPresenceLargeTextTemplate);
const discordPresenceShowButton = ref<boolean>(integrations.discordPresenceShowButton);
const discordPresenceStatusDisplay = ref<number>(integrations.discordPresenceStatusDisplay);
const lastFMEnabled = ref<boolean>(integrations.lastFMEnabled);
const enhancedMediaServiceEnabled = ref<boolean>(integrations.enhancedMediaServiceEnabled);
// The values below can be missing in a settings file saved by an older version
const shazamEnabled = ref<boolean>(integrations.shazamEnabled ?? false);
const shazamApiKey = ref<string>(await decryptApiKey(integrations.shazamApiKey));
const shazamAudioSource = ref<SongRecognitionSourceSetting>(integrations.shazamAudioSource ?? DEFAULT_SONG_RECOGNITION_SOURCE);
const groovingProviders = Object.values(GroovingProvider);
const groovingProvider = ref<GroovingProvider>(integrations.groovingProvider ?? GroovingProvider.Gemini);
// One plaintext key per provider, so switching the provider never clears another provider's key
const groovingApiKeys = ref<Record<GroovingProvider, string>>({
  [GroovingProvider.Gemini]: await decryptApiKey(integrations.groovingApiKeys?.[GroovingProvider.Gemini]),
  [GroovingProvider.Anthropic]: await decryptApiKey(integrations.groovingApiKeys?.[GroovingProvider.Anthropic]),
  [GroovingProvider.OpenAI]: await decryptApiKey(integrations.groovingApiKeys?.[GroovingProvider.OpenAI])
});
const groovingModels = ref<Record<GroovingProvider, string>>({
  [GroovingProvider.Gemini]: integrations.groovingModels?.[GroovingProvider.Gemini] ?? "",
  [GroovingProvider.Anthropic]: integrations.groovingModels?.[GroovingProvider.Anthropic] ?? "",
  [GroovingProvider.OpenAI]: integrations.groovingModels?.[GroovingProvider.OpenAI] ?? ""
});
const groovingLanguages = Object.values(GroovingLanguage);
// Each language is shown in its own language, so a reader of either can find theirs
const GROOVING_LANGUAGE_LABELS: Record<GroovingLanguage, string> = {
  auto: "Auto",
  en: "English",
  ja: "日本語"
};
const groovingLanguage = ref<GroovingLanguage>(integrations.groovingLanguage ?? GroovingLanguage.Auto);
const groovingConsent = ref<GroovingConsent | null>(integrations.groovingConsent ?? null);
const equalizerConsent = ref<string | null>(equalizer?.aiConsentAt ?? null);
const groovingUsage = ref<GroovingUsage | null>(integrations.groovingUsage ?? null);

const shortcutPlayPause = ref<string>(shortcuts.playPause);
const shortcutNext = ref<string>(shortcuts.next);
const shortcutPrevious = ref<string>(shortcuts.previous);
const shortcutThumbsUp = ref<string>(shortcuts.thumbsUp);
const shortcutThumbsDown = ref<string>(shortcuts.thumbsDown);
const shortcutVolumeUp = ref<string>(shortcuts.volumeUp);
const shortcutVolumeDown = ref<string>(shortcuts.volumeDown);
const shortcutVolumeMute = ref<string>(shortcuts.volumeMute);
const shortcutToggleShuffle = ref<string>(shortcuts.toggleShuffle);
const shortcutToggleRepeat = ref<string>(shortcuts.toggleRepeat);

const lastFMSessionKey = ref<string>(lastFM.sessionKey);
const scrobblePercent = ref<number>(lastFM.scrobblePercent);

store.onDidAnyChange(async newState => {
  disableHardwareAcceleration.value = newState.general.disableHardwareAcceleration;
  hideToTrayOnClose.value = newState.general.hideToTrayOnClose;
  showNotificationOnSongChange.value = newState.general.showNotificationOnSongChange;
  startOnBoot.value = newState.general.startOnBoot;
  startMinimized.value = newState.general.startMinimized;

  alwaysShowVolumeSlider.value = newState.appearance.alwaysShowVolumeSlider;
  customCSSEnabled.value = newState.appearance.customCSSEnabled;
  customCSSPath.value = newState.appearance.customCSSPath;
  zoom.value = newState.appearance.zoom;
  trayIconStyle.value = newState.appearance.trayIconStyle;
  theme.value = newState.appearance.theme;
  themeFilePath.value = newState.appearance.themeFilePath;
  backgroundVideoEnabled.value = newState.appearance.backgroundVideoEnabled;
  backgroundVideoSource.value = newState.appearance.backgroundVideoSource;
  backgroundVideoPath.value = newState.appearance.backgroundVideoPath;
  backgroundVideoMaskOpacity.value = newState.appearance.backgroundVideoMaskOpacity;
  backgroundVideoMaskBlur.value = newState.appearance.backgroundVideoMaskBlur;

  continueWhereYouLeftOff.value = newState.playback.continueWhereYouLeftOff;
  continueWhereYouLeftOffPaused.value = newState.playback.continueWhereYouLeftOffPaused;
  enableSpeakerFill.value = newState.playback.enableSpeakerFill;
  progressInTaskbar.value = newState.playback.progressInTaskbar;
  ratioVolume.value = newState.playback.ratioVolume;

  companionServerEnabled.value = newState.integrations.companionServerEnabled;
  companionServerAuthTokens.value = safeStorageAvailable.value
    ? (JSON.parse(await safeStorage.decryptString(newState.integrations.companionServerAuthTokens)) ?? [])
    : [];
  companionServerCORSWildcardEnabled.value = newState.integrations.companionServerCORSWildcardEnabled;
  discordPresenceEnabled.value = newState.integrations.discordPresenceEnabled;
  // The Discord template inputs are not synced back here: they save on every keystroke, and an older echoed value would overwrite newer text
  discordPresenceShowButton.value = newState.integrations.discordPresenceShowButton;
  discordPresenceStatusDisplay.value = newState.integrations.discordPresenceStatusDisplay;
  lastFMEnabled.value = newState.integrations.lastFMEnabled;
  lastFMSessionKey.value = newState.lastfm.sessionKey;
  scrobblePercent.value = newState.lastfm.scrobblePercent;
  enhancedMediaServiceEnabled.value = newState.integrations.enhancedMediaServiceEnabled;
  shazamEnabled.value = newState.integrations.shazamEnabled ?? false;
  // The API key input is not synced back here: it saves while typing, and an older echoed value would overwrite newer text
  shazamAudioSource.value = newState.integrations.shazamAudioSource ?? DEFAULT_SONG_RECOGNITION_SOURCE;
  groovingProvider.value = newState.integrations.groovingProvider ?? GroovingProvider.Gemini;
  // The Grooving API key and model inputs are not synced back here, for the same reason as the Shazam API key
  groovingLanguage.value = newState.integrations.groovingLanguage ?? GroovingLanguage.Auto;
  groovingConsent.value = newState.integrations.groovingConsent ?? null;
  equalizerConsent.value = newState.equalizer?.aiConsentAt ?? null;
  groovingUsage.value = newState.integrations.groovingUsage ?? null;

  shortcutPlayPause.value = newState.shortcuts.playPause;
  shortcutNext.value = newState.shortcuts.next;
  shortcutPrevious.value = newState.shortcuts.previous;
  shortcutThumbsUp.value = newState.shortcuts.thumbsUp;
  shortcutThumbsDown.value = newState.shortcuts.thumbsDown;
  shortcutVolumeUp.value = newState.shortcuts.volumeUp;
  shortcutVolumeDown.value = newState.shortcuts.volumeDown;
  shortcutVolumeMute.value = newState.shortcuts.volumeMute;
  shortcutToggleShuffle.value = newState.shortcuts.toggleShuffle;
  shortcutToggleRepeat.value = newState.shortcuts.toggleRepeat;
});

const discordPresenceConnectionFailed = ref<boolean>(await memoryStore.get("discordPresenceConnectionFailed"));

const shortcutsPlayPauseRegisterFailed = ref<boolean>(await memoryStore.get("shortcutsPlayPauseRegisterFailed"));
const shortcutsNextRegisterFailed = ref<boolean>(await memoryStore.get("shortcutsNextRegisterFailed"));
const shortcutsPreviousRegisterFailed = ref<boolean>(await memoryStore.get("shortcutsPreviousRegisterFailed"));
const shortcutsThumbsUpRegisterFailed = ref<boolean>(await memoryStore.get("shortcutsThumbsUpRegisterFailed"));
const shortcutsThumbsDownRegisterFailed = ref<boolean>(await memoryStore.get("shortcutsThumbsDownRegisterFailed"));
const shortcutsVolumeUpRegisterFailed = ref<boolean>(await memoryStore.get("shortcutsVolumeUpRegisterFailed"));
const shortcutsVolumeDownRegisterFailed = ref<boolean>(await memoryStore.get("shortcutsVolumeDownRegisterFailed"));
const shortcutsVolumeMuteRegisterFailed = ref<boolean>(await memoryStore.get("shortcutsVolumeMuteRegisterFailed"));
const shortcutsToggleShuffleRegisterFailed = ref<boolean>(await memoryStore.get("shortcutsToggleShuffleRegisterFailed"));
const shortcutsToggleRepeatRegisterFailed = ref<boolean>(await memoryStore.get("shortcutsToggleRepeatRegisterFailed"));

const companionServerAuthWindowEnabled = ref<boolean>(await memoryStore.get("companionServerAuthWindowEnabled"));

const autoUpdaterDisabled = ref<boolean>(await memoryStore.get("autoUpdaterDisabled"));

const lastFMAuthenticationStep = ref<number>(await memoryStore.get("lastFMAuthenticationStep"));

const themeFileMissing = ref<boolean>(await memoryStore.get("themeFileMissing"));
const themeUnreadableItems = ref<string[]>((await memoryStore.get("themeUnreadableItems")) ?? []);
const backgroundVideoFileMissing = ref<boolean>(await memoryStore.get("backgroundVideoFileMissing"));
const songRecognitionDevices = ref<SongRecognitionInputDevice[]>((await memoryStore.get("songRecognitionDevices")) ?? []);

const themeUnreadableItemNames = computed(() =>
  themeUnreadableItems.value.map(item => themeItemNames[item as ThemeItem] ?? item).join(", ")
);

memoryStore.onStateChanged(newState => {
  discordPresenceConnectionFailed.value = newState.discordPresenceConnectionFailed;

  shortcutsPlayPauseRegisterFailed.value = newState.shortcutsPlayPauseRegisterFailed;
  shortcutsNextRegisterFailed.value = newState.shortcutsNextRegisterFailed;
  shortcutsPreviousRegisterFailed.value = newState.shortcutsPreviousRegisterFailed;
  shortcutsThumbsUpRegisterFailed.value = newState.shortcutsThumbsUpRegisterFailed;
  shortcutsThumbsDownRegisterFailed.value = newState.shortcutsThumbsDownRegisterFailed;
  shortcutsVolumeUpRegisterFailed.value = newState.shortcutsVolumeUpRegisterFailed;
  shortcutsVolumeDownRegisterFailed.value = newState.shortcutsVolumeDownRegisterFailed;
  shortcutsVolumeMuteRegisterFailed.value = newState.shortcutsVolumeMuteRegisterFailed;
  shortcutsToggleShuffleRegisterFailed.value = newState.shortcutsToggleShuffleRegisterFailed;
  shortcutsToggleRepeatRegisterFailed.value = newState.shortcutsToggleRepeatRegisterFailed;

  companionServerAuthWindowEnabled.value = newState.companionServerAuthWindowEnabled;

  safeStorageAvailable.value = newState.safeStorageAvailable;

  autoUpdaterDisabled.value = newState.autoUpdaterDisabled;

  lastFMAuthenticationStep.value = newState.lastFMAuthenticationStep;

  themeFileMissing.value = newState.themeFileMissing;
  themeUnreadableItems.value = newState.themeUnreadableItems ?? [];
  backgroundVideoFileMissing.value = newState.backgroundVideoFileMissing;

  songRecognitionDevices.value = newState.songRecognitionDevices ?? [];
});

async function decryptApiKey(encrypted: string | null | undefined): Promise<string> {
  if (!encrypted || !safeStorageAvailable.value) return "";

  try {
    return (await safeStorage.decryptString(encrypted)) ?? "";
  } catch {
    return "";
  }
}

const shazamPlatform = window.ytmd.isWindows ? "win32" : isDarwin ? "darwin" : "linux";
const shazamPcAudioAvailable = isPcAudioAvailable(shazamPlatform);
const SHAZAM_DEVICE_OPTION_PREFIX = `${SongRecognitionSourceKind.Device}:`;
const SHAZAM_NOT_CONNECTED_SUFFIX = " (not connected)";

function shazamDeviceOptionValue(deviceId: string) {
  return `${SHAZAM_DEVICE_OPTION_PREFIX}${deviceId}`;
}

// The select holds one string per option: "pc-audio", "default-mic" or "device:<deviceId>"
const shazamAudioSourceValue = computed({
  get() {
    const source = shazamAudioSource.value;
    if (source.kind === SongRecognitionSourceKind.DefaultMic) return SongRecognitionSourceKind.DefaultMic;
    if (source.kind === SongRecognitionSourceKind.Device && source.deviceId !== null) return shazamDeviceOptionValue(source.deviceId);
    return shazamPcAudioAvailable ? SongRecognitionSourceKind.PcAudio : SongRecognitionSourceKind.DefaultMic;
  },
  set(value: string) {
    let source: SongRecognitionSourceSetting;
    if (value.startsWith(SHAZAM_DEVICE_OPTION_PREFIX)) {
      const deviceId = value.slice(SHAZAM_DEVICE_OPTION_PREFIX.length);
      const label =
        songRecognitionDevices.value.find(device => device.deviceId === deviceId)?.label ??
        (shazamAudioSource.value.deviceId === deviceId ? shazamAudioSource.value.label : null);
      source = { kind: SongRecognitionSourceKind.Device, deviceId, label };
    } else if (value === SongRecognitionSourceKind.DefaultMic) {
      source = { kind: SongRecognitionSourceKind.DefaultMic, deviceId: null, label: null };
    } else {
      source = { kind: SongRecognitionSourceKind.PcAudio, deviceId: null, label: null };
    }

    shazamAudioSource.value = source;
    store.set("integrations.shazamAudioSource", source);
  }
});

// A saved device that is not in the list stays selectable, marked as not connected
const shazamSavedDeviceNotConnected = computed(() => {
  const source = shazamAudioSource.value;
  if (source.kind !== SongRecognitionSourceKind.Device || source.deviceId === null) return false;
  return !songRecognitionDevices.value.some(device => device.deviceId === source.deviceId);
});

const shazamAudioSourceOptions = computed(() => {
  const options: { value: string; label: string }[] = [];
  if (shazamPcAudioAvailable) options.push({ value: SongRecognitionSourceKind.PcAudio, label: "PC audio" });
  options.push({ value: SongRecognitionSourceKind.DefaultMic, label: "System default microphone" });
  for (const device of songRecognitionDevices.value) options.push({ value: shazamDeviceOptionValue(device.deviceId), label: device.label });
  if (shazamSavedDeviceNotConnected.value) {
    const source = shazamAudioSource.value;
    options.push({
      value: shazamDeviceOptionValue(source.deviceId ?? ""),
      label: `${source.label ?? source.deviceId}${SHAZAM_NOT_CONNECTED_SUFFIX}`
    });
  }
  return options;
});

const discordPresenceStatusDisplayOptions: Record<DiscordActivityStatusDisplayType, string> = {
  [DiscordActivityStatusDisplayType.Name]: "Application name",
  [DiscordActivityStatusDisplayType.Details]: "First line",
  [DiscordActivityStatusDisplayType.State]: "Second line"
};
const discordPresenceStatusDisplayOrder: DiscordActivityStatusDisplayType[] = [
  DiscordActivityStatusDisplayType.Name,
  DiscordActivityStatusDisplayType.Details,
  DiscordActivityStatusDisplayType.State
];

const discordPresenceTemplateFields = Object.values(TemplateField)
  .map(field => `{${field}}`)
  .join(", ");

// Used by the Discord preview while nothing is playing
const DISCORD_PREVIEW_SAMPLE_VIDEO_DETAILS: VideoDetails = {
  album: "Album",
  albumId: null,
  author: "Artist",
  channelId: "",
  durationSeconds: 0,
  thumbnails: [],
  title: "Song title",
  id: "",
  likeStatus: LikeStatus.Unknown,
  videoType: VideoType.Unknown,
  isLive: false
};

const playerState = ref<PlayerState | null>((await window.ytmd.getPlayerState?.()) ?? null);
window.ytmd.onPlayerStateChanged?.(state => {
  playerState.value = state;
});

const discordPresencePreview = computed(() => {
  const videoDetails = playerState.value?.videoDetails;
  return buildActivity(
    {
      templates: {
        details: discordPresenceDetailsTemplate.value,
        state: discordPresenceStateTemplate.value,
        largeText: discordPresenceLargeTextTemplate.value
      },
      showButton: discordPresenceShowButton.value,
      statusDisplay: discordPresenceStatusDisplay.value
    },
    {
      videoDetails: videoDetails ?? DISCORD_PREVIEW_SAMPLE_VIDEO_DETAILS,
      videoState: videoDetails ? playerState.value.trackState : VideoState.Paused,
      progressSeconds: videoDetails ? playerState.value.videoProgress : 0,
      nowMs: Date.now()
    }
  );
});

async function memorySettingsChanged() {
  memoryStore.set("companionServerAuthWindowEnabled", companionServerAuthWindowEnabled.value);
}

async function settingsChanged() {
  store.set("general.hideToTrayOnClose", hideToTrayOnClose.value);
  store.set("general.showNotificationOnSongChange", showNotificationOnSongChange.value);
  store.set("general.startOnBoot", startOnBoot.value);
  store.set("general.startMinimized", startMinimized.value);
  store.set("general.disableHardwareAcceleration", disableHardwareAcceleration.value);

  store.set("appearance.alwaysShowVolumeSlider", alwaysShowVolumeSlider.value);
  store.set("appearance.customCSSEnabled", customCSSEnabled.value);
  store.set("appearance.zoom", zoom.value);
  store.set("appearance.trayIconStyle", trayIconStyle.value);
  store.set("appearance.theme", theme.value);
  store.set("appearance.backgroundVideoEnabled", backgroundVideoEnabled.value);
  store.set("appearance.backgroundVideoSource", backgroundVideoSource.value);
  store.set("appearance.backgroundVideoMaskOpacity", Number(backgroundVideoMaskOpacity.value));
  store.set("appearance.backgroundVideoMaskBlur", Number(backgroundVideoMaskBlur.value));

  store.set("playback.continueWhereYouLeftOff", continueWhereYouLeftOff.value);
  store.set("playback.continueWhereYouLeftOffPaused", continueWhereYouLeftOffPaused.value);
  store.set("playback.progressInTaskbar", progressInTaskbar.value);
  store.set("playback.enableSpeakerFill", enableSpeakerFill.value);
  store.set("playback.ratioVolume", ratioVolume.value);

  store.set("integrations.companionServerEnabled", companionServerEnabled.value);
  store.set("integrations.companionServerCORSWildcardEnabled", companionServerCORSWildcardEnabled.value);
  store.set("integrations.discordPresenceEnabled", discordPresenceEnabled.value);
  store.set("integrations.discordPresenceDetailsTemplate", discordPresenceDetailsTemplate.value);
  store.set("integrations.discordPresenceStateTemplate", discordPresenceStateTemplate.value);
  store.set("integrations.discordPresenceLargeTextTemplate", discordPresenceLargeTextTemplate.value);
  store.set("integrations.discordPresenceShowButton", discordPresenceShowButton.value);
  store.set("integrations.discordPresenceStatusDisplay", discordPresenceStatusDisplay.value);
  store.set("integrations.lastFMEnabled", lastFMEnabled.value);
  store.set("lastfm.scrobblePercent", scrobblePercent.value);
  store.set("integrations.enhancedMediaServiceEnabled", enhancedMediaServiceEnabled.value);
  store.set("integrations.shazamEnabled", shazamEnabled.value);

  store.set("shortcuts.playPause", shortcutPlayPause.value);
  store.set("shortcuts.next", shortcutNext.value);
  store.set("shortcuts.previous", shortcutPrevious.value);
  store.set("shortcuts.thumbsUp", shortcutThumbsUp.value);
  store.set("shortcuts.thumbsDown", shortcutThumbsDown.value);
  store.set("shortcuts.volumeUp", shortcutVolumeUp.value);
  store.set("shortcuts.volumeDown", shortcutVolumeDown.value);
  store.set("shortcuts.volumeMute", shortcutVolumeMute.value);
  store.set("shortcuts.toggleShuffle", shortcutToggleShuffle.value);
  store.set("shortcuts.toggleRepeat", shortcutToggleRepeat.value);
}

// Text inputs report every keystroke, so each setting is saved on its own once typing pauses
const TEXT_SETTING_SAVE_DELAY_MS = 400;
const pendingTextSettings = new Map<string, { value: unknown; timeout: ReturnType<typeof setTimeout> }>();

function saveTextSetting(key: string) {
  const pending = pendingTextSettings.get(key);
  if (!pending) return;

  clearTimeout(pending.timeout);
  pendingTextSettings.delete(key);
  store.set(key, pending.value);
}

function saveAllTextSettings() {
  for (const key of [...pendingTextSettings.keys()]) saveTextSetting(key);
}

function textSettingChanged(key: string, value: unknown) {
  const pending = pendingTextSettings.get(key);
  if (pending) clearTimeout(pending.timeout);

  pendingTextSettings.set(key, { value, timeout: setTimeout(() => saveTextSetting(key), TEXT_SETTING_SAVE_DELAY_MS) });
}

// The API key is encrypted before it is saved, so it follows the same typing pause on its own
let shazamApiKeySaveTimeout: ReturnType<typeof setTimeout> | null = null;
// The last plaintext key that was saved or loaded. null when a stored key could not be decrypted, so nothing is skipped
const loadedShazamApiKey = shazamApiKey.value.trim();
let lastSavedShazamApiKey: string | null = integrations.shazamApiKey && loadedShazamApiKey === "" ? null : loadedShazamApiKey;

// The encryption runs in the main process, so the save can still be in flight when the window is asked to close
let shazamApiKeySavesInFlight: Promise<void>[] = [];

function saveShazamApiKey(): Promise<void> {
  const save = saveShazamApiKeyNow().finally(() => {
    shazamApiKeySavesInFlight = shazamApiKeySavesInFlight.filter(inFlight => inFlight !== save);
  });
  shazamApiKeySavesInFlight.push(save);
  return save;
}

async function saveShazamApiKeyNow() {
  if (shazamApiKeySaveTimeout !== null) {
    clearTimeout(shazamApiKeySaveTimeout);
    shazamApiKeySaveTimeout = null;
  }
  if (!safeStorageAvailable.value) return;

  const apiKey = shazamApiKey.value.trim();
  // Each encryption gives a different ciphertext, so saving the same key again would restart the integration for nothing
  if (apiKey === lastSavedShazamApiKey) return;

  const previous = lastSavedShazamApiKey;
  lastSavedShazamApiKey = apiKey;
  try {
    store.set("integrations.shazamApiKey", apiKey === "" ? null : await safeStorage.encryptString(apiKey));
  } catch (error) {
    lastSavedShazamApiKey = previous;
    console.error("Failed to save the Shazam API key", error);
  }
}

function shazamApiKeyTyped() {
  if (shazamApiKeySaveTimeout !== null) clearTimeout(shazamApiKeySaveTimeout);
  shazamApiKeySaveTimeout = setTimeout(saveShazamApiKey, TEXT_SETTING_SAVE_DELAY_MS);
}

// Each grooving API key is encrypted before it is saved. Every provider has its own timer, last saved value and in-flight saves,
// so typing in one provider's key never cancels or overwrites another provider's key
type GroovingKeySaver = {
  timeout: ReturnType<typeof setTimeout> | null;
  // The last plaintext key that was saved or loaded. null when a stored key could not be decrypted, so nothing is skipped
  lastSaved: string | null;
  inFlight: Promise<void>[];
};

function createGroovingKeySaver(provider: GroovingProvider): GroovingKeySaver {
  const loaded = groovingApiKeys.value[provider].trim();
  return { timeout: null, lastSaved: integrations.groovingApiKeys?.[provider] && loaded === "" ? null : loaded, inFlight: [] };
}

const groovingKeySavers: Record<GroovingProvider, GroovingKeySaver> = {
  [GroovingProvider.Gemini]: createGroovingKeySaver(GroovingProvider.Gemini),
  [GroovingProvider.Anthropic]: createGroovingKeySaver(GroovingProvider.Anthropic),
  [GroovingProvider.OpenAI]: createGroovingKeySaver(GroovingProvider.OpenAI)
};

function saveGroovingApiKey(provider: GroovingProvider): Promise<void> {
  const saver = groovingKeySavers[provider];
  const save = saveGroovingApiKeyNow(provider).finally(() => {
    saver.inFlight = saver.inFlight.filter(inFlight => inFlight !== save);
  });
  saver.inFlight.push(save);
  return save;
}

async function saveGroovingApiKeyNow(provider: GroovingProvider) {
  const saver = groovingKeySavers[provider];
  if (saver.timeout !== null) {
    clearTimeout(saver.timeout);
    saver.timeout = null;
  }
  if (!safeStorageAvailable.value) return;

  const apiKey = groovingApiKeys.value[provider].trim();
  // Each encryption gives a different ciphertext, so saving the same grooving key again would only cause a needless change
  if (apiKey === saver.lastSaved) return;

  const previous = saver.lastSaved;
  saver.lastSaved = apiKey;
  try {
    store.set(`integrations.groovingApiKeys.${provider}`, apiKey === "" ? null : await safeStorage.encryptString(apiKey));
  } catch (error) {
    saver.lastSaved = previous;
    console.error(`Failed to save the ${GROOVING_PROVIDER_LABELS[provider]} API key`, error);
  }
}

function groovingApiKeyTyped(provider: GroovingProvider) {
  const saver = groovingKeySavers[provider];
  if (saver.timeout !== null) clearTimeout(saver.timeout);
  saver.timeout = setTimeout(() => saveGroovingApiKey(provider), TEXT_SETTING_SAVE_DELAY_MS);
}

function groovingModelTyped(provider: GroovingProvider) {
  // An empty model means the default model, which is stored as null
  const model = groovingModels.value[provider].trim();
  textSettingChanged(`integrations.groovingModels.${provider}`, model === "" ? null : model);
}

function groovingProviderChanged() {
  store.set("integrations.groovingProvider", groovingProvider.value);
}

function groovingLanguageChanged() {
  store.set("integrations.groovingLanguage", groovingLanguage.value);
}

function resetGroovingConsent() {
  groovingConsent.value = null;
  store.set("integrations.groovingConsent", null);
}

function resetEqualizerConsent() {
  equalizerConsent.value = null;
  store.set("equalizer.aiConsentAt", null);
}

const equalizerConsentText = computed(() => {
  const consent = equalizerConsent.value;
  if (!consent) return "Not answered yet";
  const date = new Date(consent);
  return `Consented: ${Number.isNaN(date.getTime()) ? consent : date.toLocaleString()}`;
});

const groovingConsentText = computed(() => {
  switch (groovingConsent.value?.choice) {
    case GroovingConsentChoice.ShareHistory:
      return "Shared";
    case GroovingConsentChoice.NoHistory:
      return "Not shared";
    default:
      return "Not answered yet";
  }
});

// Usage saved in an earlier month counts as 0 for this month.
// Tokens of models not in the price table have no cost, so the cost is unknown when all tokens are unpriced, and a lower bound when some are
function formatUsage(usage: GroovingUsageAmounts | null): string {
  const inputTokens = usage?.inputTokens ?? 0;
  const outputTokens = usage?.outputTokens ?? 0;
  const estimatedUsd = usage?.estimatedUsd ?? 0;
  // Missing in usage saved by an older version
  const unpricedTokens = usage?.unpricedTokens ?? 0;
  const totalTokens = inputTokens + outputTokens;
  const tokensText = `${inputTokens.toLocaleString("en-US")} input / ${outputTokens.toLocaleString("en-US")} output tokens`;
  if (unpricedTokens === 0) return `${tokensText}, about $${estimatedUsd.toFixed(4)}`;
  if (totalTokens > 0 && unpricedTokens >= totalTokens) return `${tokensText}, cost unknown`;
  return `${tokensText}, about $${estimatedUsd.toFixed(4)} + unknown`;
}

const groovingUsageText = computed(() => {
  const usage = groovingUsage.value;
  return formatUsage(usage && usage.month === groovingMonth() ? usage : null);
});
const equalizerUsageText = computed(() => {
  const usage = groovingUsage.value;
  return usage && usage.month === groovingMonth() && usage.equalizer ? formatUsage(usage.equalizer) : null;
});

function groovingKeySavePending(): boolean {
  return groovingProviders.some(provider => groovingKeySavers[provider].timeout !== null || groovingKeySavers[provider].inFlight.length > 0);
}

async function flushGroovingKeySaves() {
  for (const provider of groovingProviders) {
    if (groovingKeySavers[provider].timeout !== null) saveGroovingApiKey(provider);
  }
  await Promise.all(groovingProviders.flatMap(provider => groovingKeySavers[provider].inFlight));
}

function saveAllPendingSettings() {
  saveAllTextSettings();
  if (shazamApiKeySaveTimeout !== null) saveShazamApiKey();
  for (const provider of groovingProviders) {
    if (groovingKeySavers[provider].timeout !== null) saveGroovingApiKey(provider);
  }
}

const SHAZAM_API_KEY_CLOSE_WAIT_MS = 2000;
let closingAfterShazamApiKeySave = false;
let closeWaitTimedOut = false;

async function closeAfterShazamApiKeySave() {
  closingAfterShazamApiKeySave = true;
  let waitTimeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      (async () => {
        if (shazamApiKeySaveTimeout !== null) await saveShazamApiKey();
        await Promise.all(shazamApiKeySavesInFlight);
        await flushGroovingKeySaves();
      })(),
      new Promise<void>(resolve => {
        waitTimeout = setTimeout(() => {
          closeWaitTimedOut = true;
          console.error("The Shazam API key was not saved within 2000 ms, closing anyway");
          resolve();
        }, SHAZAM_API_KEY_CLOSE_WAIT_MS);
      })
    ]);
  } finally {
    clearTimeout(waitTimeout);
    closingAfterShazamApiKeySave = false;
  }
  window.ytmd.closeWindow();
}

function onBeforeUnload(event: BeforeUnloadEvent) {
  saveAllTextSettings();
  if (closeWaitTimedOut) return;

  const keySavePending = shazamApiKeySaveTimeout !== null || shazamApiKeySavesInFlight.length > 0 || groovingKeySavePending();
  if (!keySavePending && !closingAfterShazamApiKeySave) return;

  // Stop this close, finish the save, then close again
  event.preventDefault();
  event.returnValue = "";
  if (!closingAfterShazamApiKeySave) closeAfterShazamApiKeySave();
}

window.addEventListener("beforeunload", onBeforeUnload);
onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", onBeforeUnload);
  saveAllPendingSettings();
});

async function settingChangedRequiresRestart() {
  requiresRestart.value = true;
  settingsChanged();
}

async function settingChangedFile(event: Event) {
  const target = event.target as HTMLInputElement;

  const setting = target.dataset.setting;
  if (!setting) {
    throw new Error("No setting specified in File Input");
  }

  store.set(setting, target.files.length > 0 ? window.ytmd.getTrueFilePath(target.files[0]) : null);

  target.value = null;
}

async function restartDiscordPresence() {
  discordPresenceEnabled.value = false;
  await settingsChanged();
  discordPresenceEnabled.value = true;
  await settingsChanged();
}

async function deleteCompanionAuthToken(appId: string) {
  const index = companionServerAuthTokens.value.findIndex(token => token.appId === appId);
  if (index > -1) {
    companionServerAuthTokens.value.splice(index, 1);
  }

  if (safeStorageAvailable.value)
    store.set("integrations.companionServerAuthTokens", await safeStorage.encryptString(JSON.stringify(companionServerAuthTokens.value)));
}

function removeCustomCSSPath() {
  store.set("appearance.customCSSPath", null);
}

function removeThemeFilePath() {
  store.set("appearance.themeFilePath", null);
}

function removeBackgroundVideoPath() {
  store.set("appearance.backgroundVideoPath", null);
}

function changeTab(newTab: number) {
  currentTab.value = newTab;
}

function restartApplication() {
  window.ytmd.restartApplication();
}

function restartApplicationForUpdate() {
  window.ytmd.restartApplicationForUpdate();
}

function checkForUpdates() {
  window.ytmd.checkForUpdates();
  checkingForUpdate.value = true;
}

async function logoutLastFM() {
  store.set("lastfm.sessionKey", null);
  lastFMEnabled.value = false;
  lastFMSessionKey.value = null;
  await settingsChanged();
}

function stepLastFMAuth() {
  window.ytmd.lastFMStepAuthenticate();
}

window.ytmd.handleCheckingForUpdate(() => {
  checkingForUpdate.value = true;
});

window.ytmd.handleUpdateAvailable(() => {
  checkingForUpdate.value = false;
  updateAvailable.value = true;
  updateNotAvailable.value = false;
});

window.ytmd.handleUpdateNotAvailable(() => {
  checkingForUpdate.value = false;
  updateNotAvailable.value = true;
  updateAvailable.value = false;
});

window.ytmd.handleUpdateDownloaded(() => {
  checkingForUpdate.value = false;
  updateNotAvailable.value = false;
  updateAvailable.value = false;
  updateDownloaded.value = true;
});
</script>

<template>
  <div class="settings-container">
    <div class="content-container">
      <ul class="sidebar tw:border-ytmd-border">
        <li
          :class="{ active: currentTab === 1 }"
          @click="changeTab(1)"
        >
          <span class="material-symbols-outlined">settings_applications</span>General
        </li>
        <li
          :class="{ active: currentTab === 2 }"
          @click="changeTab(2)"
        >
          <span class="material-symbols-outlined">brush</span>Appearance
        </li>
        <li
          :class="{ active: currentTab === 3 }"
          @click="changeTab(3)"
        >
          <span class="material-symbols-outlined">music_note</span>Playback
        </li>
        <li
          :class="{ active: currentTab === 4 }"
          @click="changeTab(4)"
        >
          <span class="material-symbols-outlined">wifi_tethering</span>Integrations
        </li>
        <li
          :class="{ active: currentTab === 5 }"
          @click="changeTab(5)"
        >
          <span class="material-symbols-outlined">keyboard</span>Shortcuts
        </li>
        <span class="push" />
        <li
          :class="{ active: currentTab === 99 }"
          @click="changeTab(99)"
        >
          <span class="material-symbols-outlined">info</span>About
        </li>
      </ul>
      <div class="content">
        <div
          v-if="requiresRestart"
          class="restart-banner tw:bg-ytmd-accent"
        >
          <p class="message">
            <span class="material-symbols-outlined">autorenew</span> Restart app to apply changes
          </p>
          <button
            class="restart-button"
            @click="restartApplication"
          >
            Restart
          </button>
        </div>
        <div
          v-if="currentTab === 1"
          class="general-tab"
        >
          <YTMDSetting
            v-if="!isDarwin"
            v-model="hideToTrayOnClose"
            type="checkbox"
            name="Hide to tray on close"
            @change="settingsChanged"
          />
          <YTMDSetting
            v-model="showNotificationOnSongChange"
            type="checkbox"
            name="Show notification on song change"
            @change="settingsChanged"
          />
          <YTMDSetting
            v-model="startOnBoot"
            type="checkbox"
            name="Start on boot"
            @change="settingsChanged"
          />
          <!--<div class="setting">
            <p>Start minimized</p>
            <input v-model="startMinimized" @change="settingsChanged" class="toggle" type="checkbox" />
          </div>-->
          <YTMDSetting
            v-model="disableHardwareAcceleration"
            type="checkbox"
            restart-required
            name="Disable hardware acceleration"
            @change="settingChangedRequiresRestart"
          />
        </div>

        <div
          v-if="currentTab === 2"
          class="appearance-tab"
        >
          <YTMDSetting
            type="custom"
            name="Theme"
          >
            <select
              v-model="theme"
              class="setting-select tw:bg-ytmd-surface tw:text-ytmd-text tw:border-ytmd-border"
              @change="settingsChanged"
            >
              <option
                v-for="(optionName, optionValue) of themeOptions"
                :key="optionValue"
                :value="optionValue"
              >
                {{ optionName }}
              </option>
            </select>
          </YTMDSetting>
          <YTMDSetting
            v-if="theme === ThemeSelection.File"
            v-model="themeFilePath"
            type="file"
            indented
            bind-setting="appearance.themeFilePath"
            accept=".css"
            name="Theme file path"
            @file-change="settingChangedFile"
            @clear="removeThemeFilePath"
          />
          <div
            v-if="themeFileMissing"
            class="setting indented"
          >
            <p class="appearance-warning tw:text-ytmd-text-muted">
              Theme file not found. Using the Default colors.
            </p>
          </div>
          <div
            v-if="themeUnreadableItems.length > 0"
            class="setting indented"
          >
            <p class="appearance-warning tw:text-ytmd-text-muted">
              Could not read: {{ themeUnreadableItemNames }}. Using the defaults for them.
            </p>
          </div>
          <YTMDSetting
            v-model="backgroundVideoEnabled"
            type="checkbox"
            name="Background video"
            @change="settingsChanged"
          />
          <YTMDSetting
            v-if="backgroundVideoEnabled"
            type="custom"
            indented
            name="Source"
          >
            <select
              v-model="backgroundVideoSource"
              class="setting-select tw:bg-ytmd-surface tw:text-ytmd-text tw:border-ytmd-border"
              @change="settingsChanged"
            >
              <option
                v-for="(optionName, optionValue) of backgroundVideoSourceOptions"
                :key="optionValue"
                :value="optionValue"
              >
                {{ optionName }}
              </option>
            </select>
          </YTMDSetting>
          <YTMDSetting
            v-if="backgroundVideoEnabled && backgroundVideoSource === BackgroundVideoSource.File"
            v-model="backgroundVideoPath"
            type="file"
            indented
            bind-setting="appearance.backgroundVideoPath"
            accept="video/mp4,video/webm,.mp4,.webm"
            name="Background video file path"
            @file-change="settingChangedFile"
            @clear="removeBackgroundVideoPath"
          />
          <div
            v-if="backgroundVideoFileMissing && backgroundVideoSource === BackgroundVideoSource.File"
            class="setting indented"
          >
            <p class="appearance-warning tw:text-ytmd-text-muted">
              Video file not found. The background video is not shown.
            </p>
          </div>
          <YTMDSetting
            v-if="backgroundVideoEnabled"
            v-model="backgroundVideoMaskOpacity"
            type="range"
            indented
            max="100"
            min="0"
            step="5"
            name="Mask opacity"
            @change="settingsChanged"
          />
          <YTMDSetting
            v-if="backgroundVideoEnabled"
            v-model="backgroundVideoMaskBlur"
            type="range"
            indented
            max="20"
            min="0"
            step="1"
            name="Blur"
            @change="settingsChanged"
          />
          <YTMDSetting
            v-model="customCSSEnabled"
            type="checkbox"
            name="Custom CSS"
            @change="settingsChanged"
          />
          <YTMDSetting
            v-if="customCSSEnabled"
            v-model="customCSSPath"
            type="file"
            indented
            bind-setting="appearance.customCSSPath"
            name="Custom CSS file path"
            @file-change="settingChangedFile"
            @clear="removeCustomCSSPath"
          />
          <YTMDSetting
            v-model="alwaysShowVolumeSlider"
            type="checkbox"
            name="Always show volume slider"
            description="This feature only works on the old player bar and may not work for you"
            @change="settingsChanged"
          />
          <YTMDSetting
            v-model="zoom"
            type="range"
            max="300"
            min="30"
            step="10"
            name="Zoom"
            @change="settingsChanged"
          />
          <YTMDSetting
            v-if="isLinux"
            v-model="trayIconStyle"
            :options-map="{ [TrayIconStyle.Auto]: 'Auto', [TrayIconStyle.White]: 'White', [TrayIconStyle.Black]: 'Black' }"
            type="select"
            name="Tray icon style"
            @change="settingsChanged"
          />
        </div>

        <div
          v-if="currentTab === 3"
          class="playback-tab"
        >
          <YTMDSetting
            v-model="continueWhereYouLeftOff"
            name="Continue where you left off"
            description="If you're signed in this feature can be turned off"
            type="checkbox"
            @change="settingsChanged"
          />
          <YTMDSetting
            v-if="continueWhereYouLeftOff"
            v-model="continueWhereYouLeftOffPaused"
            type="checkbox"
            indented
            name="Pause on application launch"
            @change="settingsChanged"
          />
          <YTMDSetting
            v-model="progressInTaskbar"
            type="checkbox"
            name="Show track progress on taskbar"
            @change="settingsChanged"
          />
          <YTMDSetting
            v-model="enableSpeakerFill"
            type="checkbox"
            restart-required
            name="Enable speaker fill"
            @change="settingChangedRequiresRestart"
          />
          <YTMDSetting
            v-model="ratioVolume"
            type="checkbox"
            name="Ratio volume"
            @change="settingsChanged"
          />
        </div>

        <div
          v-if="currentTab === 4"
          class="integrations-tab"
        >
          <YTMDSetting
            v-model="companionServerEnabled"
            type="checkbox"
            name="Companion server"
            :disabled="!safeStorageAvailable"
            disabled-message="This integration cannot be enabled due to safeStorage being unavailable"
            @change="settingsChanged"
          />
          <YTMDSetting
            v-if="companionServerEnabled && safeStorageAvailable"
            v-model="companionServerCORSWildcardEnabled"
            type="checkbox"
            indented
            name="Allow browser communication"
            description="This setting could be dangerous as it allows any website you visit to communicate with the companion server"
            @change="settingsChanged"
          />
          <YTMDSetting
            v-if="companionServerEnabled && safeStorageAvailable"
            v-model="companionServerAuthWindowEnabled"
            type="checkbox"
            indented
            name="Enable companion authorization"
            description="Automatically disables after the first successful authorization or 5 minutes has passed"
            @change="memorySettingsChanged"
          />
          <YTMDSetting
            v-if="companionServerEnabled && safeStorageAvailable"
            type="custom"
            flex-column
            indented
            name="Authorized companions"
            description="This is a list of companions that currently have access to the companion server"
            @change="settingsChanged"
          >
            <table class="authorized-companions-table">
              <thead>
                <tr>
                  <th class="companion">
                    Companion
                  </th>
                  <th class="version">
                    Version
                  </th>
                  <th class="controls" />
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="authToken in companionServerAuthTokens"
                  :key="authToken.appId"
                >
                  <td class="companion">
                    <span class="name">{{ authToken.appName }}</span><br>
                    <span class="id">{{ authToken.appId }}</span>
                  </td>
                  <td class="version">
                    {{ authToken.appVersion }}
                  </td>
                  <td class="controls">
                    <button @click="deleteCompanionAuthToken(authToken.appId)">
                      <span class="material-symbols-outlined">delete</span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div
              v-if="companionServerAuthTokens.length === 0"
              class="no-authorized-companions tw:text-ytmd-text-muted"
            >
              <td>No authorized companions</td>
            </div>
          </YTMDSetting>
          <YTMDSetting
            v-model="discordPresenceEnabled"
            type="checkbox"
            name="Discord rich presence"
            @change="settingsChanged"
          />
          <div
            v-if="discordPresenceEnabled && discordPresenceConnectionFailed"
            class="setting indented"
          >
            <p class="discord-failure tw:text-ytmd-text-muted">
              Discord could not be found. YTMDesktop keeps trying to connect in the background.
            </p>
            <button @click="restartDiscordPresence">
              Retry
            </button>
          </div>
          <template v-if="discordPresenceEnabled">
            <div class="setting indented">
              <p class="discord-template-fields tw:text-ytmd-text-muted">
                Available fields: {{ discordPresenceTemplateFields }}
              </p>
            </div>
            <YTMDSetting
              v-model="discordPresenceDetailsTemplate"
              type="text"
              name="First line"
              indented
              @change="textSettingChanged('integrations.discordPresenceDetailsTemplate', discordPresenceDetailsTemplate)"
            />
            <YTMDSetting
              v-model="discordPresenceStateTemplate"
              type="text"
              name="Second line"
              indented
              @change="textSettingChanged('integrations.discordPresenceStateTemplate', discordPresenceStateTemplate)"
            />
            <YTMDSetting
              v-model="discordPresenceLargeTextTemplate"
              type="text"
              name="Album art tooltip"
              indented
              @change="textSettingChanged('integrations.discordPresenceLargeTextTemplate', discordPresenceLargeTextTemplate)"
            />
            <YTMDSetting
              v-model="discordPresenceShowButton"
              type="checkbox"
              name="Show 'Play on YTMDesktop' button"
              indented
              @change="settingsChanged"
            />
            <YTMDSetting
              v-model="discordPresenceStatusDisplay"
              type="select"
              name="Shown in the member list"
              :options-map="discordPresenceStatusDisplayOptions"
              :options-order="discordPresenceStatusDisplayOrder"
              indented
              @change="settingsChanged"
            />
            <div class="setting indented">
              <div class="discord-preview tw:bg-ytmd-surface tw:border-ytmd-border">
                <p class="discord-preview-title tw:text-ytmd-text-muted">
                  Preview
                </p>
                <p class="discord-preview-line">
                  {{ discordPresencePreview.details }}
                </p>
                <p
                  v-if="discordPresencePreview.state"
                  class="discord-preview-line"
                >
                  {{ discordPresencePreview.state }}
                </p>
                <p
                  v-if="discordPresencePreview.assets?.large_text"
                  class="discord-preview-line tw:text-ytmd-text-muted"
                >
                  Album art tooltip: {{ discordPresencePreview.assets.large_text }}
                </p>
                <span
                  v-for="button of discordPresencePreview.buttons ?? []"
                  :key="button.label"
                  class="discord-preview-button tw:border-ytmd-border"
                >{{ button.label }}</span>
              </div>
            </div>
          </template>
          <YTMDSetting
            v-model="lastFMEnabled"
            type="checkbox"
            name="Last.fm scrobbling"
            :disabled="!safeStorageAvailable"
            disabled-message="This integration cannot be enabled due to safeStorage being unavailable"
            @change="settingsChanged"
          />
          <div
            v-if="lastFMEnabled"
            class="setting indented"
          >
            <div class="name-with-description">
              <p class="description">
                User is Authenticated:
                <span
                  v-if="lastFMSessionKey"
                  style="color: #4caf50"
                >Yes</span>
                <span
                  v-else
                  style="color: #ff1100"
                >No</span>
              </p>
            </div>
            <button
              v-if="lastFMSessionKey"
              @click="logoutLastFM"
            >
              Logout
            </button>
          </div>
          <div
            v-if="lastFMEnabled && lastFMAuthenticationStep === 0"
            class="setting indented"
          >
            <p>
              Continue setup in your browser then come back here when you're done
            </p>
            <button @click="stepLastFMAuth">
              Authorize Last.fm in browser
            </button>
          </div>
          <div
            v-if="lastFMEnabled && lastFMAuthenticationStep === 1"
            class="setting indented"
          >
            <p>
              After you're done in the browser click "Finish Last.fm authentication"
            </p>
            <button @click="stepLastFMAuth">
              Finish Last.fm authentication
            </button>
          </div>
          <YTMDSetting
            v-if="lastFMEnabled"
            v-model="scrobblePercent"
            class="settings indented"
            type="range"
            name="Scrobble percent"
            description="Determines when a song is scrobbled"
            min="50"
            max="95"
            step="5"
            @change="settingsChanged"
          />
          <YTMDSetting
            v-model="enhancedMediaServiceEnabled"
            type="checkbox"
            restart-required
            name="Enhanced media service"
            description="An enhanced media service that can provide better media button controls"
            :disabled="isDarwin"
            disabled-message="This integration is not available on your platform"
            beta
            @change="settingChangedRequiresRestart"
          />
          <YTMDSetting
            v-model="shazamEnabled"
            type="checkbox"
            name="Shazam"
            description="Identify the song that is playing and search for it on YouTube Music"
            :disabled="!safeStorageAvailable"
            disabled-message="This integration cannot be enabled due to safeStorage being unavailable"
            @change="settingsChanged"
          />
          <YTMDSetting
            v-if="shazamEnabled && safeStorageAvailable"
            type="custom"
            indented
            name="API key"
          >
            <input
              v-model="shazamApiKey"
              class="shazam-api-key-input tw:bg-ytmd-surface tw:text-ytmd-text tw:border-ytmd-border"
              type="password"
              aria-label="API key"
              autocomplete="off"
              spellcheck="false"
              @input="shazamApiKeyTyped"
              @change="saveShazamApiKey"
            >
            <a
              class="shazam-api-key-link"
              :href="SHAZAM_API_KEY_URL"
              target="_blank"
            >Get an API key</a>
          </YTMDSetting>
          <YTMDSetting
            v-if="shazamEnabled"
            type="custom"
            indented
            name="Audio source"
          >
            <select
              v-model="shazamAudioSourceValue"
              class="setting-select tw:bg-ytmd-surface tw:text-ytmd-text tw:border-ytmd-border"
            >
              <option
                v-for="option of shazamAudioSourceOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </YTMDSetting>
          <div
            v-if="shazamEnabled && shazamSavedDeviceNotConnected"
            class="setting indented"
          >
            <p class="appearance-warning tw:text-ytmd-text-muted">
              The system default microphone is used until it is connected.
            </p>
          </div>
          <div class="setting">
            <h3 class="grooving-heading">
              Grooving
            </h3>
          </div>
          <YTMDSetting
            type="custom"
            name="Provider"
          >
            <select
              v-model="groovingProvider"
              class="setting-select tw:bg-ytmd-surface tw:text-ytmd-text tw:border-ytmd-border"
              aria-label="Provider"
              @change="groovingProviderChanged"
            >
              <option
                v-for="provider of groovingProviders"
                :key="provider"
                :value="provider"
              >
                {{ GROOVING_PROVIDER_LABELS[provider] }}
              </option>
            </select>
          </YTMDSetting>
          <YTMDSetting
            type="custom"
            name="API key"
            :disabled="!safeStorageAvailable"
            disabled-message="The API key cannot be saved due to safeStorage being unavailable"
          >
            <input
              :key="groovingProvider"
              v-model="groovingApiKeys[groovingProvider]"
              class="shazam-api-key-input tw:bg-ytmd-surface tw:text-ytmd-text tw:border-ytmd-border"
              type="password"
              aria-label="API key"
              autocomplete="off"
              spellcheck="false"
              :disabled="!safeStorageAvailable"
              @input="groovingApiKeyTyped(groovingProvider)"
              @change="saveGroovingApiKey(groovingProvider)"
            >
            <a
              class="shazam-api-key-link"
              :href="GROOVING_API_KEY_URLS[groovingProvider]"
              target="_blank"
            >Get an API key</a>
          </YTMDSetting>
          <YTMDSetting
            type="custom"
            name="Model"
          >
            <input
              :key="groovingProvider"
              v-model="groovingModels[groovingProvider]"
              class="shazam-api-key-input tw:bg-ytmd-surface tw:text-ytmd-text tw:border-ytmd-border"
              type="text"
              aria-label="Model"
              autocomplete="off"
              spellcheck="false"
              :placeholder="GROOVING_DEFAULT_MODELS[groovingProvider]"
              @input="groovingModelTyped(groovingProvider)"
            >
          </YTMDSetting>
          <YTMDSetting
            type="custom"
            name="Language"
            description="Language of the Grooving screen. Auto follows YouTube Music's language."
          >
            <select
              v-model="groovingLanguage"
              class="setting-select tw:bg-ytmd-surface tw:text-ytmd-text tw:border-ytmd-border"
              aria-label="Language"
              @change="groovingLanguageChanged"
            >
              <option
                v-for="language of groovingLanguages"
                :key="language"
                :value="language"
              >
                {{ GROOVING_LANGUAGE_LABELS[language] }}
              </option>
            </select>
          </YTMDSetting>
          <YTMDSetting
            type="custom"
            name="History sharing"
          >
            <span class="grooving-value tw:text-ytmd-text-muted">{{ groovingConsentText }}</span>
            <button
              class="tw:bg-ytmd-surface tw:text-ytmd-text"
              :disabled="groovingConsent === null"
              @click="resetGroovingConsent"
            >
              Reset
            </button>
          </YTMDSetting>
          <YTMDSetting
            type="custom"
            name="EQ AI adjustment consent"
          >
            <span class="grooving-value tw:text-ytmd-text-muted">{{ equalizerConsentText }}</span>
            <button
              v-if="equalizerConsent !== null"
              class="tw:bg-ytmd-surface tw:text-ytmd-text"
              @click="resetEqualizerConsent"
            >
              Reset
            </button>
          </YTMDSetting>
          <YTMDSetting
            type="custom"
            name="This month"
          >
            <span class="grooving-usage">
              <span class="grooving-value tw:text-ytmd-text-muted">{{ groovingUsageText }}</span>
              <span v-if="equalizerUsageText" class="grooving-value tw:text-ytmd-text-muted">of which EQ: {{ equalizerUsageText }}</span>
            </span>
          </YTMDSetting>
        </div>

        <div
          v-if="currentTab === 5"
          class="shortcuts-tab"
        >
          <div class="setting">
            <p class="shortcut-title">
              Play/Pause<span
                v-if="shortcutsPlayPauseRegisterFailed"
                class="material-symbols-outlined register-error"
                title="Failed to register keybind. Does another application have this keybind?"
              >error</span>
            </p>
            <KeybindInput
              v-model="shortcutPlayPause"
              @change="settingsChanged"
            />
          </div>
          <div class="setting">
            <p class="shortcut-title">
              Next<span
                v-if="shortcutsNextRegisterFailed"
                class="material-symbols-outlined register-error"
                title="Failed to register keybind. Does another application have this keybind?"
              >error</span>
            </p>
            <KeybindInput
              v-model="shortcutNext"
              @change="settingsChanged"
            />
          </div>
          <div class="setting">
            <p class="shortcut-title">
              Previous<span
                v-if="shortcutsPreviousRegisterFailed"
                class="material-symbols-outlined register-error"
                title="Failed to register keybind. Does another application have this keybind?"
              >error</span>
            </p>
            <KeybindInput
              v-model="shortcutPrevious"
              @change="settingsChanged"
            />
          </div>
          <div class="setting">
            <p class="shortcut-title">
              Thumbs Up<span
                v-if="shortcutsThumbsUpRegisterFailed"
                class="material-symbols-outlined register-error"
                title="Failed to register keybind. Does another application have this keybind?"
              >error</span>
            </p>
            <KeybindInput
              v-model="shortcutThumbsUp"
              @change="settingsChanged"
            />
          </div>
          <div class="setting">
            <p class="shortcut-title">
              Thumbs Down<span
                v-if="shortcutsThumbsDownRegisterFailed"
                class="material-symbols-outlined register-error"
                title="Failed to register keybind. Does another application have this keybind?"
              >error</span>
            </p>
            <KeybindInput
              v-model="shortcutThumbsDown"
              @change="settingsChanged"
            />
          </div>
          <div class="setting">
            <p class="shortcut-title">
              Increase Volume<span
                v-if="shortcutsVolumeUpRegisterFailed"
                class="material-symbols-outlined register-error"
                title="Failed to register keybind. Does another application have this keybind?"
              >error</span>
            </p>
            <KeybindInput
              v-model="shortcutVolumeUp"
              @change="settingsChanged"
            />
          </div>
          <div class="setting">
            <p class="shortcut-title">
              Decrease Volume<span
                v-if="shortcutsVolumeDownRegisterFailed"
                class="material-symbols-outlined register-error"
                title="Failed to register keybind. Does another application have this keybind?"
              >error</span>
            </p>
            <KeybindInput
              v-model="shortcutVolumeDown"
              @change="settingsChanged"
            />
          </div>
          <div class="setting">
            <p class="shortcut-title">
              Mute Volume<span
                v-if="shortcutsVolumeMuteRegisterFailed"
                class="material-symbols-outlined register-error"
                title="Failed to register keybind. Does another application have this keybind?"
              >error</span>
            </p>
            <KeybindInput
              v-model="shortcutVolumeMute"
              @change="settingsChanged"
            />
          </div>
          <div class="setting">
            <p class="shortcut-title">
              Toggle Shuffle<span
                v-if="shortcutsToggleShuffleRegisterFailed"
                class="material-symbols-outlined register-error"
                title="Failed to register keybind. Does another application have this keybind?"
              >error</span>
            </p>
            <KeybindInput
              v-model="shortcutToggleShuffle"
              @change="settingsChanged"
            />
          </div>
          <div class="setting">
            <p class="shortcut-title">
              Toggle Repeat<span
                v-if="shortcutsToggleRepeatRegisterFailed"
                class="material-symbols-outlined register-error"
                title="Failed to register keybind. Does another application have this keybind?"
              >error</span>
            </p>
            <KeybindInput
              v-model="shortcutToggleRepeat"
              @change="settingsChanged"
            />
          </div>
        </div>

        <div
          v-if="currentTab === 99"
          class="about-tab"
        >
          <img
            class="icon"
            :src="logo"
          >
          <h2 class="app-name">
            YTMDesktop
          </h2>
          <p class="made-by">
            Made by YTMDesktop Team
          </p>
          <template v-if="!autoUpdaterDisabled">
            <button
              v-if="!updateDownloaded"
              :disabled="!(!checkingForUpdate && !updateAvailable && !updateDownloaded)"
              class="update-check-button"
              @click="checkForUpdates"
            >
              <span class="material-symbols-outlined">update</span>Check for updates
            </button>
            <button
              v-if="updateDownloaded"
              class="update-button"
              @click="restartApplicationForUpdate"
            >
              <span class="material-symbols-outlined">upgrade</span>Restart to update
            </button>
            <p
              v-if="checkingForUpdate && !updateAvailable && !updateDownloaded"
              class="updating tw:text-ytmd-text-muted"
            >
              <span class="material-symbols-outlined">progress_activity</span>Checking for updates...
            </p>
            <p
              v-if="updateAvailable && !updateDownloaded"
              class="updating tw:text-ytmd-text-muted"
            >
              <span class="material-symbols-outlined">progress_activity</span>Downloading update...
            </p>
            <p
              v-if="updateNotAvailable"
              class="no-update tw:text-ytmd-text-muted"
            >
              Update not available
            </p>
          </template>
          <template v-if="autoUpdaterDisabled">
            <button
              disabled
              class="update-check-button"
            >
              <span class="material-symbols-outlined">update</span>Check for updates
            </button>
            <p class="no-auto-updater tw:text-ytmd-text-muted">
              Auto updater disabled
            </p>
            <p class="no-auto-updater tw:text-ytmd-text-muted">
              Platform or build does not support automatic updates
            </p>
          </template>
          <span class="version-info">
            <p>Version: {{ ytmdVersion }}</p>
            <p>Branch: {{ ytmdBranch ?? "None" }}</p>
            <p>Commit: {{ ytmdCommitHash ?? "None" }}</p>
            <div class="divider"></div>
            <p>Electron: {{ processVersions.electron }}</p>
            <p>Chrome: {{ processVersions.chrome }}</p>
          </span>
          <div class="links">
            <a
              href="https://github.com/ytmdesktop/ytmdesktop"
              target="_blank"
            >GitHub</a>
            <a
              href="https://ytmdesktop.github.io/"
              target="_blank"
            >Website</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-container {
  user-select: none;
}

.content-container {
  display: flex;
  height: 100%;
}

.content {
  overflow: auto;
  flex-grow: 1;
  padding: 4px 16px;
}

.content::-webkit-scrollbar {
  width: 12px;
}

.content::-webkit-scrollbar-track {
  background: var(--ytmd-color-surface);
}

.content::-webkit-scrollbar-thumb {
  background-color: color-mix(in srgb, var(--ytmd-color-text) 15%, transparent);
}

.sidebar {
  width: 25%;
  min-width: 25%;
  list-style-type: none;
  margin: unset;
  padding: unset;
  height: 100%;
  border-right-width: 1px;
  border-right-style: solid;
  display: flex;
  flex-direction: column;
}

.sidebar li {
  display: flex;
  align-items: center;
  padding: 16px;
  cursor: pointer;
  color: var(--ytmd-color-text-muted);
}

.sidebar li .material-symbols-outlined {
  font-size: 28px;
  font-variation-settings:
    "FILL" 0,
    "wght" 100,
    "GRAD" 0,
    "opsz" 28;
}

.sidebar li:hover {
  background-color: color-mix(in srgb, var(--ytmd-color-surface) 50%, transparent);
}

.sidebar li.active {
  background-color: var(--ytmd-color-surface);
  color: var(--ytmd-color-text);
}

.sidebar li .material-symbols-outlined {
  margin-right: 8px;
}

.sidebar .push {
  flex-grow: 1;
}

.setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.setting.indented {
  margin-left: 12px;
  padding-left: 12px;
  border-left: 1px solid var(--ytmd-color-border);
}

.name-with-description .name {
  margin-bottom: unset;
}

.name-with-description .description {
  margin-top: 4px;
  color: var(--ytmd-color-text-muted);
}

.about-tab {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  height: 100%;
}

.icon {
  width: 128px;
  height: 128px;
  margin-bottom: 16px;
}

.app-name {
  margin: 0;
}

.version-info p {
  margin: 4px 0;
  color: var(--ytmd-color-text-muted);
}

.version-info .divider {
  background-color: color-mix(in srgb, var(--ytmd-color-text) 25%, transparent);
  height: 1px;
  margin: 8px 0;
}

.made-by {
  margin: 16px 0;
}

.links {
  margin-top: 32px;
  width: 100%;
  display: flex;
  justify-content: space-evenly;
}

.links a {
  color: var(--ytmd-color-text-muted);
}

.restart-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.restart-banner .message {
  display: flex;
  align-items: center;
}

.restart-banner .message .material-symbols-outlined {
  margin: 0 8px;
}

.restart-banner .restart-button {
  margin: 0 8px;
  background-color: transparent;
  border: 1px solid var(--ytmd-color-text);
  border-radius: 4px;
  padding: 8px 16px;
  cursor: pointer;
}

.update-check-button {
  display: flex;
  align-items: center;
  background-color: transparent;
  border: 1px solid var(--ytmd-color-text);
  border-radius: 4px;
  padding: 4px 8px;
  margin-bottom: 8px;
  cursor: pointer;
}

.update-check-button:disabled {
  border: 1px solid var(--ytmd-color-text-muted);
  cursor: not-allowed;
}

.updating,
.no-update {
  display: flex;
  align-items: center;
  margin: 0 0 8px 0;
}

.no-auto-updater {
  display: flex;
  align-items: center;
  margin: 0 0 8px 0;
}

.updating .material-symbols-outlined {
  animation: rotation 1s infinite linear;
}

@keyframes rotation {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(359deg);
  }
}

.update-button {
  display: flex;
  align-items: center;
  background-color: var(--ytmd-color-accent);
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  margin-bottom: 8px;
  cursor: pointer;
}

.update-check-button .material-symbols-outlined,
.updating .material-symbols-outlined,
.update-button .material-symbols-outlined {
  margin-right: 4px;
}

.version-info {
  user-select: text;
}

.setting.disabled {
  color: var(--ytmd-color-text-muted);
}

.authorized-companions-table {
  width: 100%;
  table-layout: fixed;
}

.authorized-companions-table tr .companion {
  width: 70%;
  word-wrap: break-word;
}

.authorized-companions-table tr .companion .id {
  color: var(--ytmd-color-text-muted);
  font-size: 14px;
}

.authorized-companions-table tbody tr .version {
  word-wrap: break-word;
}

.authorized-companions-table tr th,
.authorized-companions-table tr td {
  padding: 4px;
}

.authorized-companions-table th {
  text-align: left;
}

.authorized-companions-table thead tr th {
  border-bottom: 1px solid var(--ytmd-color-border);
}
.authorized-companions-table thead tr .controls {
  width: 48px;
}

.authorized-companions-table tbody button {
  border-radius: 4px;
  padding: 4px;
  display: flex;
  align-items: center;
  background-color: var(--ytmd-color-surface);
  cursor: pointer;
  border: none;
}

.no-authorized-companions {
  padding: 4px;
}

.discord-failure {
  margin: 0;
}

.discord-template-fields {
  margin: 0;
}

.discord-preview {
  width: 100%;
  margin: 8px 0;
  padding: 8px 12px;
  border-radius: 4px;
  border-width: 1px;
  border-style: solid;
}

.discord-preview-title {
  margin: 0 0 4px 0;
  font-size: 12px;
}

.discord-preview-line {
  margin: 0 0 4px 0;
  overflow-wrap: anywhere;
}

.discord-preview-button {
  display: inline-block;
  margin-top: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  border-width: 1px;
  border-style: solid;
}

.appearance-warning {
  margin: 0;
}

.shazam-api-key-input {
  width: 216px;
  padding: 8px;
  border-radius: 4px;
  border-width: 1px;
  border-style: solid;
}

.shazam-api-key-link {
  margin-left: 8px;
  color: var(--ytmd-color-accent);
  white-space: nowrap;
}

.grooving-heading {
  margin: 12px 0 0;
  font-size: 1.1em;
  font-weight: bold;
}

.grooving-value {
  margin-right: 8px;
}

/* The month's total and the EQ part of it stack, so the row's name keeps its line */
.grooving-usage {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  text-align: right;
  white-space: nowrap;
}

.setting-select {
  width: 216px;
  padding: 8px;
  border-radius: 4px;
  border-width: 1px;
  border-style: solid;
  cursor: pointer;
}

/* The drop-down list is drawn by the OS, which paints a see-through option background as white, so the options get the
   theme's solid background */
.setting-select option {
  background-color: var(--ytmd-color-background);
  color: var(--ytmd-color-text);
}

button {
  margin: 3px 3px 3px 4px;
  border-radius: 4px;
  padding: 8px;
  display: flex;
  align-items: center;
  background-color: var(--ytmd-color-surface);
  cursor: pointer;
  border: none;
}

.shortcuts-tab .shortcut-title {
  display: flex;
  justify-content: center;
  align-items: center;
}

.shortcuts-tab .shortcut-title .register-error {
  margin-left: 4px;
  color: #f44336;
}
</style>
