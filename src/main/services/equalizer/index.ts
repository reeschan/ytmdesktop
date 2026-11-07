import log from "electron-log";
import { DependencyConstructor, YTMViewStatus } from "~shared/types";
import type { MemoryStoreSchema } from "~shared/store/schema";
import {
  BundledEqualizerPresetId,
  EQUALIZER_BAND_FREQUENCIES,
  EQUALIZER_SAVED_PRESET_LIMIT,
  EqualizerPresetKind,
  type EqualizerPresetRef,
  type EqualizerSettings,
  type EqualizerValues
} from "~shared/equalizer";
import {
  EqualizerIpc,
  EqualizerSignalType,
  isEqualizerPresetRef,
  isEqualizerSavedPreset,
  isEqualizerSignal,
  isEqualizerValues
} from "~shared/equalizer/messages";
import { GROOVING_TRACK_TEXT_MAX, GroovingFailureReason, type GroovingProvider, resolveGroovingLanguage } from "~shared/grooving";
import { createGroovingCallWindow } from "~shared/grooving/pace";
import { addGroovingUsage, estimateGroovingUsd, groovingMonth, GroovingUsageFeature } from "~shared/grooving/usage";
import Service from "../service";
import ConfigStore from "../configstore";
import MemoryStore from "../memorystore";
import PlayerStateStore from "../playerstatestore";
import YTMViewManager from "../ytmviewmanager";
import { AppView } from "../windowmanager/appview";
import { hasLlmKey, readLlmConfig, readLlmProvider } from "../llm/config";
import { isUsage } from "../grooving/effects";
import {
  EqualizerEffect,
  EqualizerEffectType,
  EqualizerEvent,
  EqualizerEventType,
  EqualizerModel,
  initialEqualizerModel,
  reduceEqualizer,
  toEqualizerViewState
} from "./effects";

// The module's constants stay out of the class body: a class that names itself is renamed by the minifier into a class
// expression named like the other such classes, and the service host tells services apart by that name

// A save waits this long after the last change, so a slider drag does not write on every step
const SAVE_DELAY_MS = 300;
// The AI tuning is limited to this many calls in this window, counted in main (the page cannot be trusted with it)
const AI_CALL_LIMIT = 10;
const AI_CALL_WINDOW_MS = 10 * 60_000;
// Cuts the stored consent time, which is only ever an ISO string
const CONSENT_TEXT_MAX = 64;
// Cuts the page language the signal carries (same cap as Grooving)
const PAGE_LANGUAGE_MAX = 32;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const copyValues = (values: EqualizerValues): EqualizerValues => ({
  bands: [...values.bands],
  preamp: values.preamp,
  preampManual: values.preampManual
});

function defaultEqualizerSettings(): EqualizerSettings {
  return {
    enabled: false,
    values: { bands: EQUALIZER_BAND_FREQUENCIES.map(() => 0), preamp: 0, preampManual: false },
    selectedPreset: { kind: EqualizerPresetKind.Bundled, id: BundledEqualizerPresetId.Flat },
    presets: [],
    aiConsentAt: null
  };
}

function copyPresetRef(ref: EqualizerPresetRef): EqualizerPresetRef {
  return ref.kind === EqualizerPresetKind.Bundled
    ? { kind: EqualizerPresetKind.Bundled, id: ref.id }
    : { kind: EqualizerPresetKind.Saved, name: ref.name };
}

/**
 * Rebuilds the equalizer settings from only their own keys. A part that does not pass its check is replaced by its default,
 * and a saved preset that does not pass is dropped on its own. The settings file can hold anything (it is not checked on
 * read, and it can be edited by hand), and a state that fails the view's check would never reach the page
 */
function sanitizeEqualizerSettings(value: unknown): EqualizerSettings {
  const defaults = defaultEqualizerSettings();
  if (!isRecord(value)) return defaults;

  const presets = Array.isArray(value.presets)
    ? (value.presets as unknown[])
        .filter(isEqualizerSavedPreset)
        .slice(0, EQUALIZER_SAVED_PRESET_LIMIT)
        .map(preset => ({ name: preset.name, values: copyValues(preset.values) }))
    : defaults.presets;
  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : defaults.enabled,
    values: isEqualizerValues(value.values) ? copyValues(value.values) : defaults.values,
    selectedPreset:
      value.selectedPreset === null
        ? null
        : isEqualizerPresetRef(value.selectedPreset)
          ? copyPresetRef(value.selectedPreset)
          : defaults.selectedPreset,
    presets,
    aiConsentAt: typeof value.aiConsentAt === "string" ? value.aiConsentAt.slice(0, CONSENT_TEXT_MAX) : defaults.aiConsentAt
  };
}

