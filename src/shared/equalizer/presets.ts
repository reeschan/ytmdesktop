import {
  BundledEqualizerPresetId,
  EQUALIZER_PRESET_NAME_MAX,
  EQUALIZER_SAVED_PRESET_LIMIT,
  EqualizerDisplayLanguage,
  EqualizerPresetKind,
  EqualizerPresetRef,
  EqualizerPresetRejection,
  EqualizerSavedPreset,
  EqualizerValues
} from "./index";

export type BundledEqualizerPreset = { id: BundledEqualizerPresetId; name: Record<EqualizerDisplayLanguage, string>; values: EqualizerValues };
const preset = (id: BundledEqualizerPresetId, ja: string, en: string, bands: number[]): BundledEqualizerPreset => ({
  id,
  name: { ja, en },
  values: { bands, preamp: 0, preampManual: false }
});
export const BUNDLED_EQUALIZER_PRESETS: BundledEqualizerPreset[] = [
  preset(BundledEqualizerPresetId.Flat, "フラット", "Flat", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  preset(BundledEqualizerPresetId.BassBoost, "低音を強く", "Bass boost", [6, 5, 4, 2, 0, 0, 0, 0, 0, 0]),
  preset(BundledEqualizerPresetId.TrebleBoost, "高音を強く", "Treble boost", [0, 0, 0, 0, 0, 1, 2, 4, 5, 6]),
  preset(BundledEqualizerPresetId.Vocal, "ボーカル", "Vocal", [-2, -2, -1, 0, 2, 4, 4, 2, 0, -1]),
  preset(BundledEqualizerPresetId.Rock, "ロック", "Rock", [4, 3, 2, 0, -1, -1, 1, 3, 4, 4]),
  preset(BundledEqualizerPresetId.Electronic, "エレクトロニック", "Electronic", [5, 4, 2, 0, -1, 0, 1, 2, 4, 5]),
  preset(BundledEqualizerPresetId.Night, "夜", "Night", [4, 3, 1, 0, 0, 0, 0, 1, 3, 4])
];

export function effectiveEqualizerPreamp(values: EqualizerValues): number {
  if (values.preampManual) return values.preamp;
  const maximum = Math.max(0, ...values.bands);
  return maximum > 0 ? -maximum : 0;
}

export function equalizerPresetValues(ref: EqualizerPresetRef, saved: EqualizerSavedPreset[]): EqualizerValues | null {
  return (
    (ref.kind === EqualizerPresetKind.Bundled ? BUNDLED_EQUALIZER_PRESETS.find(p => p.id === ref.id) : saved.find(p => p.name === ref.name))
      ?.values ?? null
  );
}

export function isEqualizerModified(values: EqualizerValues, ref: EqualizerPresetRef | null, saved: EqualizerSavedPreset[]): boolean {
  if (ref === null) return false;
  const original = equalizerPresetValues(ref, saved);
  if (original === null) return false;
  return (
    values.preampManual !== original.preampManual ||
    (values.preampManual && values.preamp !== original.preamp) ||
    values.bands.length !== original.bands.length ||
    values.bands.some((db, i) => db !== original.bands[i])
  );
}

export type EqualizerPresetResult = { ok: true; presets: EqualizerSavedPreset[] } | { ok: false; rejection: EqualizerPresetRejection };
function validateName(name: string, max: number): EqualizerPresetRejection | null {
  if (!name) return EqualizerPresetRejection.EmptyName;
  if (name.length > max) return EqualizerPresetRejection.NameTooLong;
  if (BUNDLED_EQUALIZER_PRESETS.some(p => Object.values(p.name).includes(name))) return EqualizerPresetRejection.BundledName;
  return null;
}
export function saveEqualizerPreset(
  presets: EqualizerSavedPreset[],
  name: string,
  values: EqualizerValues,
  options: { overwrite: boolean },
  maxName = EQUALIZER_PRESET_NAME_MAX,
  limit = EQUALIZER_SAVED_PRESET_LIMIT
): EqualizerPresetResult {
  const trimmed = name.trim();
  const rejection = validateName(trimmed, maxName);
  if (rejection) return { ok: false, rejection };
  const index = presets.findIndex(p => p.name.trim() === trimmed);
  if (index >= 0 && !options.overwrite) return { ok: false, rejection: EqualizerPresetRejection.Duplicate };
  if (index < 0 && presets.length >= limit) return { ok: false, rejection: EqualizerPresetRejection.Full };
  const result = [...presets];
  const entry = { name: trimmed, values: { ...values, bands: [...values.bands] } };
  if (index >= 0) result[index] = entry;
  else result.push(entry);
  return { ok: true, presets: result };
}
export function renameEqualizerPreset(
  presets: EqualizerSavedPreset[],
  from: string,
  to: string,
  maxName = EQUALIZER_PRESET_NAME_MAX
): EqualizerPresetResult {
  const index = presets.findIndex(p => p.name.trim() === from.trim());
  if (index < 0) return { ok: false, rejection: EqualizerPresetRejection.NotFound };
  const name = to.trim();
  const rejection = validateName(name, maxName);
  if (rejection) return { ok: false, rejection };
  if (presets.some((p, i) => i !== index && p.name.trim() === name)) return { ok: false, rejection: EqualizerPresetRejection.Duplicate };
  return { ok: true, presets: presets.map((p, i) => (i === index ? { ...p, name } : p)) };
}
export function deleteEqualizerPreset(presets: EqualizerSavedPreset[], name: string): EqualizerPresetResult {
  const index = presets.findIndex(p => p.name.trim() === name.trim());
  if (index < 0) return { ok: false, rejection: EqualizerPresetRejection.NotFound };
  return { ok: true, presets: presets.filter((_, i) => i !== index) };
}
