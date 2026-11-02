import PlayerStateStore from "../../services/playerstatestore";
import DiscordClient from "./minimal-discord-client";
import log from "electron-log";
import Integration from "../integration";
import MemoryStore from "../../services/memorystore";
import ConfigStore from "../../services/configstore";
import { MemoryStoreSchema, StoreSchema } from "~shared/store/schema";
import { PlayerState, VideoDetails, VideoState } from "~shared/playerstatestore/types";
import { buildActivity, PresenceDisplaySettings } from "~shared/discord-presence/activity";

const DISCORD_CLIENT_ID = "1143202598460076053";

const DISPLAY_SETTING_KEYS = [
  "discordPresenceDetailsTemplate",
  "discordPresenceStateTemplate",
  "discordPresenceLargeTextTemplate",
  "discordPresenceShowButton",
  "discordPresenceStatusDisplay"
] as const satisfies readonly (keyof StoreSchema["integrations"])[];

export default class DiscordPresence extends Integration {
  public name = "DiscordPresence";
  public storeEnableProperty: Integration["storeEnableProperty"] = "integrations.discordPresenceEnabled";
  public override disableFlags = ["disable_discord_presence"];

  private discordClient: DiscordClient | null = null;
  private ready = false;
  private activityDebounceTimeout: NodeJS.Timeout | string | number | undefined = undefined;
  private pauseTimeout: NodeJS.Timeout | string | number | undefined = undefined;
  private connectionRetryTimeout: NodeJS.Timeout | string | number | undefined = undefined;
  private stateCallback: ((event: PlayerState) => void) | null = null;
  private storeListener: ReturnType<ConfigStore["onDidChange"]> | null = null;

  private videoState: VideoState = VideoState.Unknown;
  private videoDetails: VideoDetails | null = null;
  private progress: number = 0;
  // Set once the pause timeout cleared the activity, unset when playback starts again
  private activityClearedByPause = false;

  private connectionRetries: number = 0;

  private getDisplaySettings(): PresenceDisplaySettings {
    const configStore = this.getService(ConfigStore);
    return {
      templates: {
        details: configStore.get("integrations.discordPresenceDetailsTemplate"),
        state: configStore.get("integrations.discordPresenceStateTemplate"),
        largeText: configStore.get("integrations.discordPresenceLargeTextTemplate")
      },
      showButton: configStore.get("integrations.discordPresenceShowButton"),
      statusDisplay: configStore.get("integrations.discordPresenceStatusDisplay")
    };
  }

  private updateActivity() {
    if (this.activityDebounceTimeout) return;
    this.activityDebounceTimeout = setTimeout(() => {
      this.activityDebounceTimeout = undefined;
      // The state may have changed while debouncing, so check it at the time of sending
      if (this.activityClearedByPause) return;
      if (!this.videoDetails) {
        this.discordClient?.clearActivity();
        return;
      }
      this.discordClient?.setActivity(
        buildActivity(this.getDisplaySettings(), {
          videoDetails: this.videoDetails,
          videoState: this.videoState,
          progressSeconds: this.progress,
          nowMs: Date.now()
        })
      );
    }, 1000);
  }

  private displaySettingsChanged(newState?: StoreSchema["integrations"], oldState?: StoreSchema["integrations"]) {
    if (newState && oldState && DISPLAY_SETTING_KEYS.every(key => newState[key] === oldState[key])) return;
    if (!this.ready || !this.videoDetails) return;
    // The activity was already cleared after being paused for a while
    if (this.videoState !== VideoState.Playing && !this.pauseTimeout) return;
    this.updateActivity();
  }