export default class Equalizer extends Service {
  public static override readonly dependencies: DependencyConstructor<Service>[] = [
    ConfigStore,
    MemoryStore<MemoryStoreSchema>,
    PlayerStateStore,
    YTMViewManager
  ];

  private model: EqualizerModel = initialEqualizerModel(defaultEqualizerSettings());
  private ytmView: AppView | null = null;
  private equalizerListener: ReturnType<ConfigStore["onDidChange"]> | null = null;
  private providerListener: ReturnType<ConfigStore["onDidChange"]> | null = null;
  private keysListener: ReturnType<ConfigStore["onDidChange"]> | null = null;
  private saveTimer: NodeJS.Timeout | null = null;
  // Whether a key is stored. Read only when a signal needs it, and the last read is kept for the others
  private keyKnown = false;
  // The provider, read at startup and when it changes, so sending the state does not read the settings file
  private provider: GroovingProvider | null = null;
  // The page language the last ai-request carried. Kept so a consent step in between does not lose it
  private pageLanguage: string | null = null;
  // True while this service writes `equalizer`: the change listener runs inside set, and the write is not a change from outside
  private writing = false;
  // The request in flight. Null when none is
  private aiAbort: AbortController | null = null;
  // Counts across requests and new documents. Never reset
  private aiCalls = createGroovingCallWindow(AI_CALL_LIMIT, AI_CALL_WINDOW_MS);

  private signalListener = (_event: unknown, signal: unknown) => {
    try {
      // The page can post anything, so the shape is checked here too
      if (isEqualizerSignal(signal)) this.dispatch({ type: EqualizerEventType.Signal, signal });
    } catch (error) {
      log.error("Equalizer failed to handle a signal", error);
    }
  };

  // A new document has no state of its own, and its preload has none to give back
  private readyListener = () => {
    this.sendState();
  };

  // The view is attached on its first status, after its first "ready" has already gone by, so the state is sent once the
  // page's scripts report ready. Sending it again on a later status only repeats the same state
  private statusListener = () => {
    try {
      this.attachYTMView();
      if (this.getDependency(YTMViewManager).status === YTMViewStatus.Ready) this.sendState();
    } catch (error) {
      log.error("Equalizer failed to attach the view", error);
    }
  };

  private recreatedListener = () => {
    try {
      this.attachYTMView();
      this.sendState();
    } catch (error) {
      log.error("Equalizer failed to handle the new view", error);
    }
  };

  public override onPreInitialized() {}

  public override onInitialized() {
    try {
      const configStore = this.getDependency(ConfigStore);
      this.model = initialEqualizerModel(sanitizeEqualizerSettings(configStore.get("equalizer")));
      this.provider = readLlmProvider(configStore);

      // The YTM view is created after the services are initialized, so it is attached once the manager reports a status for it
      const viewManager = this.getDependency(YTMViewManager);
      viewManager.on("status-changed", this.statusListener);
      viewManager.on("view-recreated", this.recreatedListener);
      this.attachYTMView();

      this.equalizerListener = configStore.onDidChange("equalizer", value => this.handleEqualizerChanged(value));
      // The AI service and its key decide what the panel offers, so a change of either sends the state again
      this.providerListener = configStore.onDidChange("integrations.groovingProvider", () => this.handleAiSettingsChanged(true));
      this.keysListener = configStore.onDidChange("integrations.groovingApiKeys", () => this.handleAiSettingsChanged(false));
    } catch (error) {
      log.error("Equalizer failed to initialize", error);
    }

    log.info("Equalizer initialized");
  }

  public override onPostInitialized() {}

  public override onTerminated() {
    try {
      const viewManager = this.getDependency(YTMViewManager);
      viewManager.off("status-changed", this.statusListener);
      viewManager.off("view-recreated", this.recreatedListener);
      this.equalizerListener?.();
      this.equalizerListener = null;
      this.providerListener?.();
      this.providerListener = null;
      this.keysListener?.();
      this.keysListener = null;
      this.detachYTMView();
      this.aiAbort?.abort();
      this.aiAbort = null;
      // A change still waiting for its save is written now
      if (this.saveTimer !== null) this.saveSettings();
    } catch (error) {
      log.error("Equalizer failed to terminate", error);
    }
  }

