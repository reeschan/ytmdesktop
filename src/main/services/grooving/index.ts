import { safeStorage } from "electron";
import log from "electron-log";
import { DependencyConstructor } from "~shared/types";
import { MemoryStoreSchema } from "~shared/store/schema";
import {
  GROOVING_BLEND_GENRE_LIMIT,
  GROOVING_BLEND_MOOD_LIMIT,
  GROOVING_DEFAULT_MODELS,
  GROOVING_LANGUAGE_NAMES,
  GROOVING_LLM_CALL_LIMIT,
  GROOVING_LLM_CALL_WINDOW_MS,
  GROOVING_PREVIEW_SECONDS,
  GROOVING_PROTECTED_API,
  GROOVING_PROVIDER_LABELS,
  GROOVING_SAVE_TIMEOUT_MS,
  GROOVING_TRACK_TEXT_MAX,
  GroovingCandidate,
  GroovingDirection,
  GroovingDisplayLanguage,
  GroovingFailureReason,
  GroovingIpc,
  GroovingMood,
  GroovingMoodItem,
  GroovingMoodSection,
  groovingMoodLabel,
  GroovingPageCall,
  GroovingProvider,
  GroovingRoundRecord,
  GroovingRounds,
  GroovingSeedOptions,
  GroovingSeedSong,
  GroovingSignal,
  GroovingSourceRequest,
  GroovingSources,
  GroovingTrack,
  GroovingViewMessage,
  GroovingVisibility,
  isGroovingSignal,
  resolveGroovingLanguage
} from "~shared/grooving";
import {
  checkGroovingList,
  checkGroovingPair,
  groovingCandidatesEnough,
  groovingFamiliarCount,
  groovingListCandidates
} from "~shared/grooving/answer";
import { alternate, buildGroovingCandidates, knownArtists } from "~shared/grooving/candidates";
import type { GroovingSeedMatch } from "~shared/grooving/candidates";
import { groovingReaction, GroovingReaction } from "~shared/grooving/continuation";
import { createGroovingCallWindow } from "~shared/grooving/pace";
import {
  decideGrooving,
  GroovingEffect,
  GroovingEvent,
  groovingRunInProgress,
  groovingStopsThrottling,
  GroovingSession,
  GroovingState,
  initialGroovingState,
  toGroovingViewState
} from "~shared/grooving/state";
import { addGroovingUsage, estimateGroovingUsd, groovingMonth } from "~shared/grooving/usage";
import type { PlayerState } from "~shared/playerstatestore/types";
import Service from "../service";
import ConfigStore from "../configstore";
import MemoryStore from "../memorystore";
import PlayerStateStore from "../playerstatestore";
import StateManager from "../statemanager";
import ProtectedAPIManager from "../protectedapimanager";
import YTMViewManager from "../ytmviewmanager";
import { AppView } from "../windowmanager/appview";
import {
  continuationRequest,
  failedLlm,
  GroovingLlmFailureKind,
  isConsent,
  isRecord,
  isUsage,
  knownArtistsOfCandidates,
  MAX_TEXT,
  MOOD_TEXT_MAX,
  observeTrack,
  PageAnswer,
  readMoods,
  readSources,
  readTracks,
  SEED_VIDEO_ID_MAX,
  TrackWatch,
  Usage
} from "./effects";
import type { GroovingLlmConfig, GroovingLlmResult } from "./llm";

// ytcfg's HL is a short tag like "ja" or "en-GB". Anything longer from the page is cut
const PAGE_LANGUAGE_MAX = 32;

// How long a page call after a reload waits for the new document's ProtectedAPI port. Its page binds one once its
// scripts are ready, and a call sent before that would sit on the dead port for the whole invoke timeout (30 s)
const PAGE_BIND_TIMEOUT_MS = 15 * 1000;

const emptyPendingUsage = () => ({ priced: { inputTokens: 0, outputTokens: 0, usd: 0 }, unpriced: { inputTokens: 0, outputTokens: 0 } });

const isDoneKind = (kind: GroovingState["flow"]["kind"]): boolean => kind === "done" || kind === "saving" || kind === "saved";

// The continuation's candidates and prompt input, kept for the request in flight (only the latest one; a retry reuses it)
type ContinuationInput = {
  requestId: number;
  candidates: GroovingCandidate[];
  familiarCount: number;
  direction: GroovingDirection;
  history: GroovingRoundRecord[];
  listed: GroovingCandidate[];
  reactions: Record<string, GroovingReaction>;
  avoidedArtists: string[];
};

export default class Grooving extends Service {
  public static override readonly dependencies: DependencyConstructor<Service>[] = [
    ConfigStore,
    MemoryStore<MemoryStoreSchema>,
    PlayerStateStore,
    ProtectedAPIManager,
    StateManager,
    YTMViewManager
  ];

  // Never rebuilt from initialGroovingState after the first time: nextRequestId must not go back
  private state: GroovingState = initialGroovingState();
  private ytmView: AppView | null = null;
  private ytmContents: Electron.WebContents | null = null;
  private consentListener: ReturnType<ConfigStore["onDidChange"]> | null = null;
  private languageListener: ReturnType<ConfigStore["onDidChange"]> | null = null;
  private shazamEnabledListener: ReturnType<ConfigStore["onDidChange"]> | null = null;
  private shazamKeyListener: ReturnType<ConfigStore["onDidChange"]> | null = null;
  private memoryListener = () => {
    try {
      this.updateSeedOptions();
    } catch (error) {
      log.error("Grooving failed to read the remembered song", error);
    }
  };
  private writingConsent = false;
  // The page's HL from the last open signal (null when unreadable), for the Auto language
  private pageLanguage: string | null = null;
  private moods: GroovingMoodItem[] | null = null;
  private moodsFailed = false;

  // Changes when a run ends (closed, back to setup), so the late result of an earlier run is dropped
  private epoch = 0;
  // Changes when the page is loaded again, so the answers to the calls sent to the old document are dropped
  private pageToken = 0;
  // The Grooving API's bind count when the new document was seen, and the shared wait for its port: until the page
  // binds one, a call would go to the dead old port and wait there for the whole invoke timeout
  private pageBindCount = 0;
  private pageBindWait: Promise<boolean> | null = null;
  private abort = new AbortController();
  private collectToken = 0;
  private previewTimer: NodeJS.Timeout | null = null;
  // Changes with every preview started or ended, so the page's late answer to an earlier preview starts no timer
  private previewToken = 0;
  // Preview and queue calls go to the page one after another
  private playbackChain: Promise<void> = Promise.resolve();
  // The web contents whose background throttling was turned off while Grooving is open, to turn it back on for the same one
  private unthrottled: Electron.WebContents | null = null;
  // The run-in-progress flag last written to the settings, so a write happens only when the value changes
  private writtenRunInProgress = false;

  // What main remembers of the track playing while a done / saving / saved run is on (see observeTrack)
  private trackWatch: TrackWatch | null = null;
  // The artists the run's candidates were marked with. Null when the run did not build any
  private runKnownArtists: Set<string> | null = null;
  // The continuation's candidates, waiting for the LLM request (the latest one only)
  private continuationInput: ContinuationInput | null = null;

