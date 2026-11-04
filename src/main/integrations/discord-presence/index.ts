import PlayerStateStore from "../../services/playerstatestore";
import DiscordClient from "./minimal-discord-client";
import log from "electron-log";
import Integration from "../integration";
import MemoryStore from "../../services/memorystore";
import ConfigStore from "../../services/configstore";
import { MemoryStoreSchema, StoreSchema } from "~shared/store/schema";
import { PlayerState, VideoDetails, VideoState } from "~shared/playerstatestore/types";
import { buildActivity, PresenceDisplaySettings } from "~shared/discord-presence/activity";
import {
  DISCORD_CONNECTION_FAILED_AFTER_MS,
  DISCORD_RETRY_INITIAL_DELAY_MS,
  DISCORD_RETRY_MAX_DELAY_MS,
  retryDelayMs
} from "~shared/discord-presence/connection";

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
  private connectionFailedTimeout: NodeJS.Timeout | string | number | undefined = undefined;
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
      if (!this.discordClient || !this.ready) return;
      this.discordClient?.clearActivity();
      this.activityClearedByPause = true;
      this.pauseTimeout = undefined;
    }, 30 * 1000);
  }

  // Forget the remembered track and state so nothing stale is sent once connected again
  private resetActivityState() {
    clearTimeout(this.activityDebounceTimeout);
    clearTimeout(this.pauseTimeout);
    this.activityDebounceTimeout = this.pauseTimeout = undefined;
    this.activityClearedByPause = false;
    this.videoState = VideoState.Unknown;
    this.videoDetails = null;
    this.progress = 0;
  }

  private clearConnectionFailedTimeout() {
    clearTimeout(this.connectionFailedTimeout);
    this.connectionFailedTimeout = undefined;
  }

  private retryDiscordConnection() {
    if (!this.isEnabled) return;

    this.connectionRetries++;
    const delay = retryDelayMs(this.connectionRetries, DISCORD_RETRY_INITIAL_DELAY_MS, DISCORD_RETRY_MAX_DELAY_MS);
    log.debug(`Retrying the Discord connection in ${delay} ms`);

    clearTimeout(this.connectionRetryTimeout);
    this.connectionRetryTimeout = setTimeout(() => {
      if (!this.discordClient) return;
      this.discordClient.connect().catch(() => this.retryDiscordConnection());
    }, delay);
  }

  public onSetup() {}

  public onEnabled(): void {
    if (this.discordClient) return;
    this.discordClient = new DiscordClient(DISCORD_CLIENT_ID);

    this.clearConnectionFailedTimeout();
    this.connectionFailedTimeout = setTimeout(() => {
      this.connectionFailedTimeout = undefined;
      if (this.ready) return;
      const memoryStore = this.getService(MemoryStore<MemoryStoreSchema>);
      memoryStore.set("discordPresenceConnectionFailed", true);
    }, DISCORD_CONNECTION_FAILED_AFTER_MS);

    this.discordClient.on("connect", () => {
      this.ready = true;
      this.connectionRetries = 0;
      this.clearConnectionFailedTimeout();
      const memoryStore = this.getService(MemoryStore<MemoryStoreSchema>);
      memoryStore.set("discordPresenceConnectionFailed", false);
      // Send the current playback state, since anything sent while disconnected was dropped
      this.playerStateChanged(this.getService(PlayerStateStore).getState());
    });
    this.discordClient.on("close", () => {
      log.info("Discord connection closed");
      this.ready = false;
      this.resetActivityState();
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

    this.clearConnectionFailedTimeout();
    clearTimeout(this.connectionRetryTimeout);
    this.connectionRetryTimeout = undefined;
    this.resetActivityState();

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
