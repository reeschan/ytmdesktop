import { NativeImage, nativeImage } from "electron";
import log from "electron-log";
import { getControlsIconPath } from "../../util";
import Service from "../service";
import { StoreSchema } from "~shared/store/schema";
import ConfigStore from "../configstore";
import AppWindowManager from "../windowmanager";
import { DependencyConstructor } from "~shared/types";
import { VideoState } from "~shared/playerstatestore/types";
import PlayerStateStore from "../playerstatestore";
import ProtectedAPIManager from "../protectedapimanager";
import { AppWindow, AppWindowType } from "../windowmanager/appwindow";

type ThumbarIcons = { previous: NativeImage; play: NativeImage; pause: NativeImage; next: NativeImage };
type ThumbarState = { window: AppWindow<AppWindowType>; hasVideo: boolean; isPlaying: boolean };

export default class TaskbarManager extends Service {
  public static override readonly dependencies: DependencyConstructor<Service>[] = [ConfigStore, AppWindowManager, ProtectedAPIManager, PlayerStateStore];

  private _initialized = false;
  private thumbarIcons: ThumbarIcons | null = null;
  // Setting the thumbar buttons blocks the main process for several milliseconds, and the player state changes several times a second while playing
  private appliedThumbarState: ThumbarState | null = null;

  public get initialized() {
    return this._initialized;
  }

  public override onPreInitialized(): void {}
  public onInitialized() {
    if (this._initialized) throw new Error("TaskbarManager is already initialized!");
    this._initialized = true;

    log.info("TaskbarManager initialized");
  }
  public override onPostInitialized(): void {
    const configStore = this.getDependency(ConfigStore);
    const playerStateStore = this.getDependency(PlayerStateStore);

    playerStateStore.on("state-changed", () => this.reconcileTaskbar());
    configStore.onDidChange("playback", state => this.reconcileTaskbar(state));

    this.reconcileTaskbar();
  }
  public override onTerminated(): void {}

  public reconcileTaskbar(state?: StoreSchema["playback"]) {
    const windowManager = this.getDependency(AppWindowManager);
    if (windowManager.hasWindow("Main")) {
      const mainWindow = windowManager.getWindow("Main");

      const playerStateStore = this.getDependency(PlayerStateStore);

      const playerState = playerStateStore.getState();
      const hasVideo = !!playerState.videoDetails;
      const isPlaying = playerState.trackState === VideoState.Playing;

      this.reconcileThumbarButtons({ window: mainWindow, hasVideo, isPlaying });

      let progressInTaskbar = false;
      if (!state) {
        const configStore = this.getDependency(ConfigStore);
        progressInTaskbar = configStore.get("playback.progressInTaskbar");
      } else {
        progressInTaskbar = state.progressInTaskbar;
      }

      if (progressInTaskbar && playerState.videoDetails) {
        mainWindow.setProgressBar(hasVideo ? playerState.videoProgress / playerState.videoDetails.durationSeconds : -1, {
          mode: isPlaying ? "normal" : "paused"
        });
      } else {
        mainWindow.setProgressBar(-1);
      }
    }
  }

  private reconcileThumbarButtons(state: ThumbarState) {
    const applied = this.appliedThumbarState;
    if (applied && applied.window === state.window && applied.hasVideo === state.hasVideo && applied.isPlaying === state.isPlaying) return;
    this.appliedThumbarState = state;

    this.thumbarIcons ??= {
      previous: nativeImage.createFromPath(getControlsIconPath("play-previous-button.png")),
      play: nativeImage.createFromPath(getControlsIconPath("play-button.png")),
      pause: nativeImage.createFromPath(getControlsIconPath("pause-button.png")),
      next: nativeImage.createFromPath(getControlsIconPath("play-next-button.png"))
    };
    const icons = this.thumbarIcons;

    const taskbarFlags: string[] = [];
    if (!state.hasVideo) {
      taskbarFlags.push("disabled");
    }

    const protectedApiManager = this.getDependency(ProtectedAPIManager);
    state.window.setThumbarButtons([
      {
        tooltip: "Previous",
        icon: icons.previous,
        flags: taskbarFlags,
        async click() {
          const remoteControlApi = protectedApiManager.createOrGetAPI("RemoteControl");
          remoteControlApi.postMessage("execute", "previous");
        }
      },
      {
        tooltip: "Play/Pause",
        icon: state.isPlaying ? icons.pause : icons.play,
        flags: taskbarFlags,
        async click() {
          const remoteControlApi = protectedApiManager.createOrGetAPI("RemoteControl");
          remoteControlApi.postMessage("execute", "playPause");
        }
      },
      {
        tooltip: "Next",
        icon: icons.next,
        flags: taskbarFlags,
        async click() {
          const remoteControlApi = protectedApiManager.createOrGetAPI("RemoteControl");
          remoteControlApi.postMessage("execute", "next");
        }
      }
    ]);
  }
}