  // The usage of this run (shown on the done screen), and the usage not yet written to the settings,
  // split into the priced models' and the tokens of models missing from the price table
  private runUsage: Usage & { usd: number; usdKnown: boolean } = { inputTokens: 0, outputTokens: 0, usd: 0, usdKnown: true };
  private pendingUsage: { priced: Usage & { usd: number }; unpriced: Usage } = emptyPendingUsage();
  private llmInFlight = 0;
  // Counts across runs, closes and new documents. Never reset
  private llmCalls = createGroovingCallWindow(GROOVING_LLM_CALL_LIMIT, GROOVING_LLM_CALL_WINDOW_MS);

  private signalListener = (_event: unknown, signal: unknown) => {
    // The page can post anything, so the shape is checked here too
    if (isGroovingSignal(signal)) this.handleSignal(signal);
  };

  // A new document has no screen and no page behind the run in progress
  private readyListener = () => {
    this.resetForNewDocument();
  };

  // The status also changes when a frame inside the page fails to load, which says nothing about the run, so this only keeps the view attached
  private statusListener = () => {
    this.attachYTMView();
  };

  // The view got a new web contents, so the run in progress has no page behind it
  private recreatedListener = () => {
    this.attachYTMView();
    this.resetForNewDocument();
  };

  // The player changes every second, so the work is done only when the track changes (and never while an ad plays).
  // The seed song offered on the setup screen follows the same state
  private playerStateListener = (state: PlayerState) => {
    try {
      this.updateSeedOptions(state);
      this.observePlayer(state);
    } catch (error) {
      log.error("Grooving failed to watch the player", error);
    }
  };

  public override onPreInitialized() {}

  public override onInitialized() {
    // A run that was under way when the app closed ended with it, so the next mood selection tells the user.
    // The state is rebuilt before the view is attached, so a reset cannot run on the old one.
    // The state manager copies `state` in onPostInitialized, after every onInitialized, so these writes reach its copy
    const configStore = this.getDependency(ConfigStore);
    const runInProgress = configStore.get("state.groovingRunInProgress") ?? false;
    const noticePending = (configStore.get("state.groovingNoticePending") ?? false) || runInProgress;
    try {
      if (runInProgress) configStore.set("state.groovingRunInProgress", false);
      if (noticePending !== (configStore.get("state.groovingNoticePending") ?? false)) {
        configStore.set("state.groovingNoticePending", noticePending);
      }
    } catch (error) {
      log.error("Grooving failed to move the run flags at startup", error);
    }
    this.writtenRunInProgress = false;
    this.state = initialGroovingState({ notice: noticePending });

    // The YTM view is created after the services are initialized, so it is attached once the manager reports a status for it
    const viewManager = this.getDependency(YTMViewManager);
    viewManager.on("status-changed", this.statusListener);
    viewManager.on("view-recreated", this.recreatedListener);
    this.attachYTMView();

    // A consent taken back in the settings must stop a run that was started with it
    this.consentListener = this.getDependency(ConfigStore).onDidChange("integrations.groovingConsent", () => this.handleConsentChanged());
    // The screen's language follows the setting at once, also while a run goes on
    this.languageListener = this.getDependency(ConfigStore).onDidChange("integrations.groovingLanguage", () => this.sendState());
    // The reactions and the track that started are read from the player while a done / saving / saved run is on
    this.getDependency(PlayerStateStore).on("state-changed", this.playerStateListener);
    // The setup screen's seed song follows the player, the remembered song and the Shazam settings
    this.getDependency(MemoryStore<MemoryStoreSchema>).onStateChanged(this.memoryListener);
    this.shazamEnabledListener = this.getDependency(ConfigStore).onDidChange("integrations.shazamEnabled", this.memoryListener);
    this.shazamKeyListener = this.getDependency(ConfigStore).onDidChange("integrations.shazamApiKey", this.memoryListener);
    try {
      this.updateSeedOptions();
    } catch (error) {
      log.error("Grooving failed to read the seed options at startup", error);
    }

    log.info("Grooving initialized");
  }

  public override onPostInitialized() {}

  public override onTerminated() {
    this.getDependency(PlayerStateStore).off("state-changed", this.playerStateListener);
    this.getDependency(MemoryStore<MemoryStoreSchema>).removeOnStateChanged(this.memoryListener);
    const viewManager = this.getDependency(YTMViewManager);
    viewManager.off("status-changed", this.statusListener);
    viewManager.off("view-recreated", this.recreatedListener);
    this.consentListener?.();
    this.consentListener = null;
    this.languageListener?.();
    this.languageListener = null;
    this.shazamEnabledListener?.();
    this.shazamEnabledListener = null;
    this.shazamKeyListener?.();
    this.shazamKeyListener = null;
    this.restoreThrottling();
    this.detachYTMView();
    this.ytmContents = null;
    this.endRun();
    this.flushUsage();
  }

  private attachYTMView() {
    const view = this.getDependency(YTMViewManager).getView() ?? null;
    const contents = view?.webContents ?? null;
    // A different web contents than the one the run started on is a different page
    const replaced = this.ytmContents !== null && contents !== this.ytmContents;
    this.ytmContents = contents;
    // The old web contents may stay in the window, so its throttling goes back on before the run is closed
    if (replaced) this.restoreThrottling();

    if (view !== this.ytmView) {
      this.detachYTMView();
      this.ytmView = view;
      this.ytmView?.ipcOn(GroovingIpc.Signal, this.signalListener);
      this.ytmView?.on("ready", this.readyListener);
    }

    if (replaced) this.resetForNewDocument();
  }

  /**
   * The consent was withdrawn outside of Grooving (the settings screen), which closes the run even while it is hidden.
   * It asks for the consent again when it opens
   */
  private handleConsentChanged() {
    if (this.writingConsent || this.state.flow.kind === "closed") return;

    try {
      this.dispatch({ type: "withdraw-consent" });
    } catch (error) {
      log.error("Grooving failed to close after the consent changed", error);
    }
  }

  private detachYTMView() {
    if (!this.ytmView) return;

    this.ytmView.ipcOff(GroovingIpc.Signal, this.signalListener);
    this.ytmView.off("ready", this.readyListener);
    this.ytmView = null;
  }

  /**
   * The page is new: the run goes on, but the calls sent to the old document are dropped and the screen is told to hide.
   * The app reports one reload more than once, so this must end in the same state however often it runs.
   * The moods stay: a setup screen hidden through the reload reads them again when it is opened
   */
  private resetForNewDocument() {
    try {
      // The LLM keeps working (the epoch does not change); only the page's work belonged to the old document
      this.pageToken++;
      this.collectToken++;
      this.previewToken++;
      this.clearPreviewTimer();
      // The calls already queued for the old document must not hold up the calls for the new one
      this.playbackChain = Promise.resolve();
      // The new document's page binds its own ProtectedAPI port once its scripts are ready. Calls wait for it, and a
      // reset more than once for the same document keeps the same wait (the port is not bound yet either time).
      // The wait clears once it is over, so the next document starts its own
      const api = this.getDependency(ProtectedAPIManager).createOrGetAPI(GROOVING_PROTECTED_API);
      if (this.pageBindWait === null && !api.isBound) {
        this.pageBindCount = api.bindCount;
        const wait = api.waitForBind(this.pageBindCount, PAGE_BIND_TIMEOUT_MS);
        this.pageBindWait = wait;
        void wait.then(() => {
          if (this.pageBindWait === wait) this.pageBindWait = null;
        });
      }
      this.dispatch({ type: "page-reloaded" });
    } catch (error) {
      log.error("Grooving failed to reset for a new document", error);
    }
  }