  private playerStateChanged(state: PlayerState) {
    if (!this.ready) return;

    const { videoDetails, videoProgress, trackState, hasFullMetadata } = state;
    if (!videoDetails) {
      // Forget the previous track so a later settings change does not send it again
      clearTimeout(this.pauseTimeout);
      this.pauseTimeout = undefined;
      this.videoDetails = null;
      this.videoState = VideoState.Unknown;
      this.discordClient?.clearActivity();
      return;
    }
    const oldState = this.videoState ?? null;
    const oldId = this.videoDetails?.id ?? null;
    const oldProgress = this.progress ?? null;
    this.videoState = trackState;
    this.videoDetails = videoDetails;
    this.progress = Math.floor(videoProgress);
    const trackChanged = oldId !== this.videoDetails.id;
    const seeked = Math.abs(this.progress - oldProgress) > 1 || oldProgress > this.progress;
    // Playing again, a track change or a seek shows the activity again after the pause timeout cleared it
    if (trackState === VideoState.Playing || trackChanged || seeked) this.activityClearedByPause = false;
    if (hasFullMetadata && (oldState !== this.videoState || trackChanged || seeked)) {
      this.updateActivity();
    }

    clearTimeout(this.pauseTimeout);
    this.pauseTimeout = undefined;
    if (state.trackState == VideoState.Playing) return;
    this.pauseTimeout = setTimeout(() => {
      if (!this.discordClient && !this.ready) return;
      this.discordClient?.clearActivity();
      this.activityClearedByPause = true;
      this.pauseTimeout = undefined;
    }, 30 * 1000);
  }

  private retryDiscordConnection() {
    if (!this.isEnabled) return;
    if (this.connectionRetries >= 30) {
      const memoryStore = this.getService(MemoryStore<MemoryStoreSchema>);
      memoryStore.set("discordPresenceConnectionFailed", true);
      return;
    }

    this.connectionRetries++;
    log.info(`Connecting to Discord attempt ${this.connectionRetries}/30`);

    clearTimeout(this.connectionRetryTimeout);
    this.connectionRetryTimeout = setTimeout(() => {
      if (!this.discordClient) return;
      this.discordClient.connect().catch(() => this.retryDiscordConnection());
    }, 5 * 1000);
  }

  public onSetup() {}

  public onEnabled(): void {
    if (this.discordClient) return;
    this.discordClient = new DiscordClient(DISCORD_CLIENT_ID);

    this.discordClient.on("connect", () => {
      this.ready = true;
      this.connectionRetries = 0;
      const memoryStore = this.getService(MemoryStore<MemoryStoreSchema>);
      memoryStore.set("discordPresenceConnectionFailed", false);
    });
    this.discordClient.on("close", () => {
      log.info("Discord connection closed");
      this.ready = false;
      this.retryDiscordConnection();
    });
    this.discordClient.connect().catch(() => this.retryDiscordConnection());
    this.stateCallback = event => {
      this.playerStateChanged(event);
    };

    const playerStateStore = this.getService(PlayerStateStore);
    playerStateStore.on("state-changed", this.stateCallback);

    const configStore = this.getService(ConfigStore);
    this.storeListener = configStore.onDidChange("integrations", (newState, oldState) => this.displaySettingsChanged(newState, oldState));
  }

  public onDisabled(): void {
    this.connectionRetries = 0;
    const memoryStore = this.getService(MemoryStore<MemoryStoreSchema>);
    memoryStore.set("discordPresenceConnectionFailed", false);

    clearTimeout(this.activityDebounceTimeout);
    clearTimeout(this.pauseTimeout);
    clearTimeout(this.connectionRetryTimeout);
    this.activityDebounceTimeout = this.pauseTimeout = this.connectionRetryTimeout = undefined;
    this.activityClearedByPause = false;

    if (this.stateCallback) {
      const playerStateStore = this.getService(PlayerStateStore);
      playerStateStore.off("state-changed", this.stateCallback);
    }

    if (this.storeListener) {
      this.storeListener();
      this.storeListener = null;
    }

    if (!this.discordClient) return;
    this.ready = false;
    this.discordClient.destroy();
    this.discordClient = null;
  }
}
