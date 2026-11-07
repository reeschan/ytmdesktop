import { EQUALIZER_PROMPT_MAX, EqualizerPresetKind, type EqualizerSettings, type EqualizerValues } from "~shared/equalizer";
import {
  EqualizerAiPhase,
  EqualizerSignalType,
  type EqualizerAiState,
  type EqualizerSignal,
  type EqualizerViewState
} from "~shared/equalizer/messages";
import {
  deleteEqualizerPreset,
  effectiveEqualizerPreamp,
  equalizerPresetValues,
  isEqualizerModified,
  renameEqualizerPreset,
  saveEqualizerPreset
} from "~shared/equalizer/presets";
import type { GroovingFailureReason, GroovingProvider } from "~shared/grooving";

export const EqualizerEventType = { Signal: "signal", AiResult: "ai-result", SettingsChanged: "settings-changed" } as const;
export type EqualizerEventType = (typeof EqualizerEventType)[keyof typeof EqualizerEventType];
export const EqualizerEffectType = {
  SaveSettings: "save-settings",
  SendState: "send-state",
  RequestAi: "request-ai",
  CancelAi: "cancel-ai",
  OpenSettings: "open-settings"
} as const;
export type EqualizerEffectType = (typeof EqualizerEffectType)[keyof typeof EqualizerEffectType];
export type EqualizerModel = {
  settings: EqualizerSettings;
  ai: EqualizerAiState;
  undo: EqualizerValues | null;
  currentRequestId: number | null;
  nextRequestId: number;
  pendingPrompt: string | null;
  notice: EqualizerViewState["notice"];
};
export type EqualizerEvent =
  | { type: typeof EqualizerEventType.Signal; signal: EqualizerSignal }
  | {
      type: typeof EqualizerEventType.AiResult;
      requestId: number;
      result: { ok: true; values: EqualizerValues; explanation: string } | { ok: false; reason: GroovingFailureReason; limitedByApp?: boolean };
    }
  | { type: typeof EqualizerEventType.SettingsChanged; settings: EqualizerSettings };
export type EqualizerEffect =
  | {
      type:
        | typeof EqualizerEffectType.SaveSettings
        | typeof EqualizerEffectType.SendState
        | typeof EqualizerEffectType.CancelAi
        | typeof EqualizerEffectType.OpenSettings;
    }
  | { type: typeof EqualizerEffectType.RequestAi; requestId: number; prompt: string; values: EqualizerValues };

const copyValues = (values: EqualizerValues): EqualizerValues => ({ ...values, bands: [...values.bands] });
export function initialEqualizerModel(settings: EqualizerSettings): EqualizerModel {
  return { settings, ai: { phase: EqualizerAiPhase.Idle }, undo: null, currentRequestId: null, nextRequestId: 1, pendingPrompt: null, notice: null };
}
export function toEqualizerViewState(model: EqualizerModel, provider: GroovingProvider): EqualizerViewState {
  const { settings } = model;
  return {
    enabled: settings.enabled,
    values: { ...copyValues(settings.values), preamp: effectiveEqualizerPreamp(settings.values) },
    selectedPreset: settings.selectedPreset,
    presets: settings.presets,
    modified: isEqualizerModified(settings.values, settings.selectedPreset, settings.presets),
    ai: model.ai,
    provider,
    notice: model.notice
  };
}

