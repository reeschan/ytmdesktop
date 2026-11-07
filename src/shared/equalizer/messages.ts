import { GroovingFailureReason, GroovingProvider } from "../grooving";
import {
  BundledEqualizerPresetId,
  EQUALIZER_BAND_FREQUENCIES,
  EQUALIZER_BAND_MAX_DB,
  EQUALIZER_BAND_MIN_DB,
  EQUALIZER_PREAMP_MAX_DB,
  EQUALIZER_PREAMP_MIN_DB,
  EqualizerPresetKind,
  EqualizerPresetRejection,
  type EqualizerPresetRef,
  type EqualizerSavedPreset,
  type EqualizerValues
} from "./index";

export const EqualizerIpc = { State: "equalizer:state", Signal: "equalizer:signal" } as const;
export type EqualizerIpc = (typeof EqualizerIpc)[keyof typeof EqualizerIpc];
export const EqualizerMessageOp = { State: "ytmd-equalizer-state", Signal: "ytmd-equalizer-signal", Ready: "ytmd-equalizer-ready" } as const;
export type EqualizerMessageOp = (typeof EqualizerMessageOp)[keyof typeof EqualizerMessageOp];
export const EqualizerAiPhase = {
  Idle: "idle",
  NoKey: "no-key",
  Consent: "consent",
  Running: "running",
  Applied: "applied",
  Failed: "failed",
  Limited: "limited"
} as const;
export type EqualizerAiPhase = (typeof EqualizerAiPhase)[keyof typeof EqualizerAiPhase];
export type EqualizerAiState =
  | {
      phase:
        | typeof EqualizerAiPhase.Idle
        | typeof EqualizerAiPhase.NoKey
        | typeof EqualizerAiPhase.Consent
        | typeof EqualizerAiPhase.Running
        | typeof EqualizerAiPhase.Limited;
    }
  | { phase: typeof EqualizerAiPhase.Applied; explanation: string; canUndo: boolean }
  | { phase: typeof EqualizerAiPhase.Failed; reason: GroovingFailureReason };
export type EqualizerViewState = {
  enabled: boolean;
  values: EqualizerValues;
  selectedPreset: EqualizerPresetRef | null;
  presets: EqualizerSavedPreset[];
  modified: boolean;
  ai: EqualizerAiState;
  provider: GroovingProvider;
  notice: { rejection: EqualizerPresetRejection; name: string } | null;
};
export const EqualizerSignalType = {
  SetEnabled: "set-enabled",
  SetBand: "set-band",
  SetPreamp: "set-preamp",
  ResetPreamp: "reset-preamp",
  SelectPreset: "select-preset",
  SavePreset: "save-preset",
  RenamePreset: "rename-preset",
  DeletePreset: "delete-preset",
  AiRequest: "ai-request",
  AiCancel: "ai-cancel",
  AiUndo: "ai-undo",
  AiConsent: "ai-consent",
  AiDismiss: "ai-dismiss",
  DismissNotice: "dismiss-notice",
  OpenSettings: "open-settings"
} as const;
export type EqualizerSignalType = (typeof EqualizerSignalType)[keyof typeof EqualizerSignalType];
export type EqualizerSignal =
  | { type: typeof EqualizerSignalType.SetEnabled; enabled: boolean }
  | { type: typeof EqualizerSignalType.SetBand; index: number; db: number }
  | { type: typeof EqualizerSignalType.SetPreamp; db: number }
  | { type: typeof EqualizerSignalType.SelectPreset; preset: EqualizerPresetRef }
  | { type: typeof EqualizerSignalType.SavePreset; name: string; overwrite: boolean }
  | { type: typeof EqualizerSignalType.RenamePreset; from: string; to: string }
  | { type: typeof EqualizerSignalType.DeletePreset; name: string }
  | { type: typeof EqualizerSignalType.AiRequest; prompt: string }
  | { type: typeof EqualizerSignalType.AiConsent; send: boolean }
  | {
      type:
        | typeof EqualizerSignalType.ResetPreamp
        | typeof EqualizerSignalType.AiCancel
        | typeof EqualizerSignalType.AiUndo
        | typeof EqualizerSignalType.AiDismiss
        | typeof EqualizerSignalType.DismissNotice
        | typeof EqualizerSignalType.OpenSettings;
    };
export type EqualizerViewMessage = { op: typeof EqualizerMessageOp.State; state: EqualizerViewState };

