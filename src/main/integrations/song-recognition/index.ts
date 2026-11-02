import { safeStorage } from "electron";
import log from "electron-log";
import { MemoryStoreSchema, StoreSchema } from "~shared/store/schema";
import { Paths } from "~shared/types";
import { PlayerState, VideoState } from "~shared/playerstatestore/types";
import {
  SONG_RECOGNITION_MESSAGE_MS,
  SONG_RECOGNITION_MESSAGE_TEXT,
  SONG_RECOGNITION_TIMEOUT_MS,
  SongRecognitionInputDevice,
  SongRecognitionIpc,
  SongRecognitionPhase,
  SongRecognitionRecordSource,
  SongRecognitionResultKind,
  SongRecognitionSourceKind,
  SongRecognitionViewState
} from "~shared/song-recognition";
import { interpretShazamResponse, ShazamOutcomeKind, SongRecognitionResult } from "~shared/song-recognition/response";
import { resolveRecordSource } from "~shared/song-recognition/source";
import {
  decideSongRecognition,
  INITIAL_SONG_RECOGNITION_STATE,
  SongRecognitionEffect,
  SongRecognitionEffectType,
  SongRecognitionEvent,
  SongRecognitionEventType,
  SongRecognitionState
} from "~shared/song-recognition/state";
import Integration from "../integration";
import ConfigStore from "../../services/configstore";
import MemoryStore from "../../services/memorystore";
import PlayerStateStore from "../../services/playerstatestore";
import ProtectedAPIManager from "../../services/protectedapimanager";
import YTMViewManager from "../../services/ytmviewmanager";
import { AppView } from "../../services/windowmanager/appview";
import { cancelRecordingOnAppView, recordOnAppView } from "./media";
import { detectSong } from "./shazam";

type AppViewContentsGetter = () => Electron.WebContents | null | undefined;

const RESUME_PENDING_MS = 2000;
const REMOTE_CONTROL_API = "RemoteControl";
const RemoteControlCommand = {
  Pause: "pause",
  Play: "play"
} as const;

export default class SongRecognition extends Integration {
  public name = "SongRecognition";
  public storeEnableProperty: Integration["storeEnableProperty"] = "integrations.shazamEnabled";
  public override readonly dependentStoreProperties: Paths<StoreSchema>[] = ["integrations.shazamApiKey"];

  // The app view is created after the integrations are registered, so index.ts hands over how to reach it
  private static appViewContentsGetter: AppViewContentsGetter | null = null;

  /**
   * Sets how to get the web contents of the app view (the one that records). It is read on every use because the web contents can be recreated.
   */
  public static setAppViewContentsGetter(getter: AppViewContentsGetter | null) {
    SongRecognition.appViewContentsGetter = getter;
  }

  private state: SongRecognitionState = INITIAL_SONG_RECOGNITION_STATE;
  private ytmView: AppView | null = null;
  // What to record from, decided when the icon is pressed
  private recordSource: SongRecognitionRecordSource = { kind: SongRecognitionSourceKind.DefaultMic };
  // Changes on every recording start and cancel, so a result of an older recording is dropped
  private recordGeneration = 0;
  // Changes whenever a query ends or is replaced, so a late result is dropped
  private queryGeneration = 0;
  private query: { controller: AbortController; timer: NodeJS.Timeout } | null = null;
  private messageTimer: NodeJS.Timeout | null = null;
  // The track state seen last, to tell playback that starts while recording from playback that was already going
  private previousTrackState: VideoState = VideoState.Unknown;
  private lastVisible: boolean | null = null;
  // Set while a play command we sent has not been reported by the player state yet
  private resumePending = false;
  private resumeTimer: NodeJS.Timeout | null = null;
  // Set from the pause we sent until the player reports Paused, so playback we are stopping is not taken for the user
  private pausePending = false;
  private pauseTimer: NodeJS.Timeout | null = null;

  private pressListener = () => {
    this.handlePress();
  };