  //#region The view
  private attachYTMView() {
    const view = this.getDependency(YTMViewManager).getView() ?? null;
    if (view === this.ytmView) return;

    this.detachYTMView();
    this.ytmView = view;
    this.ytmView?.ipcOn(EqualizerIpc.Signal, this.signalListener);
    this.ytmView?.on("ready", this.readyListener);
  }

  private detachYTMView() {
    if (!this.ytmView) return;

    this.ytmView.ipcOff(EqualizerIpc.Signal, this.signalListener);
    this.ytmView.off("ready", this.readyListener);
    this.ytmView = null;
  }

  private liveContents(): Electron.WebContents | null {
    const contents = this.ytmView?.webContents;
    return contents && !contents.isDestroyed() ? contents : null;
  }

  private sendState() {
    try {
      const contents = this.liveContents();
      if (!contents) return;

      // Only the state made for the screen is sent, never the settings (they hold the encrypted keys)
      const provider = this.provider ?? readLlmProvider(this.getDependency(ConfigStore));
      contents.send(EqualizerIpc.State, toEqualizerViewState(this.model, provider));
    } catch (error) {
      log.error("Equalizer failed to send the state", error);
    }
  }
  //#endregion

  //#region Settings
  private hasKey(): boolean {
    try {
      return hasLlmKey(this.getDependency(ConfigStore), this.getDependency(MemoryStore<MemoryStoreSchema>));
    } catch (error) {
      log.error("Equalizer failed to look for the AI key", error);
      return false;
    }
  }

  /**
   * The settings changed outside of this service (the consent taken back in the settings screen, or an edit of the file).
   * The value goes through the same check as at startup. A change of the sliders still waiting for its save is kept: the
   * settings screen only ever changes the consent
   */
  private handleEqualizerChanged(value: unknown) {
    if (this.writing) return;

    try {
      const outside = sanitizeEqualizerSettings(value);
      const settings = this.saveTimer === null ? outside : { ...this.model.settings, aiConsentAt: outside.aiConsentAt };
      this.dispatch({ type: EqualizerEventType.SettingsChanged, settings });
    } catch (error) {
      log.error("Equalizer failed to handle a settings change", error);
    }
  }

  private handleAiSettingsChanged(providerChanged: boolean) {
    try {
      if (providerChanged) this.provider = readLlmProvider(this.getDependency(ConfigStore));
      this.dispatch({ type: EqualizerEventType.SettingsChanged, settings: this.model.settings });
    } catch (error) {
      log.error("Equalizer failed to handle an AI settings change", error);
    }
  }

