import { EQUALIZER_BAND_FREQUENCIES, type EqualizerValues } from "./index";
import { effectiveEqualizerPreamp } from "./presets";

export const EQUALIZER_PEAKING_Q = 1.41;
export const EqualizerFilterType = { LowShelf: "lowshelf", Peaking: "peaking", HighShelf: "highshelf" } as const;
export type EqualizerFilterType = (typeof EqualizerFilterType)[keyof typeof EqualizerFilterType];

export function equalizerFilterPlan(enabled: boolean, values: EqualizerValues) {
  return {
    preampGain: enabled ? 10 ** (effectiveEqualizerPreamp(values) / 20) : 1,
    filters: EQUALIZER_BAND_FREQUENCIES.map((frequency, index) => ({
      type:
        index === 0
          ? EqualizerFilterType.LowShelf
          : index === EQUALIZER_BAND_FREQUENCIES.length - 1
            ? EqualizerFilterType.HighShelf
            : EqualizerFilterType.Peaking,
      frequency,
      q: EQUALIZER_PEAKING_Q,
      gainDb: enabled ? values.bands[index] : 0
    }))
  };
}
