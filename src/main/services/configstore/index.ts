import Conf from "conf";
import { app, ipcMain } from "electron";
import log from "electron-log";
import { BackgroundVideoSource } from "~shared/background-video";
import { DEFAULT_PRESENCE_DISPLAY_SETTINGS } from "~shared/discord-presence/activity";
import { GroovingLanguage, GroovingProvider } from "~shared/grooving";
import { DEFAULT_SONG_RECOGNITION_SOURCE } from "~shared/song-recognition";
import { StoreSchema, ThemeSelection, TrayIconStyle } from "~shared/store/schema";
import { DependencyConstructor, Paths, ValueAtPath } from "~shared/types";
import Service from "../service";
import AppWindowManager from "../windowmanager";

export default class ConfigStore extends Service {
  public static override readonly dependencies: DependencyConstructor<Service>[] = [AppWindowManager];

  private conf!: Conf<StoreSchema>;

  private _initialized = false;
  public get initialized() {
    return this._initialized;
  }

  public override onPreInitialized() {
    this.conf = new Conf<StoreSchema>({
      configName: "config",
      cwd: app.getPath("userData"),
      projectVersion: app.getVersion(),
      watch: true,
      defaults: {
        metadata: {
          version: 1,
          appVersion: app.getVersion()
        },
        general: {
          disableHardwareAcceleration: false,
          hideToTrayOnClose: false,
          showNotificationOnSongChange: false,
          startOnBoot: false,
          startMinimized: false
        },
        appearance: {
          alwaysShowVolumeSlider: false,
          customCSSEnabled: false,
          customCSSPath: null,
          zoom: 100,
          trayIconStyle: TrayIconStyle.Auto,
          theme: ThemeSelection.Glass,
          themeFilePath: null,
          backgroundVideoEnabled: true,
          backgroundVideoSource: BackgroundVideoSource.Playing,
          backgroundVideoPath: null,
          backgroundVideoMaskOpacity: 60,
          backgroundVideoMaskBlur: 8
        },
        playback: {
          continueWhereYouLeftOff: true,
          continueWhereYouLeftOffPaused: true,
          enableSpeakerFill: false,
          progressInTaskbar: false,
          ratioVolume: false
        },
        integrations: {
          companionServerEnabled: false,
          companionServerAuthTokens: null,
          companionServerCORSWildcardEnabled: true,
          discordPresenceEnabled: false,
          discordPresenceDetailsTemplate: DEFAULT_PRESENCE_DISPLAY_SETTINGS.templates.details,
          discordPresenceStateTemplate: DEFAULT_PRESENCE_DISPLAY_SETTINGS.templates.state,
          discordPresenceLargeTextTemplate: DEFAULT_PRESENCE_DISPLAY_SETTINGS.templates.largeText,
          discordPresenceShowButton: DEFAULT_PRESENCE_DISPLAY_SETTINGS.showButton,
          discordPresenceStatusDisplay: DEFAULT_PRESENCE_DISPLAY_SETTINGS.statusDisplay,
          lastFMEnabled: false,
          enhancedMediaServiceEnabled: true,
          shazamEnabled: false,
          shazamApiKey: null,
          shazamAudioSource: DEFAULT_SONG_RECOGNITION_SOURCE,
          groovingProvider: GroovingProvider.Gemini,
          groovingApiKeys: { gemini: null, anthropic: null, openai: null },
          groovingModels: { gemini: null, anthropic: null, openai: null },
          groovingConsent: null,
          groovingUsage: null,
          groovingLanguage: GroovingLanguage.Auto,
          groovingContinue: false
        },
        shortcuts: {
          playPause: "",
          next: "",
          previous: "",
          thumbsUp: "",
          thumbsDown: "",
          volumeUp: "",
          volumeDown: "",
          volumeMute: "",
          toggleShuffle: "",
          toggleRepeat: ""
        },
        state: {
          lastUrl: "https://music.youtube.com/",
          lastPlaylistId: "",
          lastVideoId: "",
          lastVideoProgress: 0,
          windowBounds: null,
          windowMaximized: false,
          miniplayerWindowBounds: null,
          groovingRunInProgress: false,
          groovingNoticePending: false
        },
        lastfm: {
          sessionKey: null,
          scrobblePercent: 50
        },
        developer: {
          enableDevTools: false
        }
      },
      beforeEachMigration: (store, context) => {
        log.info(`Performing store migration from ${context.fromVersion} to ${context.toVersion}`);
      },
      migrations: {
        ">=2.0.0": store => {
          // @ts-expect-error Removed property which will error in TypeScript
          store.delete("integrations.companionServerAuthWindowEnabled");
          // @ts-expect-error Removed property which will error in TypeScript
          store.delete("state.companionServerAuthWindowEnableTime");
          if (!store.has("appearance.zoom")) {
            store.set("appearance.zoom", 100);
          }
        },
        ">=2.0.1": store => {
          if (!store.has("lastfm.scrobblePercent")) {
            store.set("lastfm.scrobblePercent", 50);
          }
        },
        ">=2.0.7": store => {
          if (!store.has("appearance.trayIconStyle")) {
            store.set("appearance.trayIconStyle", 0);
          }
        },
        ">=2.1.0": store => {
          if (!store.has("shortcuts.volumeMute")) {
            store.set("shortcuts.volumeMute", "");
          }

          if (!store.has("shortcuts.toggleShuffle")) {
            store.set("shortcuts.toggleShuffle", "");
          }

          if (!store.has("shortcuts.toggleRepeat")) {
            store.set("shortcuts.toggleRepeat", "");
          }

          if (!store.has("integrations.enhancedMediaServiceEnabled")) {
            store.set("integrations.enhancedMediaServiceEnabled", true);
          }

          if (!store.has("state.miniplayerWindowBounds")) {
            store.set("state.miniplayerWindowBounds", null);
          }

          if (!store.has("metadata.appVersion")) {
            store.set("metadata.appVersion", "2.0.10");
          }

          // @ts-expect-error Removed store key
          if (store.has("lastfm.api_key")) {
            // @ts-expect-error Removed store key
            store.delete("lastfm.api_key");
          }

          // @ts-expect-error Removed store key
          if (store.has("lastfm.secret")) {
            // @ts-expect-error Removed store key
            store.delete("lastfm.secret");
          }

          // @ts-expect-error Removed store key
          if (store.has("lastfm.token")) {
            // @ts-expect-error Removed store key
            store.delete("lastfm.token");
          }
        },
        ">=2.2.0": store => {
          if (!store.has("appearance.theme")) {
            store.set("appearance.theme", ThemeSelection.Glass);
          }

          if (!store.has("appearance.themeFilePath")) {
            store.set("appearance.themeFilePath", null);
          }

          if (!store.has("appearance.backgroundVideoEnabled")) {
            store.set("appearance.backgroundVideoEnabled", true);
          }

          if (!store.has("appearance.backgroundVideoSource")) {
            store.set("appearance.backgroundVideoSource", BackgroundVideoSource.Playing);
          }

          if (!store.has("appearance.backgroundVideoPath")) {
            store.set("appearance.backgroundVideoPath", null);
          }

          if (!store.has("appearance.backgroundVideoMaskOpacity")) {
            store.set("appearance.backgroundVideoMaskOpacity", 60);
          }

          if (!store.has("appearance.backgroundVideoMaskBlur")) {
            store.set("appearance.backgroundVideoMaskBlur", 8);
          }

          if (!store.has("integrations.discordPresenceDetailsTemplate")) {
            store.set("integrations.discordPresenceDetailsTemplate", DEFAULT_PRESENCE_DISPLAY_SETTINGS.templates.details);
          }

          if (!store.has("integrations.discordPresenceStateTemplate")) {
            store.set("integrations.discordPresenceStateTemplate", DEFAULT_PRESENCE_DISPLAY_SETTINGS.templates.state);
          }

          if (!store.has("integrations.discordPresenceLargeTextTemplate")) {
            store.set("integrations.discordPresenceLargeTextTemplate", DEFAULT_PRESENCE_DISPLAY_SETTINGS.templates.largeText);
          }

          if (!store.has("integrations.discordPresenceShowButton")) {
            store.set("integrations.discordPresenceShowButton", DEFAULT_PRESENCE_DISPLAY_SETTINGS.showButton);
          }

          if (!store.has("integrations.discordPresenceStatusDisplay")) {
            store.set("integrations.discordPresenceStatusDisplay", DEFAULT_PRESENCE_DISPLAY_SETTINGS.statusDisplay);
          }

          if (!store.has("integrations.shazamEnabled")) {
            store.set("integrations.shazamEnabled", false);
          }

          if (!store.has("integrations.shazamApiKey")) {
            store.set("integrations.shazamApiKey", null);
          }

          if (!store.has("integrations.shazamAudioSource")) {
            store.set("integrations.shazamAudioSource", DEFAULT_SONG_RECOGNITION_SOURCE);
          }

          if (!store.has("integrations.groovingProvider")) {
            store.set("integrations.groovingProvider", GroovingProvider.Gemini);
          }

          if (!store.has("integrations.groovingApiKeys")) {
            store.set("integrations.groovingApiKeys", { gemini: null, anthropic: null, openai: null });
          }

          if (!store.has("integrations.groovingModels")) {
            store.set("integrations.groovingModels", { gemini: null, anthropic: null, openai: null });
          }

          if (!store.has("integrations.groovingConsent")) {
            store.set("integrations.groovingConsent", null);
          }

          if (!store.has("integrations.groovingUsage")) {
            store.set("integrations.groovingUsage", null);
          }

          if (!store.has("integrations.groovingLanguage")) {
            store.set("integrations.groovingLanguage", GroovingLanguage.Auto);
          }

          if (!store.has("integrations.groovingContinue")) {
            store.set("integrations.groovingContinue", false);
          }
        }
      }
    });

    if (this.conf.get("general.disableHardwareAcceleration")) {
      app.disableHardwareAcceleration();
      log.info("Hardware acceleration disabled");
    }
    if (this.conf.get("playback.enableSpeakerFill")) {
      app.commandLine.appendSwitch("try-supported-channel-layouts");
      log.info("Speaker fill enabled");
    }
  }