  private playerStateListener = (playerState: PlayerState) => {
    const previous = this.previousTrackState;
    this.previousTrackState = playerState.trackState;
    if (playerState.trackState === VideoState.Playing) this.clearResumePending();
    if (playerState.trackState === VideoState.Paused) this.clearPausePending();
    if (
      !this.pausePending &&
      previous !== VideoState.Playing &&
      playerState.trackState === VideoState.Playing &&
      this.state.phase === SongRecognitionPhase.Recording
    ) {
      this.dispatch({ type: SongRecognitionEventType.UserPlayed });
    }
  };

  // Whether the icon can be used can change with the safeStorage availability
  private memoryStoreListener = () => {
    if (this.isUsable() !== this.lastVisible) this.sendState();
  };

  private ytmStatusListener = () => {
    this.attachYTMView();
  };

  // A new document has no state yet
  private ytmReadyListener = () => {
    this.sendState();
  };

  public onSetup() {}

  public onEnabled(): void {
    try {
      // Detached first so listeners never double up when this is enabled again
      this.detachListeners();

      this.previousTrackState = this.getService(PlayerStateStore).getState().trackState;
      this.getService(PlayerStateStore).on("state-changed", this.playerStateListener);
      this.getService(MemoryStore<MemoryStoreSchema>).onStateChanged(this.memoryStoreListener);
      this.getService(YTMViewManager).on("status-changed", this.ytmStatusListener);
      this.attachYTMView();
      this.sendState();
    } catch (error) {
      log.error("SongRecognition failed to be enabled", error);
    }
  }

  public onDisabled(): void {
    try {
      this.dispatch({ type: SongRecognitionEventType.Disabled });
    } catch (error) {
      log.error("SongRecognition failed to run the disabled effects", error);
    }

    try {
      // Anything still in flight is dropped when it arrives
      this.recordGeneration++;
      this.clearQuery();
      this.clearMessageTimer();
      this.clearResumePending();
      this.clearPausePending();
      this.state = INITIAL_SONG_RECOGNITION_STATE;
      this.detachListeners();
      this.lastVisible = null;
    } catch (error) {
      log.error("SongRecognition failed to be disabled", error);
    }
  }

  private detachListeners() {
    this.getService(PlayerStateStore).off("state-changed", this.playerStateListener);
    this.getService(MemoryStore<MemoryStoreSchema>).removeOnStateChanged(this.memoryStoreListener);
    this.getService(YTMViewManager).off("status-changed", this.ytmStatusListener);
    this.detachYTMView();
  }

  private attachYTMView() {
    const view = this.getService(YTMViewManager).getView() ?? null;
    if (view === this.ytmView) return;

    this.detachYTMView();
    this.ytmView = view;
    this.ytmView?.ipcOn(SongRecognitionIpc.Press, this.pressListener);
    this.ytmView?.on("ready", this.ytmReadyListener);
    this.sendState();
  }

  private detachYTMView() {
    if (!this.ytmView) return;

    this.ytmView.ipcOff(SongRecognitionIpc.Press, this.pressListener);
    this.ytmView.off("ready", this.ytmReadyListener);
    this.ytmView = null;
  }

  /**
   * Whether the icon is shown and can be pressed: enabled, an API key is saved and the key can be decrypted
   */
  private isUsable(): boolean {
    if (!this.isEnabled) return false;

    const apiKey = this.getService(ConfigStore).get("integrations.shazamApiKey");
    const hasApiKey = typeof apiKey === "string" && apiKey !== "";
    return hasApiKey && this.getService(MemoryStore<MemoryStoreSchema>).get("safeStorageAvailable") === true;
  }

  private handlePress() {
    try {
      const configStore = this.getService(ConfigStore);
      const devices =
        (this.getService(MemoryStore<MemoryStoreSchema>).get("songRecognitionDevices") as SongRecognitionInputDevice[] | undefined) ?? [];
      this.recordSource = resolveRecordSource(configStore.get("integrations.shazamAudioSource"), devices, process.platform);

      this.dispatch({
        type: SongRecognitionEventType.Press,
        enabled: this.isUsable(),
        pcAudio: this.recordSource.kind === SongRecognitionSourceKind.PcAudio,
        playing: this.isPlaying()
      });
    } catch (error) {
      log.error("SongRecognition failed to handle the press", error);
    }
  }

