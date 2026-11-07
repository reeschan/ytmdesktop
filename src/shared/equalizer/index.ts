import type { GroovingDisplayLanguage } from "../grooving";

export const EQUALIZER_BAND_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const EQUALIZER_BAND_MIN_DB = -12;
export const EQUALIZER_BAND_MAX_DB = 12;
export const EQUALIZER_PREAMP_MIN_DB = -12;
export const EQUALIZER_PREAMP_MAX_DB = 12;
export const EQUALIZER_STEP_DB = 0.5;
export const EQUALIZER_PRESET_NAME_MAX = 30;
export const EQUALIZER_SAVED_PRESET_LIMIT = 50;
export const EQUALIZER_PROMPT_MAX = 200;

export type EqualizerValues = { bands: number[]; preamp: number; preampManual: boolean };
export const BundledEqualizerPresetId = {
  Flat: "flat",
  BassBoost: "bass-boost",
  TrebleBoost: "treble-boost",
  Vocal: "vocal",
  Rock: "rock",
  Electronic: "electronic",
  Night: "night"
} as const;
export type BundledEqualizerPresetId = (typeof BundledEqualizerPresetId)[keyof typeof BundledEqualizerPresetId];
export const EqualizerPresetKind = { Bundled: "bundled", Saved: "saved" } as const;
export type EqualizerPresetKind = (typeof EqualizerPresetKind)[keyof typeof EqualizerPresetKind];
export type EqualizerPresetRef =
  | { kind: typeof EqualizerPresetKind.Bundled; id: BundledEqualizerPresetId }
  | { kind: typeof EqualizerPresetKind.Saved; name: string };
export type EqualizerSavedPreset = { name: string; values: EqualizerValues };
export type EqualizerSettings = {
  enabled: boolean;
  values: EqualizerValues;
  selectedPreset: EqualizerPresetRef | null;
  presets: EqualizerSavedPreset[];
  aiConsentAt: string | null;
};
export const EqualizerPresetRejection = {
  EmptyName: "empty-name",
  NameTooLong: "name-too-long",
  BundledName: "bundled-name",
  Duplicate: "duplicate",
  Full: "full",
  NotFound: "not-found"
} as const;
export type EqualizerPresetRejection = (typeof EqualizerPresetRejection)[keyof typeof EqualizerPresetRejection];
export type EqualizerDisplayLanguage = GroovingDisplayLanguage;