  //#region Settings
  private readProvider(): GroovingProvider {
    const provider = this.getDependency(ConfigStore).get("integrations.groovingProvider");
    return Object.values(GroovingProvider).find(value => value === provider) ?? GroovingProvider.Gemini;
  }

  private readModel(provider: GroovingProvider): string {
    const model = this.getDependency(ConfigStore).get("integrations.groovingModels")?.[provider];
    return typeof model === "string" && model.trim() !== "" ? model.trim() : GROOVING_DEFAULT_MODELS[provider];
  }

  private readEncryptedKey(provider: GroovingProvider): string | null {
    const encrypted = this.getDependency(ConfigStore).get("integrations.groovingApiKeys")?.[provider];
    return typeof encrypted === "string" && encrypted !== "" ? encrypted : null;
  }

  private safeStorageAvailable(): boolean {
    return this.getDependency(MemoryStore<MemoryStoreSchema>).get("safeStorageAvailable") === true;
  }

  private hasKey(): boolean {
    return this.safeStorageAvailable() && this.readEncryptedKey(this.readProvider()) !== null;
  }

  /**
   * Decrypts the key just before an LLM call. The plain key lives only in the returned config of that call
   */
  private async readLlmConfig(): Promise<GroovingLlmConfig | null> {
    const provider = this.readProvider();
    const encrypted = this.readEncryptedKey(provider);
    if (encrypted === null || !this.safeStorageAvailable()) return null;

    try {
      const apiKey = (await safeStorage.decryptStringAsync(Buffer.from(encrypted, "hex"))).result;
      return apiKey === "" ? null : { provider, apiKey, model: this.readModel(provider) };
    } catch {
      log.error("Grooving could not decrypt the API key");
      return null;
    }
  }
  //#endregion

  //#region Signals and the decision
  private handleSignal(signal: GroovingSignal) {
    try {
      const event = this.toEvent(signal);
      if (!event) return;
      // The setup screen shows the seed song as it is now, not as it was at the last change
      if (event.type === "open") this.updateSeedOptions();

      // Opening a setup screen hidden through a reload reads the moods from the new page
      const readsMoods =
        event.type === "open" && this.moods === null && this.state.flow.kind === "setup" && this.state.visibility === GroovingVisibility.Hidden;
      this.dispatch(event);
      // The last choice is kept for the next run's done screen, also when the decision ignored this one
      if (event.type === "continue-toggle") this.writeContinueToggle(event.enabled);
      if (readsMoods) void this.loadMoods(this.epoch, this.pageToken);
    } catch (error) {
      log.error("Grooving failed to handle a signal", error);
    }
  }

  private writeContinueToggle(enabled: boolean) {
    try {
      this.getDependency(ConfigStore).set("integrations.groovingContinue", enabled);
    } catch (error) {
      log.error("Grooving failed to write the continue toggle", error);
    }
  }

  private toEvent(signal: GroovingSignal): GroovingEvent | null {
    switch (signal.type) {
      case "open": {
        // Kept before the dispatch, so the first state sent after the open is already in the page's language
        this.pageLanguage = typeof signal.pageLanguage === "string" ? signal.pageLanguage.slice(0, PAGE_LANGUAGE_MAX) : null;
        const consent = this.getDependency(ConfigStore).get("integrations.groovingConsent");
        return { type: "open", hasKey: this.hasKey(), consent: isConsent(consent) ? consent : null };
      }
      case "start": {
        // Whatever the page sends is limited to what the user could pick, because the mood goes into the prompt
        const mood = this.toKnownMood(signal.mood);
        return mood ? { type: "start", mood, direction: signal.direction, rounds: signal.rounds } : null;
      }
      case "previewStart":
        return signal.videoId.length <= MAX_TEXT ? { type: "preview-start", videoId: signal.videoId } : null;
      case "previewStop":
        return { type: "preview-ended" };
      case "continueToggle":
        // The page can post anything, so a toggle that is not a boolean is dropped
        return typeof signal.enabled === "boolean" ? { type: "continue-toggle", enabled: signal.enabled } : null;
      case "consent":
      case "close":
      case "leave":
      case "answer":
      case "retry":
      case "save":
      case "again":
        return signal;
      case "dismissNotice":
        return { type: "dismiss-notice" };
    }
  }

  private toKnownMood(mood: GroovingMood): GroovingMood | null {
    if (mood.kind === "text") {
      const text = mood.text.trim().slice(0, MOOD_TEXT_MAX);
      return text === "" ? null : { kind: "text", text };
    }

    if (mood.kind === "item") {
      const known = this.findMood(mood.item);
      return known ? { kind: "item", item: known } : null;
    }

    if (mood.kind === "song") {
      const { title, artist, videoId, thumbnail } = mood.song;
      if (typeof title !== "string" || typeof artist !== "string") return null;

      const clippedTitle = title.trim().slice(0, GROOVING_TRACK_TEXT_MAX);
      const clippedArtist = artist.trim().slice(0, GROOVING_TRACK_TEXT_MAX);
      if (clippedTitle === "" || clippedArtist === "") return null;

      return {
        kind: "song",
        song: {
          title: clippedTitle,
          artist: clippedArtist,
          videoId: typeof videoId === "string" && videoId !== "" ? videoId.slice(0, SEED_VIDEO_ID_MAX) : null,
          thumbnail: typeof thumbnail === "string" && thumbnail.startsWith("https://") ? thumbnail.slice(0, MAX_TEXT) : null
        }
      };
    }

    return this.toKnownBlend(mood.items);
  }

  private findMood(wanted: GroovingMoodItem): GroovingMoodItem | null {
    return this.moods?.find(item => item.params === wanted.params && item.section === wanted.section) ?? null;
  }

  /**
   * A blend is only taken with 2-3 items of the loaded list, at most 1 mood and 2 genres and no item twice.
   * The items are the list's own, moods first and genres in the order chosen
   */
  private toKnownBlend(wanted: GroovingMoodItem[]): GroovingMood | null {
    if (wanted.length < 2 || wanted.length > GROOVING_BLEND_MOOD_LIMIT + GROOVING_BLEND_GENRE_LIMIT) return null;

    const items: GroovingMoodItem[] = [];
    for (const item of wanted) {
      const known = this.findMood(item);
      if (!known || items.some(chosen => chosen.params === known.params)) return null;
      items.push(known);
    }

    const moods = items.filter(item => item.section === GroovingMoodSection.Moods);
    const genres = items.filter(item => item.section === GroovingMoodSection.Genres);
    if (moods.length > GROOVING_BLEND_MOOD_LIMIT || genres.length > GROOVING_BLEND_GENRE_LIMIT) return null;

    return { kind: "blend", items: [...moods, ...genres] };
  }