  /**
   * Whether YTM is playing or about to: buffering, or a play command we sent that has not been reported yet
   */
  private isPlaying(): boolean {
    const trackState = this.getService(PlayerStateStore).getState().trackState;
    return trackState === VideoState.Playing || trackState === VideoState.Buffering || this.resumePending;
  }

  private setResumePending() {
    this.clearResumePending();
    this.resumePending = true;
    // A play command that was dropped must not leave this set
    this.resumeTimer = setTimeout(() => {
      this.resumeTimer = null;
      this.resumePending = false;
    }, RESUME_PENDING_MS);
  }

  private setPausePending() {
    this.clearPausePending();
    this.pausePending = true;
    // A pause that never lands must not leave this set
    this.pauseTimer = setTimeout(() => {
      this.pauseTimer = null;
      this.pausePending = false;
    }, RESUME_PENDING_MS);
  }

  private clearPausePending() {
    if (this.pauseTimer !== null) clearTimeout(this.pauseTimer);
    this.pauseTimer = null;
    this.pausePending = false;
  }

  private clearResumePending() {
    if (this.resumeTimer !== null) clearTimeout(this.resumeTimer);
    this.resumeTimer = null;
    this.resumePending = false;
  }

  /**
   * Runs the event through the decision, keeps the new state, runs the effects and tells the YTM view
   */
  private dispatch(event: SongRecognitionEvent) {
    const decision = decideSongRecognition(this.state, event);
    this.state = decision.state;
    if (this.state.phase !== SongRecognitionPhase.Message) this.clearMessageTimer();

    for (const effect of decision.effects) {
      try {
        this.runEffect(effect);
      } catch (error) {
        log.error("SongRecognition failed to run an effect", error);
      }
    }

    this.sendState();
  }

  private runEffect(effect: SongRecognitionEffect) {
    switch (effect.type) {
      case SongRecognitionEffectType.StartRecording: {
        // Starts from the current value so the pause made for the recording is not taken for the user playing
        // The play we sent may still be reported, which is not the user either
        this.previousTrackState = this.resumePending ? VideoState.Playing : this.getService(PlayerStateStore).getState().trackState;
        void this.runRecording(++this.recordGeneration, this.recordSource);
        break;
      }
      case SongRecognitionEffectType.CancelRecording: {
        this.recordGeneration++;
        const contents = this.getAppViewContents();
        if (contents) cancelRecordingOnAppView(contents);
        break;
      }
      case SongRecognitionEffectType.Query: {
        this.startQuery(effect.pcm);
        break;
      }
      case SongRecognitionEffectType.AbortQuery: {
        this.clearQuery();
        break;
      }
      case SongRecognitionEffectType.Pause: {
        this.getService(ProtectedAPIManager).createOrGetAPI(REMOTE_CONTROL_API).postMessage("execute", RemoteControlCommand.Pause);
        this.setPausePending();
        break;
      }
      case SongRecognitionEffectType.Resume: {
        this.getService(ProtectedAPIManager).createOrGetAPI(REMOTE_CONTROL_API).postMessage("execute", RemoteControlCommand.Play);
        this.setResumePending();
        break;
      }
      case SongRecognitionEffectType.Search: {
        this.sendToYTMView(SongRecognitionIpc.Search, effect.query);
        break;
      }
      case SongRecognitionEffectType.StartMessageTimer: {
        this.clearMessageTimer();
        this.messageTimer = setTimeout(() => {
          this.messageTimer = null;
          this.dispatch({ type: SongRecognitionEventType.MessageExpired });
        }, SONG_RECOGNITION_MESSAGE_MS);
        break;
      }
    }
  }