  public override onInitialized() {
    if (this._initialized) throw new Error("ConfigStore is already initialized!");
    this._initialized = true;

    const windowManager = this.getDependency(AppWindowManager);
    this.conf.onDidAnyChange((newState, oldState) => {
      for (const window of windowManager.getWindows()) {
        window.ipcBroadcast("configStore:stateChanged", newState, oldState);
      }

      this.reconcileConfig(newState, oldState);
    });

    ipcMain.handle("configStore:get", (_event, key) => {
      return this.get(key);
    });

    ipcMain.on("configStore:set", (_event, key, value) => {
      return this.set(key, value);
    });

    log.info("ConfigStore initialized");
  }

  public override onPostInitialized() {}

  public override onTerminated() {}

  public get get() {
    return this.conf.get.bind(this.conf);
  }
  public get set() {
    return this.conf.set.bind(this.conf);
  }
  public get onDidChange() {
    return this.conf.onDidChange.bind(this.conf);
  }
  public get onDidAnyChange() {
    return this.conf.onDidAnyChange.bind(this.conf);
  }

  // TODO: This should probably be moved somewhere else as this isn't the job of the config store
  private reconcileConfig(newState: Readonly<StoreSchema>, _oldState?: Readonly<StoreSchema>) {
    app.setLoginItemSettings({
      openAtLogin: newState.general.startOnBoot
    });
  }
}