  /**
   * Runs the event through the decision, keeps the new state, runs the effects and tells the YTM view
   */
  private dispatch(event: GroovingEvent) {
    const before = this.state;
    const previous = before.flow.kind;
    const decision = decideGrooving(before, event);
    this.state = decision.state;

    const next = this.state.flow.kind;
    if (next === "closed" && previous !== "closed") this.endRun();
    if (next === "setup" && previous !== "setup") this.beginSetup();
    // The player is watched only while the continue part can run. Entering done drops what was seen before the list
    if (isDoneKind(next) && !isDoneKind(previous)) this.trackWatch = this.startTrackWatch();
    else if (!isDoneKind(next)) this.trackWatch = null;
    // A hidden window would slow the page's timers while Grooving waits for the page, so they run freely while it is open
    // or a hidden run still waits for something
    this.syncThrottling();
    // Written before the effects, so a failed write cannot keep an effect or the screen from running
    this.writeRunFlags(before);

    for (const effect of decision.effects) {
      try {
        this.runEffect(effect);
      } catch (error) {
        log.error("Grooving failed to run an effect", error);
      }
    }

    this.sendState();
  }

  // Turns the background throttling off while the screen is shown or a hidden run waits, and back on otherwise.
  // The web contents is compared, not a flag, because a new page needs the throttling turned off again
  private syncThrottling() {
    const stops = groovingStopsThrottling(this.state);
    const contents = this.liveContents();
    if (stops && contents !== null && this.unthrottled === contents) return;
    if (!stops && this.unthrottled === null) return;

    this.restoreThrottling();
    if (stops) this.stopThrottling();
  }

  /**
   * Writes the run flags through the state manager, which writes the whole of `state` back on its own and would otherwise
   * put the values read at startup over these. Only when a value changes: every write goes to all windows.
   * The disk is written at once, as the state manager would keep the change up to 30 seconds and a crash would lose the run.
   * A failed write must not stop the run, so it is logged and dropped
   */
  private writeRunFlags(before: GroovingState) {
    try {
      const stateManager = this.getDependency(StateManager);
      let changed = false;
      const running = groovingRunInProgress(this.state);
      if (running !== this.writtenRunInProgress) {
        stateManager.updateState({ groovingRunInProgress: running });
        this.writtenRunInProgress = running;
        changed = true;
      }
      // The notice was shown and dismissed or started, so the next launch does not need it again
      if (before.notice && !this.state.notice) {
        stateManager.updateState({ groovingNoticePending: false });
        changed = true;
      }
      if (changed) stateManager.forceWrite();
    } catch (error) {
      log.error("Grooving failed to write the run flags", error);
    }
  }

  /**
   * Drops everything still in flight from the run that ends: late results, LLM calls and the preview timer
   */
  private endRun() {
    this.epoch++;
    this.collectToken++;
    this.abort.abort();
    this.abort = new AbortController();
    this.clearPreviewTimer();
    this.trackWatch = null;
    this.runKnownArtists = null;
    this.continuationInput = null;
  }

  // Reads the current player state into a fresh watch, for the moment the list arrives (its position is not counted)
  private startTrackWatch(): TrackWatch | null {
    try {
      return observeTrack(null, this.getDependency(PlayerStateStore).getState(), this.state.previewing).next;
    } catch (error) {
      log.error("Grooving failed to read the player", error);
      return null;
    }
  }

  //#region The seed song ("From a song")
  // What the page sends into a mood is not trusted: only strings, cut like a track's text
  private clipSeedSong(song: GroovingSeedSong): GroovingSeedSong {
    return {
      title: song.title.slice(0, GROOVING_TRACK_TEXT_MAX),
      artist: song.artist.slice(0, GROOVING_TRACK_TEXT_MAX),
      videoId: song.videoId === null ? null : song.videoId.slice(0, SEED_VIDEO_ID_MAX),
      thumbnail: song.thumbnail === null ? null : song.thumbnail.slice(0, MAX_TEXT)
    };
  }

  private playingSeed(state: PlayerState | null): GroovingSeedSong | null {
    const details = state?.videoDetails ?? null;
    // An ad is not the track, and without details there is no song to start from
    if (state === null || state.adPlaying || details === null) return null;

    const thumbnails = details.thumbnails;
    const thumbnail = thumbnails.length === 0 ? null : thumbnails[thumbnails.length - 1].url;
    return this.clipSeedSong({ title: details.title, artist: details.author, videoId: details.id, thumbnail });
  }

  private recognizedSeed(): GroovingSeedSong | null {
    const remembered = this.getDependency(MemoryStore<MemoryStoreSchema>).get("groovingRecognizedSong");
    if (!isRecord(remembered) || typeof remembered.title !== "string" || typeof remembered.artist !== "string") return null;
    return this.clipSeedSong({ title: remembered.title, artist: remembered.artist, videoId: null, thumbnail: null });
  }

  // Shazam's conditions, as in song-recognition: enabled, a key is saved and safeStorage can be used (the key itself is not read)
  private canRecognizeSong(): boolean {
    const configStore = this.getDependency(ConfigStore);
    const apiKey = configStore.get("integrations.shazamApiKey");
    if (configStore.get("integrations.shazamEnabled") !== true) return false;
    return typeof apiKey === "string" && apiKey !== "" && this.safeStorageAvailable();
  }