  private async runRecording(generation: number, source: SongRecognitionRecordSource) {
    let event: SongRecognitionEvent = { type: SongRecognitionEventType.RecordFailed };
    try {
      const contents = this.getAppViewContents();
      if (contents) {
        const recording = await recordOnAppView(contents, source);
        if (recording.ok) event = { type: SongRecognitionEventType.Recorded, pcm: recording.pcm };
      } else {
        // Answers after the effects of the press ran
        await Promise.resolve();
      }
    } catch (error) {
      log.error("SongRecognition failed to record", error);
    }

    // The recording was cancelled or replaced while it ran
    if (generation !== this.recordGeneration) return;
    this.dispatch(event);
  }

  private startQuery(pcm: string) {
    this.clearQuery();

    const generation = this.queryGeneration;
    const controller = new AbortController();
    // Covers the key decryption as well as the request
    const timer = setTimeout(() => {
      this.finishQuery(generation, interpretShazamResponse({ kind: ShazamOutcomeKind.Timeout }));
    }, SONG_RECOGNITION_TIMEOUT_MS);
    this.query = { controller, timer };
    void this.runQuery(generation, pcm, controller.signal);
  }

  private async runQuery(generation: number, pcm: string, signal: AbortSignal) {
    let result: SongRecognitionResult;
    try {
      result = await this.detect(pcm, signal);
    } catch (error) {
      log.error("SongRecognition failed to query", error);
      result = { kind: SongRecognitionResultKind.NetworkError };
    }

    this.finishQuery(generation, result);
  }

  private finishQuery(generation: number, result: SongRecognitionResult) {
    // The query was aborted, replaced or timed out while it ran
    if (generation !== this.queryGeneration) return;
    this.clearQuery();
    this.dispatch({ type: SongRecognitionEventType.Result, result });
  }

  private async detect(pcm: string, signal: AbortSignal): Promise<SongRecognitionResult> {
    const encrypted = this.getService(ConfigStore).get("integrations.shazamApiKey");
    if (typeof encrypted !== "string" || encrypted === "") return { kind: SongRecognitionResultKind.InvalidKey };

    let apiKey: string;
    try {
      apiKey = (await safeStorage.decryptStringAsync(Buffer.from(encrypted, "hex"))).result;
    } catch (error) {
      log.error("SongRecognition could not decrypt the API key", error);
      return { kind: SongRecognitionResultKind.InvalidKey };
    }
    if (apiKey === "") return { kind: SongRecognitionResultKind.InvalidKey };

    return interpretShazamResponse(await detectSong(apiKey, pcm, signal));
  }

  /**
   * Aborts and forgets the running query, and makes its late result be dropped
   */
  private clearQuery() {
    this.queryGeneration++;
    if (!this.query) return;

    clearTimeout(this.query.timer);
    this.query.controller.abort();
    this.query = null;
  }

  private clearMessageTimer() {
    if (this.messageTimer === null) return;

    clearTimeout(this.messageTimer);
    this.messageTimer = null;
  }

  private getAppViewContents(): Electron.WebContents | null {
    try {
      const contents = SongRecognition.appViewContentsGetter?.();
      return contents && !contents.isDestroyed() ? contents : null;
    } catch {
      return null;
    }
  }

  private getViewState(): SongRecognitionViewState {
    const visible = this.isUsable();
    this.lastVisible = visible;

    return {
      visible,
      phase: this.state.phase,
      message: this.state.message === null ? null : SONG_RECOGNITION_MESSAGE_TEXT[this.state.message]
    };
  }

  private sendState() {
    try {
      this.sendToYTMView(SongRecognitionIpc.State, this.getViewState());
    } catch (error) {
      log.error("SongRecognition failed to send the state", error);
    }
  }

  // Sent to the YTM view preload, which hands it to the page
  private sendToYTMView(channel: string, payload: unknown) {
    const contents = this.ytmView?.webContents;
    if (contents && !contents.isDestroyed()) contents.send(channel, payload);
  }
}