export function reduceEqualizer(
  model: EqualizerModel,
  event: EqualizerEvent,
  context: { hasKey: boolean; now: string }
): { model: EqualizerModel; effects: EqualizerEffect[] } {
  let next = model;
  const effects: EqualizerEffect[] = [];
  const save = () => effects.push({ type: EqualizerEffectType.SaveSettings });
  const manual = (settings: EqualizerSettings) => {
    next = { ...next, settings, undo: null, ai: next.ai.phase === EqualizerAiPhase.Applied ? { phase: EqualizerAiPhase.Idle } : next.ai };
    save();
  };
  const request = (prompt: string) => {
    if (next.ai.phase === EqualizerAiPhase.Running) return;
    next = { ...next, undo: null, pendingPrompt: null };
    if (!context.hasKey) next = { ...next, ai: { phase: EqualizerAiPhase.NoKey } };
    else if (!next.settings.aiConsentAt) next = { ...next, ai: { phase: EqualizerAiPhase.Consent }, pendingPrompt: prompt };
    else {
      const requestId = next.nextRequestId;
      next = { ...next, ai: { phase: EqualizerAiPhase.Running }, currentRequestId: requestId, nextRequestId: requestId + 1 };
      effects.push({
        type: EqualizerEffectType.RequestAi,
        requestId,
        prompt: prompt.trim().slice(0, EQUALIZER_PROMPT_MAX),
        values: copyValues(next.settings.values)
      });
    }
  };
  if (event.type === EqualizerEventType.SettingsChanged) {
    next = { ...next, settings: event.settings };
    if (next.ai.phase === EqualizerAiPhase.Running && event.settings.aiConsentAt === null) {
      next = { ...next, ai: { phase: EqualizerAiPhase.Idle }, currentRequestId: null };
      effects.push({ type: EqualizerEffectType.CancelAi });
    }
  } else if (event.type === EqualizerEventType.AiResult) {
    if (model.currentRequestId === null || event.requestId !== model.currentRequestId) return { model, effects };
    next = { ...next, currentRequestId: null };
    if (event.result.ok) {
      next = {
        ...next,
        undo: copyValues(model.settings.values),
        settings: { ...model.settings, values: copyValues(event.result.values) },
        ai: { phase: EqualizerAiPhase.Applied, explanation: event.result.explanation, canUndo: true }
      };
      save();
    } else
      next = {
        ...next,
        ai: event.result.limitedByApp ? { phase: EqualizerAiPhase.Limited } : { phase: EqualizerAiPhase.Failed, reason: event.result.reason }
      };
  } else {
    const signal = event.signal;
    const settings = next.settings;
    switch (signal.type) {
      case EqualizerSignalType.SetEnabled:
        if (settings.enabled !== signal.enabled) {
          next = { ...next, settings: { ...settings, enabled: signal.enabled } };
          save();
        }
        break;
      case EqualizerSignalType.SetBand: {
        if (settings.values.bands[signal.index] === signal.db) break;
        const bands = [...settings.values.bands];
        bands[signal.index] = signal.db;
        manual({ ...settings, values: { ...settings.values, bands } });
        break;
      }
      case EqualizerSignalType.SetPreamp:
        if (!settings.values.preampManual || settings.values.preamp !== signal.db)
          manual({ ...settings, values: { ...settings.values, preamp: signal.db, preampManual: true } });
        break;
      case EqualizerSignalType.ResetPreamp:
        if (settings.values.preampManual) manual({ ...settings, values: { ...settings.values, preampManual: false } });
        break;
      case EqualizerSignalType.SelectPreset: {
        const values = equalizerPresetValues(signal.preset, settings.presets);
        manual({ ...settings, selectedPreset: values ? signal.preset : null, values: values ? copyValues(values) : settings.values });
        break;
      }
      case EqualizerSignalType.SavePreset:
      case EqualizerSignalType.RenamePreset:
      case EqualizerSignalType.DeletePreset: {
        const result =
          signal.type === EqualizerSignalType.SavePreset
            ? saveEqualizerPreset(settings.presets, signal.name, settings.values, { overwrite: signal.overwrite })
            : signal.type === EqualizerSignalType.RenamePreset
              ? renameEqualizerPreset(settings.presets, signal.from, signal.to)
              : deleteEqualizerPreset(settings.presets, signal.name);
        const name = signal.type === EqualizerSignalType.RenamePreset ? signal.to : signal.name;
        if (!result.ok) next = { ...next, notice: { rejection: result.rejection, name } };
        else {
          let selectedPreset = settings.selectedPreset;
          if (signal.type === EqualizerSignalType.SavePreset) selectedPreset = { kind: EqualizerPresetKind.Saved, name: signal.name.trim() };
          else if (
            selectedPreset?.kind === EqualizerPresetKind.Saved &&
            selectedPreset.name.trim() === (signal.type === EqualizerSignalType.RenamePreset ? signal.from : signal.name).trim()
          )
            selectedPreset = signal.type === EqualizerSignalType.RenamePreset ? { kind: EqualizerPresetKind.Saved, name: signal.to.trim() } : null;
          next = { ...next, settings: { ...settings, presets: result.presets, selectedPreset }, notice: null };
          save();
        }
        break;
      }
      case EqualizerSignalType.AiRequest:
        request(signal.prompt);
        break;
      case EqualizerSignalType.AiConsent:
        if (next.ai.phase !== EqualizerAiPhase.Consent) break;
        if (signal.send && next.pendingPrompt !== null) {
          const prompt = next.pendingPrompt;
          next = { ...next, settings: { ...settings, aiConsentAt: context.now }, ai: { phase: EqualizerAiPhase.Idle }, pendingPrompt: null };
          save();
          request(prompt);
        } else next = { ...next, ai: { phase: EqualizerAiPhase.Idle }, pendingPrompt: null };
        break;
      case EqualizerSignalType.AiCancel:
        if (next.ai.phase === EqualizerAiPhase.Running) {
          next = { ...next, ai: { phase: EqualizerAiPhase.Idle }, currentRequestId: null };
          effects.push({ type: EqualizerEffectType.CancelAi });
        }
        break;
      case EqualizerSignalType.AiUndo:
        if (next.undo) {
          next = { ...next, settings: { ...settings, values: copyValues(next.undo) }, undo: null, ai: { phase: EqualizerAiPhase.Idle } };
          save();
        }
        break;
      case EqualizerSignalType.AiDismiss:
        if (next.ai.phase === EqualizerAiPhase.NoKey || next.ai.phase === EqualizerAiPhase.Limited || next.ai.phase === EqualizerAiPhase.Failed)
          next = { ...next, ai: { phase: EqualizerAiPhase.Idle } };
        break;
      case EqualizerSignalType.DismissNotice:
        if (next.notice) next = { ...next, notice: null };
        break;
      case EqualizerSignalType.OpenSettings:
        effects.push({ type: EqualizerEffectType.OpenSettings });
        if (next.ai.phase === EqualizerAiPhase.NoKey) next = { ...next, ai: { phase: EqualizerAiPhase.Idle } };
        break;
    }
  }
  if (next !== model) effects.push({ type: EqualizerEffectType.SendState });
  return { model: next, effects };
}