  private sameSeedSong(a: GroovingSeedSong | null, b: GroovingSeedSong | null): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;
    return a.title === b.title && a.artist === b.artist && a.videoId === b.videoId && a.thumbnail === b.thumbnail;
  }

  private sameSeedOptions(a: GroovingSeedOptions, b: GroovingSeedOptions): boolean {
    return a.canRecognize === b.canRecognize && this.sameSeedSong(a.playing, b.playing) && this.sameSeedSong(a.recognized, b.recognized);
  }

  /**
   * Sends the seed options when one of them changed. The player state can be handed in when the caller has it already
   */
  private updateSeedOptions(playerState?: PlayerState | null) {
    let player = playerState;
    if (player === undefined) {
      try {
        player = this.getDependency(PlayerStateStore).getState();
      } catch (error) {
        log.error("Grooving failed to read the player for the seed options", error);
        player = null;
      }
    }

    const next: GroovingSeedOptions = {
      playing: this.playingSeed(player),
      recognized: this.recognizedSeed(),
      canRecognize: this.canRecognizeSong()
    };
    if (this.sameSeedOptions(this.state.seed, next)) return;
    this.dispatch({ type: "seed-options", ...next });
  }
  //#endregion

  /**
   * Turns a player state into a reaction for the track that ended and a start for the track that began.
   * Nothing is sent while the track stays the same (the state changes every second)
   */
  private observePlayer(playerState: PlayerState) {
    if (!isDoneKind(this.state.flow.kind)) {
      this.trackWatch = null;
      return;
    }

    const observed = observeTrack(this.trackWatch, playerState, this.state.previewing);
    this.trackWatch = observed.next;
    // The reaction first, then the track that started (the decision takes both in this order)
    if (observed.reaction !== null) {
      this.dispatch({ type: "track-reaction", videoId: observed.reaction.videoId, reaction: groovingReaction(observed.reaction.last) });
    }
    if (observed.started !== null) this.dispatch({ type: "track-started", videoId: observed.started });
  }

  private beginSetup() {
    this.endRun();
    this.runUsage = { inputTokens: 0, outputTokens: 0, usd: 0, usdKnown: true };
  }

  private stopThrottling() {
    const contents = this.liveContents();
    if (!contents) return;

    try {
      contents.setBackgroundThrottling(false);
      this.unthrottled = contents;
    } catch (error) {
      log.error("Grooving failed to turn off the background throttling", error);
    }
  }

  // Goes to the web contents that was turned off, which can differ from the view's current one
  private restoreThrottling() {
    const contents = this.unthrottled;
    this.unthrottled = null;
    if (!contents || contents.isDestroyed()) return;

    try {
      contents.setBackgroundThrottling(true);
    } catch (error) {
      log.error("Grooving failed to turn the background throttling back on", error);
    }
  }
  //#endregion

  //#region Effects
  private runEffect(effect: GroovingEffect) {
    switch (effect.type) {
      case "load-moods":
        void this.loadMoods(this.epoch, this.pageToken);
        break;
      case "store-consent":
        // The change listener runs inside set, and this write is the answer on the consent screen, not a reason to close
        this.writingConsent = true;
        try {
          this.getDependency(ConfigStore).set("integrations.groovingConsent", { choice: effect.choice, at: new Date().toISOString() });
        } finally {
          this.writingConsent = false;
        }
        break;
      case "collect": {
        // The effect runs in the dispatch that moved to collect, so the session's rounds are read from the flow
        const flow = this.state.flow;
        if (flow.kind !== "collect") {
          log.error(`Grooving got a collect effect in the ${flow.kind} flow`);
          break;
        }
        void this.collect(this.epoch, ++this.collectToken, effect.request, flow.session.rounds);
        break;
      }
      case "request-pair":
        void this.requestPair(this.epoch, effect);
        break;
      case "request-list":
        void this.requestList(this.epoch, effect.requestId, effect.session);
        break;
      case "preview-start":
        this.startPreview(this.epoch, effect.videoId);
        break;
      case "preview-end":
        this.clearPreviewTimer();
        this.previewToken++;
        this.enqueuePlayback(GroovingPageCall.PreviewEnd);
        break;
      case "replace-queue": {
        const epoch = this.epoch;
        const pageToken = this.pageToken;
        this.enqueuePlayback(GroovingPageCall.ReplaceQueue, effect.videoIds, ok => {
          if (epoch !== this.epoch || pageToken !== this.pageToken) return;
          this.dispatch({ type: ok ? "queue-replaced" : "queue-failed" });
        });
        break;
      }
      case "save-playlist":
        void this.savePlaylist(this.epoch, this.pageToken, effect.title, effect.videoIds);
        break;
      case "collect-continuation":
        void this.collectContinuation(this.epoch, this.pageToken, effect.requestId, effect.relatedOf).catch(error =>
          log.error("Grooving failed to collect the continuation candidates", error)
        );
        break;
      case "request-continuation":
        void this.requestContinuation(this.epoch, effect.requestId).catch(error =>
          log.error("Grooving failed to request a continuation list", error)
        );
        break;
      case "append-queue":
        // The queue keeps playing whatever this answer is, so a failure is only logged (and the flow does not change)
        this.enqueuePlayback(GroovingPageCall.AppendQueue, effect.videoIds, ok => {
          if (!ok) log.warn("Grooving could not add the continuation to the queue");
        });
        break;
      case "add-to-playlist":
        void this.addToPlaylist(this.epoch, this.pageToken, effect.playlistId, effect.videoIds).catch(error =>
          log.error("Grooving failed to add the tracks to the playlist", error)
        );
        break;
    }
  }

  private async loadMoods(epoch: number, pageToken: number) {
    this.moodsFailed = false;
    const answer = await this.callPage(GroovingPageCall.GetMoods);
    if (epoch !== this.epoch || pageToken !== this.pageToken) return;

    const moods = answer.ok ? readMoods(answer.value) : null;
    if (moods) this.moods = moods;
    this.moodsFailed = moods === null && this.moods === null;
    this.sendState();
  }

  private async collect(epoch: number, token: number, request: GroovingSourceRequest, rounds: GroovingRounds) {
    const current = () => epoch === this.epoch && token === this.collectToken;
    const fail = (reason: GroovingFailureReason) => {
      if (current()) this.dispatch({ type: "collect-failed", reason });
    };

    if (request.mood.kind === "blend") return this.collectBlend(request, rounds, groovingMoodLabel(request.mood), current, fail);
    if (request.mood.kind === "song") return this.collectSong(request, rounds, current, fail);

    // The sources are collected with the request as it is. A text mood has nothing for the page to collect itself, so its
    // mood tracks come from the searches the LLM thinks of, and the history and liked tracks still come from the page.
    // As in a blend, the LLM starts along with the collecting and the page runs the searches only after it
    const [collected, queries] = await Promise.all([
      this.callPage(GroovingPageCall.CollectSources, request),
      request.mood.kind === "text" ? this.requestQueries(request.mood.text, current) : Promise.resolve<GroovingLlmResult<string[]> | null>(null)
    ]);
    // A run that ended sends no searches to the page
    if (!current()) return;

    if (queries && !queries.ok) return fail(queries.reason);
    const sources = collected.ok ? readSources(collected.value) : null;
    if (!sources) return fail(collected.ok ? GroovingFailureReason.YtmUnreadable : collected.reason);

    if (queries) {
      const tracks = await this.searchTracks(queries.value, current, fail);
      if (!tracks) return;
      sources.mood = tracks;
    }
    this.buildCandidates(request, rounds, sources, fail);
  }

  /**
   * A song's mood tracks are its related tracks, which the page collects (and fills with the artist's songs when there are
   * too few). The seed song itself is left out of the candidates. No search queries are asked of the LLM
   */
  private async collectSong(
    request: GroovingSourceRequest,
    rounds: GroovingRounds,
    current: () => boolean,
    fail: (reason: GroovingFailureReason) => void
  ) {
    if (request.mood.kind !== "song") return;
    const song = request.mood.song;

    const collected = await this.callPage(GroovingPageCall.CollectSources, request);
    if (!current()) return;

    const sources = collected.ok ? readSources(collected.value) : null;
    if (!sources) return fail(collected.ok ? GroovingFailureReason.YtmUnreadable : collected.reason);
    // The page could not find the song it searched for (a recognized song has no videoId, so the page searches).
    // This is seed-not-found: the user can retry or pick another song
    if (sources.seedMissing === true) return fail(GroovingFailureReason.SeedNotFound);

    // The page's search may have decided the videoId when the mood's song had none
    const seed: GroovingSeedMatch = { videoId: song.videoId ?? sources.seedVideoId ?? null, title: song.title, artist: song.artist };
    // A song run's mood tracks are its related tracks, so the "filled from the mood" note is only used for the artist fill
    const built = buildGroovingCandidates({ direction: request.direction, historyShared: request.historyShared, sources, seed });
    if (!groovingCandidatesEnough(built.candidates, request.direction, rounds)) return fail(GroovingFailureReason.NotEnough);
    this.runKnownArtists = knownArtists(sources.history, sources.liked);
    this.dispatch({ type: "candidates-ready", candidates: built.candidates, filledFromMood: sources.seedFilled === true });
  }

  /**
   * A blend's mood tracks are the genres' playlists from the page mixed with the searches the LLM thinks of for the whole blend.
   * The LLM starts along with the page's collecting, but the page runs the searches only after it: in the page's pacer they
   * would go between the requests of the collecting, which could then run past its deadline
   */
  private async collectBlend(
    request: GroovingSourceRequest,
    rounds: GroovingRounds,
    moodText: string,
    current: () => boolean,
    fail: (reason: GroovingFailureReason) => void
  ) {
    const [collected, queries] = await Promise.all([this.callPage(GroovingPageCall.CollectSources, request), this.requestQueries(moodText, current)]);
    // A run that ended sends no searches to the page
    if (!current()) return;

    if (!queries.ok) return fail(queries.reason);
    const sources = collected.ok ? readSources(collected.value) : null;
    if (!sources) return fail(collected.ok ? GroovingFailureReason.YtmUnreadable : collected.reason);

    const tracks = await this.searchTracks(queries.value, current, fail);
    if (!tracks) return;

    sources.mood = alternate(sources.mood, tracks);
    this.buildCandidates(request, rounds, sources, fail);
  }

  /**
   * A mix that lacks familiar or new candidates for its rounds would fail the pairs in the middle, so it is not enough either
   */
  private buildCandidates(
    request: GroovingSourceRequest,
    rounds: GroovingRounds,
    sources: GroovingSources,
    fail: (reason: GroovingFailureReason) => void,
    seed: GroovingSeedMatch | null = null
  ) {
    const built = buildGroovingCandidates({ direction: request.direction, historyShared: request.historyShared, sources, seed });
    if (!groovingCandidatesEnough(built.candidates, request.direction, rounds)) return fail(GroovingFailureReason.NotEnough);

    // Kept for the continuation, which marks the related tracks with the same artists (the history is not read again)
    this.runKnownArtists = knownArtists(sources.history, sources.liked);
    this.dispatch({ type: "candidates-ready", candidates: built.candidates, filledFromMood: built.filledFromMood });
  }

  /**
   * Asks the LLM for searches for the mood text, and asks once more when the answer was not usable.
   * The second ask only goes out for the run in progress, because the LLM call takes the abort signal of the run at that time
   */
  private async requestQueries(moodText: string, current: () => boolean): Promise<GroovingLlmResult<string[]>> {
    const ask = () => this.runLlm((llm, config, signal) => llm.requestSearchQueries(config, { moodText, language: this.llmLanguage() }, { signal }));

    const first = await ask();
    if (first.ok || first.kind !== GroovingLlmFailureKind.Unusable || !current()) return first;

    log.warn("Grooving search queries were not usable, asking once more");
    return ask();
  }

  /**
   * The page runs the searches. Null when the run ended (the searches are dropped) or the answer failed (the failure is sent)
   */
  private async searchTracks(queries: string[], current: () => boolean, fail: (reason: GroovingFailureReason) => void) {
    const searched = await this.callPage(GroovingPageCall.Search, queries);
    if (!current()) return null;

    const tracks = searched.ok ? readTracks(searched.value) : null;
    if (!tracks) fail(searched.ok ? GroovingFailureReason.YtmUnreadable : searched.reason);
    return tracks;
  }

  private async requestPair(epoch: number, effect: Extract<GroovingEffect, { type: "request-pair" }>) {
    const { requestId, session, assumed } = effect;
    // The prefetch takes the answer to the pair on screen for granted. The effect runs in the dispatch that put that pair there
    const flow = this.state.flow;
    const history = assumed !== null && flow.kind === "choose" ? [...session.history, { pair: flow.pair, answer: assumed }] : session.history;

    const result = await this.runLlm((llm, config, signal) =>
      llm.requestPair(
        config,
        {
          mood: session.mood,
          language: this.language(),
          direction: session.direction,
          candidates: session.candidates,
          history,
          shown: session.shown
        },
        { signal }
      )
    );
    if (epoch !== this.epoch) return;

    if (!result.ok) {
      this.dispatch(
        result.kind === GroovingLlmFailureKind.Unusable
          ? { type: "pair-unusable", requestId }
          : { type: "pair-failed", requestId, reason: result.reason }
      );
      return;
    }

    const check = checkGroovingPair(result.value, { candidates: session.candidates, direction: session.direction, shown: session.shown });
    if (check.ok) {
      this.dispatch({ type: "pair-arrived", requestId, pair: result.value });
    } else {
      log.warn(`Grooving pair was not usable: ${check.problem}`);
      this.dispatch({ type: "pair-unusable", requestId });
    }
  }

  private async requestList(epoch: number, requestId: string, session: GroovingSession) {
    const { direction, history } = session;
    // The prompt, the familiar count and the check all use the same candidates, so a dropped track is never asked for
    const candidates = groovingListCandidates({ candidates: session.candidates, direction, history });
    const familiarCount = groovingFamiliarCount({ direction, history, candidates });

    const result = await this.runLlm((llm, config, signal) =>
      llm.requestList(config, { mood: session.mood, language: this.language(), direction, candidates, history, familiarCount }, { signal })
    );
    if (epoch !== this.epoch) return;

    if (!result.ok) {
      this.dispatch(
        result.kind === GroovingLlmFailureKind.Unusable
          ? { type: "list-unusable", requestId }
          : { type: "list-failed", requestId, reason: result.reason }
      );
      return;
    }

    const check = checkGroovingList(result.value, { candidates, direction, familiarCount });
    if (check.ok) {
      // The toggle starts from its last choice, read when the list arrives rather than at startup
      const continueEnabled = this.getDependency(ConfigStore).get("integrations.groovingContinue") ?? false;
      this.dispatch({ type: "list-arrived", requestId, list: result.value, continueEnabled });
    } else {
      log.warn(`Grooving list was not usable: ${check.problem}`);
      this.dispatch({ type: "list-unusable", requestId });
    }
  }

  /**
   * The related tracks of the listed track the reactions point to, then the continuation's candidates. Sends exactly one
   * answer: the decision drops it by requestId when the toggle went off meanwhile (the epoch is the only silent drop)
   */
  private async collectContinuation(epoch: number, pageToken: number, requestId: number, relatedOf: string | null) {
    let related: GroovingTrack[] = [];
    if (relatedOf !== null) {
      const answer = await this.callPage(GroovingPageCall.Related, relatedOf);
      if (epoch !== this.epoch) return;
      // A reload drops the page's answer: the flow is told it could not be collected, so it does not wait forever
      const tracks = answer.ok && pageToken === this.pageToken ? readTracks(answer.value) : null;
      if (tracks === null) {
        this.dispatch({ type: "continuation-candidates", requestId, ok: false, reason: "failed" });
        return;
      }
      related = tracks;
    }

    const flow = this.state.flow;
    if (flow.kind !== "done" && flow.kind !== "saving" && flow.kind !== "saved") return;
    if (flow.continuation.requestId !== requestId) {
      // The toggle went off or another request began: the decision drops this answer by its requestId
      this.dispatch({ type: "continuation-candidates", requestId, ok: false, reason: "failed" });
      return;
    }

    const { session, continuation } = flow;
    const request = continuationRequest({
      candidates: session.candidates,
      direction: session.direction,
      history: session.history,
      listed: continuation.listed,
      reactions: continuation.reactions,
      knownArtists: this.runKnownArtists ?? knownArtistsOfCandidates(session.candidates),
      related
    });
    if (!request.enough) {
      this.dispatch({ type: "continuation-candidates", requestId, ok: false, reason: "short" });
      return;
    }

    this.continuationInput = {
      requestId,
      candidates: request.candidates,
      familiarCount: request.familiarCount,
      direction: session.direction,
      history: session.history,
      listed: continuation.listed,
      reactions: continuation.reactions,
      avoidedArtists: request.avoidedArtists
    };
    this.dispatch({ type: "continuation-candidates", requestId, ok: true });
  }

  /**
   * Asks the LLM for the continuation list with the candidates kept at collect time, checks the answer with the same
   * check as a list, and sends one answer. The state decides whether to ask once more
   */
  private async requestContinuation(epoch: number, requestId: number) {
    const input = this.continuationInput;
    if (input === null || input.requestId !== requestId) {
      this.dispatch({ type: "continuation-failed", requestId });
      return;
    }

    const flow = this.state.flow;
    if (flow.kind !== "done" && flow.kind !== "saving" && flow.kind !== "saved") return;

    const result = await this.runLlm((llm, config, signal) =>
      llm.requestContinuation(
        config,
        {
          mood: flow.session.mood,
          language: this.language(),
          direction: input.direction,
          candidates: input.candidates,
          history: input.history,
          familiarCount: input.familiarCount,
          listed: input.listed,
          reactions: input.reactions,
          avoidedArtists: input.avoidedArtists
        },
        { signal }
      )
    );
    if (epoch !== this.epoch) return;

    if (!result.ok) {
      this.dispatch(
        result.kind === GroovingLlmFailureKind.Unusable ? { type: "continuation-unusable", requestId } : { type: "continuation-failed", requestId }
      );
      return;
    }

    const check = checkGroovingList(result.value, { candidates: input.candidates, direction: input.direction, familiarCount: input.familiarCount });
    if (!check.ok) {
      log.warn(`Grooving continuation was not usable: ${check.problem}`);
      this.dispatch({ type: "continuation-unusable", requestId });
      return;
    }

    const tracks = result.value.videoIds.flatMap(videoId => input.candidates.find(track => track.videoId === videoId) ?? []);
    this.dispatch({ type: "continuation-arrived", requestId, tracks });
  }

  // Waits for the page as long as a save does, and only uses the playlist id after checking its shape
  private async addToPlaylist(epoch: number, pageToken: number, playlistId: string, videoIds: string[]) {
    if (playlistId === "" || playlistId.length > MAX_TEXT) {
      this.dispatch({ type: "playlist-add-failed" });
      return;
    }

    const answer = await this.enqueuePageCall(GROOVING_SAVE_TIMEOUT_MS, GroovingPageCall.AddToPlaylist, { playlistId, videoIds });
    if (epoch !== this.epoch || pageToken !== this.pageToken) return;
    this.dispatch(answer.ok ? { type: "playlist-added" } : { type: "playlist-add-failed" });
  }

  /**
   * The preview's seconds are counted from when the page answers that it started playing, not from the ask, which can wait
   * behind earlier playback calls and the page's pacer
   */
  private startPreview(epoch: number, videoId: string) {
    this.clearPreviewTimer();
    const token = ++this.previewToken;

    this.enqueuePlayback(GroovingPageCall.PreviewStart, videoId, ok => {
      // The answer to an earlier preview, even of the same track, does nothing
      if (epoch !== this.epoch || token !== this.previewToken || this.state.previewing !== videoId) return;

      // The page could not play it, so the screen must not say it is previewing
      if (!ok) return this.dispatch({ type: "preview-ended" });

      this.clearPreviewTimer();
      this.previewTimer = setTimeout(() => {
        this.previewTimer = null;
        if (epoch === this.epoch && this.state.previewing === videoId) this.dispatch({ type: "preview-ended" });
      }, GROOVING_PREVIEW_SECONDS * 1000);
    });
  }

  private clearPreviewTimer() {
    if (this.previewTimer === null) return;

    clearTimeout(this.previewTimer);
    this.previewTimer = null;
  }

  // The page switches tracks and the queue, which cannot overlap. A call queued for an old document is dropped
  private enqueuePlayback(call: GroovingPageCall, arg?: unknown, done?: (ok: boolean) => void) {
    const pageToken = this.pageToken;
    this.playbackChain = this.playbackChain.then(async () => {
      // The page this call was meant for is gone; the reload already put the state right, so it is not a failure
      if (pageToken !== this.pageToken) return;

      const answer = await this.callPage(call, ...(arg === undefined ? [] : [arg]));
      if (!answer.ok) log.warn(`Grooving page call '${call}' failed: ${answer.reason}`);
      done?.(answer.ok);
    });
  }

  /**
   * Asks the page after the calls already on the playback chain have answered, so the wait starts when the page takes the call
   * (the page runs its handlers one at a time). Never throws, and a failure does not stop the calls after it.
   * A call queued for an old document answers as unreadable without asking the new page
   */
  private enqueuePageCall(timeoutMs: number | null, call: GroovingPageCall, ...args: unknown[]): Promise<PageAnswer> {
    const pageToken = this.pageToken;
    const ask = () =>
      pageToken === this.pageToken
        ? this.callPageWithin(timeoutMs, call, ...args)
        : Promise.resolve<PageAnswer>({ ok: false, reason: GroovingFailureReason.YtmUnreadable });
    const answer = this.playbackChain.then(ask, ask);
    this.playbackChain = answer.then(
      () => undefined,
      () => undefined
    );
    return answer;
  }

  private async savePlaylist(epoch: number, pageToken: number, title: string, videoIds: string[]) {
    // The page's save can take longer than the default wait, and a save that the main side gave up on can still make the playlist.
    // Sent behind the playback chain, as the page would otherwise start the save only after a preview or queue call that is still running
    const answer = await this.enqueuePageCall(GROOVING_SAVE_TIMEOUT_MS, GroovingPageCall.SavePlaylist, { title, videoIds });
    if (epoch !== this.epoch || pageToken !== this.pageToken) return;

    // The id is used later to add the continuation lists to the same playlist, so only a plain id is taken
    const playlistId = answer.ok && isRecord(answer.value) && typeof answer.value.playlistId === "string" ? answer.value.playlistId : null;
    if (playlistId === null || playlistId === "" || playlistId.length > MAX_TEXT) {
      this.dispatch({ type: "save-failed" });
    } else {
      this.dispatch({ type: "saved", playlistId });
    }
  }
  //#endregion

  //#region The page
  private liveContents(): Electron.WebContents | null {
    const contents = this.ytmView?.webContents;
    return contents && !contents.isDestroyed() ? contents : null;
  }

  // The Language setting, and for Auto the page's HL from the open signal
  private language(): GroovingDisplayLanguage {
    return resolveGroovingLanguage(this.getDependency(ConfigStore).get("integrations.groovingLanguage"), this.pageLanguage);
  }

  // The language's name, which the LLM is asked to write in
  private llmLanguage(): string {
    return GROOVING_LANGUAGE_NAMES[this.language()];
  }

  // Asks the page with the ProtectedAPI's default wait
  private async callPage(call: GroovingPageCall, ...args: unknown[]): Promise<PageAnswer> {
    return this.callPageWithin(null, call, ...args);
  }

  /**
   * Asks the page, waiting timeoutMs for the answer (null for the ProtectedAPI's default wait of invokeMessage).
   * Never throws: a page that is gone answers nothing for the whole wait and then rejects without a reason.
   * A page that is missing or does not answer in time is also YtmUnreadable (only a failed LLM call is Network)
   */
  private async callPageWithin(timeoutMs: number | null, call: GroovingPageCall, ...args: unknown[]): Promise<PageAnswer> {
    if (!this.liveContents()) return { ok: false, reason: GroovingFailureReason.YtmUnreadable };

    // A call for a document whose page has not bound its port yet waits for it, so it does not sit on the dead port
    const bindToken = this.pageToken;
    const bindWait = this.pageBindWait;
    if (bindWait !== null) {
      const bound = await bindWait;
      // Another reload happened while waiting: this call belonged to the document before it
      if (!bound || bindToken !== this.pageToken) return { ok: false, reason: GroovingFailureReason.YtmUnreadable };
      if (!this.liveContents()) return { ok: false, reason: GroovingFailureReason.YtmUnreadable };
    }

    try {
      const api = this.getDependency(ProtectedAPIManager).createOrGetAPI(GROOVING_PROTECTED_API);
      const result = (await (timeoutMs === null ? api.invokeMessage(call, ...args) : api.invokeMessageWithTimeout(timeoutMs, call, ...args)))[0];
      if (isRecord(result) && result.ok === true) return { ok: true, value: result.value };
      return { ok: false, reason: GroovingFailureReason.YtmUnreadable };
    } catch {
      return { ok: false, reason: GroovingFailureReason.YtmUnreadable };
    }
  }
  //#endregion

  //#region The LLM and its usage
  /**
   * Decrypts the key, loads the LLM module on the first call and counts the usage of the call. Never throws.
   * A call over the cap of calls (GROOVING_LLM_CALL_LIMIT) is not sent
   */
  private async runLlm<T>(call: (llm: typeof import("./llm"), config: GroovingLlmConfig, signal: AbortSignal) => Promise<GroovingLlmResult<T>>) {
    if (!this.llmCalls.take()) {
      log.warn("Grooving LLM call not sent: over the cap of calls");
      return failedLlm(GroovingFailureReason.RateLimited);
    }
    const signal = this.abort.signal;
    this.llmInFlight++;
    try {
      const config = await this.readLlmConfig();
      if (config === null) return failedLlm(GroovingFailureReason.InvalidKey);

      // Loaded on the first call so the AI SDK does not slow the start
      const llm = await import("./llm");
      const result = await call(llm, config, signal);
      this.addUsage(config.model, result.usage);
      return result;
    } catch (error) {
      // The error can carry the request, so only its kind is logged
      log.error(`Grooving LLM call threw ${error instanceof Error ? error.name : typeof error}`);
      return failedLlm(GroovingFailureReason.Network);
    } finally {
      this.llmInFlight--;
      if (this.llmInFlight === 0) this.flushUsage();
    }
  }

  private addUsage(model: string, usage: Usage) {
    if (usage.inputTokens === 0 && usage.outputTokens === 0) return;

    const usd = estimateGroovingUsd(model, usage.inputTokens, usage.outputTokens);
    this.runUsage.inputTokens += usage.inputTokens;
    this.runUsage.outputTokens += usage.outputTokens;
    // A model missing from the price table has no cost, and its tokens are kept apart for the settings' month
    const pending = usd === null ? this.pendingUsage.unpriced : this.pendingUsage.priced;
    pending.inputTokens += usage.inputTokens;
    pending.outputTokens += usage.outputTokens;
    if (usd === null) {
      this.runUsage.usdKnown = false;
    } else {
      this.runUsage.usd += usd;
      this.pendingUsage.priced.usd += usd;
    }

    // Calls that end after the done screen still belong to that run
    const kind = this.state.flow.kind;
    if (kind === "done" || kind === "saving" || kind === "saved") this.sendState();
  }

  // Written once the calls in flight are over, not after each of them, because every write goes to all windows
  private flushUsage() {
    const { priced, unpriced } = this.pendingUsage;
    const hasTokens = (usage: Usage) => usage.inputTokens !== 0 || usage.outputTokens !== 0;
    if (!hasTokens(priced) && !hasTokens(unpriced)) return;

    this.pendingUsage = emptyPendingUsage();
    try {
      const configStore = this.getDependency(ConfigStore);
      const stored = configStore.get("integrations.groovingUsage");
      // Both adds go to the same month, or the first would be dropped by the second at the turn of a month
      const month = groovingMonth();
      let next = isUsage(stored) ? stored : null;
      if (hasTokens(priced)) {
        next = addGroovingUsage(next, { month, inputTokens: priced.inputTokens, outputTokens: priced.outputTokens, estimatedUsd: priced.usd });
      }
      if (hasTokens(unpriced)) {
        next = addGroovingUsage(next, { month, inputTokens: unpriced.inputTokens, outputTokens: unpriced.outputTokens, estimatedUsd: null });
      }
      if (next) configStore.set("integrations.groovingUsage", next);
    } catch (error) {
      log.error("Grooving failed to write the usage", error);
    }
  }
  //#endregion

  private sendState() {
    try {
      const provider = this.readProvider();
      const viewState = toGroovingViewState(this.state, {
        moods: this.moods,
        moodsFailed: this.moodsFailed,
        providerLabel: GROOVING_PROVIDER_LABELS[provider],
        model: this.readModel(provider),
        safeStorageAvailable: this.safeStorageAvailable(),
        language: this.language(),
        usage: {
          inputTokens: this.runUsage.inputTokens,
          outputTokens: this.runUsage.outputTokens,
          estimatedUsd: this.runUsage.usdKnown ? this.runUsage.usd : null
        }
      });

      const message: GroovingViewMessage = { ...viewState, language: this.language() };

      // Sent to the YTM view preload, which hands it to the page
      const contents = this.liveContents();
      if (contents) contents.send(GroovingIpc.State, message);
    } catch (error) {
      log.error("Grooving failed to send the state", error);
    }
  }
}