const NAME_MAX = 200;
const TEXT_MAX = 2000;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isOneOf = <T extends string>(options: Record<string, T>, value: unknown): value is T => (Object.values(options) as unknown[]).includes(value);
const isStringWithin = (value: unknown, max: number): value is string => typeof value === "string" && value.length <= max;
const isInRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

export function isEqualizerPresetRef(value: unknown): value is EqualizerPresetRef {
  if (!isRecord(value)) return false;
  switch (value.kind) {
    case EqualizerPresetKind.Bundled:
      return isOneOf(BundledEqualizerPresetId, value.id);
    case EqualizerPresetKind.Saved:
      return isStringWithin(value.name, NAME_MAX);
    default:
      return false;
  }
}
export function isEqualizerValues(value: unknown): value is EqualizerValues {
  return (
    isRecord(value) &&
    Array.isArray(value.bands) &&
    value.bands.length === EQUALIZER_BAND_FREQUENCIES.length &&
    Array.from(value.bands).every(db => isInRange(db, EQUALIZER_BAND_MIN_DB, EQUALIZER_BAND_MAX_DB)) &&
    isInRange(value.preamp, EQUALIZER_PREAMP_MIN_DB, EQUALIZER_PREAMP_MAX_DB) &&
    typeof value.preampManual === "boolean"
  );
}
export function isEqualizerSavedPreset(value: unknown): value is EqualizerSavedPreset {
  return isRecord(value) && isStringWithin(value.name, NAME_MAX) && isEqualizerValues(value.values);
}
function isAiState(value: unknown): value is EqualizerAiState {
  if (!isRecord(value) || !isOneOf(EqualizerAiPhase, value.phase)) return false;
  switch (value.phase) {
    case EqualizerAiPhase.Applied:
      return isStringWithin(value.explanation, TEXT_MAX) && typeof value.canUndo === "boolean";
    case EqualizerAiPhase.Failed:
      return isOneOf(GroovingFailureReason, value.reason);
    default:
      return true;
  }
}
export function isEqualizerViewState(value: unknown): value is EqualizerViewState {
  return (
    isRecord(value) &&
    typeof value.enabled === "boolean" &&
    isEqualizerValues(value.values) &&
    (value.selectedPreset === null || isEqualizerPresetRef(value.selectedPreset)) &&
    Array.isArray(value.presets) &&
    Array.from(value.presets).every(isEqualizerSavedPreset) &&
    typeof value.modified === "boolean" &&
    isAiState(value.ai) &&
    isOneOf(GroovingProvider, value.provider) &&
    (value.notice === null ||
      (isRecord(value.notice) && isOneOf(EqualizerPresetRejection, value.notice.rejection) && isStringWithin(value.notice.name, NAME_MAX)))
  );
}
export function isEqualizerViewMessage(value: unknown): value is EqualizerViewMessage {
  return isRecord(value) && value.op === EqualizerMessageOp.State && isEqualizerViewState(value.state);
}
export function isEqualizerSignal(value: unknown): value is EqualizerSignal {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case EqualizerSignalType.SetEnabled:
      return typeof value.enabled === "boolean";
    case EqualizerSignalType.SetBand:
      return (
        isInRange(value.index, 0, EQUALIZER_BAND_FREQUENCIES.length - 1) &&
        Number.isInteger(value.index) &&
        isInRange(value.db, EQUALIZER_BAND_MIN_DB, EQUALIZER_BAND_MAX_DB)
      );
    case EqualizerSignalType.SetPreamp:
      return isInRange(value.db, EQUALIZER_PREAMP_MIN_DB, EQUALIZER_PREAMP_MAX_DB);
    case EqualizerSignalType.SelectPreset:
      return isEqualizerPresetRef(value.preset);
    case EqualizerSignalType.SavePreset:
      return isStringWithin(value.name, NAME_MAX) && typeof value.overwrite === "boolean";
    case EqualizerSignalType.RenamePreset:
      return isStringWithin(value.from, NAME_MAX) && isStringWithin(value.to, NAME_MAX);
    case EqualizerSignalType.DeletePreset:
      return isStringWithin(value.name, NAME_MAX);
    case EqualizerSignalType.AiRequest:
      return isStringWithin(value.prompt, TEXT_MAX);
    case EqualizerSignalType.AiConsent:
      return typeof value.send === "boolean";
    case EqualizerSignalType.ResetPreamp:
    case EqualizerSignalType.AiCancel:
    case EqualizerSignalType.AiUndo:
    case EqualizerSignalType.AiDismiss:
    case EqualizerSignalType.DismissNotice:
    case EqualizerSignalType.OpenSettings:
      return true;
    default:
      return false;
  }
}