  // Waits for the last change, not for the first one, and writes the whole of `equalizer` at once
  private scheduleSave() {
    if (this.saveTimer !== null) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveSettings(), SAVE_DELAY_MS);
  }

  private saveSettings() {
    if (this.saveTimer !== null) clearTimeout(this.saveTimer);
    this.saveTimer = null;

    this.writing = true;
    try {
      // Rebuilt from the settings' own keys, so nothing extra goes into the settings file
      this.getDependency(ConfigStore).set("equalizer", sanitizeEqualizerSettings(this.model.settings));
    } catch (error) {
      log.error("Equalizer failed to write the settings", error);
    } finally {
      this.writing = false;
    }
  }
  //#endregion

  //#region The decision and its effects
  /**
   * Runs the event through the decision, keeps the new model and runs the effects
   */
  private dispatch(event: EqualizerEvent) {
    // The decision uses the key only for an AI request and its consent, so the settings are read for those two alone
    if (event.type === EqualizerEventType.Signal) {
      const signal = event.signal;
      if (signal.type === EqualizerSignalType.AiRequest) {
        this.pageLanguage = typeof signal.pageLanguage === "string" ? signal.pageLanguage.slice(0, PAGE_LANGUAGE_MAX) : null;
        this.keyKnown = this.hasKey();
      } else if (signal.type === EqualizerSignalType.AiConsent) this.keyKnown = this.hasKey();
    }
    const decision = reduceEqualizer(this.model, event, { hasKey: this.keyKnown, now: new Date().toISOString() });
    this.model = decision.model;

    for (const effect of decision.effects) {
      try {
        this.runEffect(effect);
      } catch (error) {
        log.error("Equalizer failed to run an effect", error);
      }
    }
  }

  private runEffect(effect: EqualizerEffect) {
    switch (effect.type) {
      case EqualizerEffectType.SaveSettings:
        this.scheduleSave();
        break;
      case EqualizerEffectType.SendState:
        this.sendState();
        break;
      case EqualizerEffectType.RequestAi:
        void this.requestAi(effect.requestId, effect.prompt, effect.values);
        break;
      case EqualizerEffectType.CancelAi:
        this.aiAbort?.abort();
        this.aiAbort = null;
        break;
      case EqualizerEffectType.OpenSettings:
        // Main has no way to open the settings window. The YTM view's preload asks for it along with the signal
        break;
    }
  }
  //#endregion

  //#region The AI
  /**
   * Asks the LLM and hands the result to the decision. Never rejects, and sends nothing to the log but the kind of a failure
   */
  private async requestAi(requestId: number, prompt: string, values: EqualizerValues) {
    try {
      const result = await this.runAi(prompt, values);
      this.dispatch({ type: EqualizerEventType.AiResult, requestId, result });
    } catch (error) {
      log.error("Equalizer failed to hand over the AI result", error);
    }
  }

  private async runAi(
    prompt: string,
    values: EqualizerValues
  ): Promise<Extract<EqualizerEvent, { type: typeof EqualizerEventType.AiResult }>["result"]> {
    if (!this.aiCalls.take()) {
      log.warn("Equalizer AI call not sent: over the cap of calls");
      return { ok: false, reason: GroovingFailureReason.RateLimited, limitedByApp: true };
    }

    const controller = new AbortController();
    this.aiAbort = controller;
    try {
      const configStore = this.getDependency(ConfigStore);
      const config = await readLlmConfig(configStore, this.getDependency(MemoryStore<MemoryStoreSchema>));
      if (config === null) return { ok: false, reason: GroovingFailureReason.InvalidKey };

      // Loaded on the first call so the AI SDK does not slow the start
      const llm = await import("./llm");
      // Cancelled (or the consent taken back) while waiting above: nothing is sent, and the decision drops the result
      if (controller.signal.aborted) return { ok: false, reason: GroovingFailureReason.Network };

      const result = await llm.requestEqualizerTuning(
        config,
        {
          prompt,
          values,
          song: this.currentSong(),
          language: resolveGroovingLanguage(configStore.get("integrations.groovingLanguage"), this.pageLanguage)
        },
        { signal: controller.signal }
      );
      // A request cancelled in flight reports no usage, and addUsage skips an empty one
      this.addUsage(config.model, result.usage);
      return result.ok ? { ok: true, values: result.value.values, explanation: result.value.explanation } : { ok: false, reason: result.reason };
    } catch (error) {
      // The error can carry the request, so only its kind is logged
      log.error(`Equalizer AI call threw ${error instanceof Error ? error.name : typeof error}`);
      return { ok: false, reason: GroovingFailureReason.Network };
    } finally {
      if (this.aiAbort === controller) this.aiAbort = null;
    }
  }

  // The song that is playing now, or null (nothing is loaded, an ad plays, or the title or artist is empty)
  private currentSong(): { title: string; artist: string } | null {
    try {
      const state = this.getDependency(PlayerStateStore).getState();
      const details = state.videoDetails;
      if (state.adPlaying || details === null) return null;

      const title = details.title.trim().slice(0, GROOVING_TRACK_TEXT_MAX);
      const artist = details.author.trim().slice(0, GROOVING_TRACK_TEXT_MAX);
      return title === "" || artist === "" ? null : { title, artist };
    } catch (error) {
      log.error("Equalizer failed to read the playing song", error);
      return null;
    }
  }

  /**
   * Adds the call to this month's usage, as the equalizer's part. The read, the add and the write follow one another with
   * no await between them, or a write of Grooving's in between would be lost. A model missing from the price table has no
   * cost, and its tokens are counted apart
   */
  private addUsage(model: string, usage: { inputTokens: number; outputTokens: number }) {
    if (usage.inputTokens === 0 && usage.outputTokens === 0) return;

    try {
      const configStore = this.getDependency(ConfigStore);
      const stored = configStore.get("integrations.groovingUsage");
      const next = addGroovingUsage(isUsage(stored) ? stored : null, {
        month: groovingMonth(),
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        estimatedUsd: estimateGroovingUsd(model, usage.inputTokens, usage.outputTokens),
        feature: GroovingUsageFeature.Equalizer
      });
      configStore.set("integrations.groovingUsage", next);
    } catch (error) {
      log.error("Equalizer failed to write the usage", error);
    }
  }
  //#endregion
}
