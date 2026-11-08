import {
  EQUALIZER_BAND_FREQUENCIES,
  EQUALIZER_BAND_MAX_DB,
  EQUALIZER_BAND_MIN_DB,
  EQUALIZER_PREAMP_MAX_DB,
  EQUALIZER_PREAMP_MIN_DB,
  EQUALIZER_STEP_DB,
  type EqualizerValues
} from "./index";

export const EQUALIZER_EXPLANATION_MAX = 120;

function normalizeValue(value: number, min: number, max: number, step: number): number {
  const rounded = Math.round(Math.max(min, Math.min(max, value)) / step) * step;
  return rounded === 0 ? 0 : rounded;
}

export function normalizeEqualizerAnswer(answer: {
  bands: unknown;
  preamp: unknown;
  explanation: unknown;
}): { ok: true; values: EqualizerValues; explanation: string } | { ok: false } {
  if (
    !Array.isArray(answer.bands) ||
    answer.bands.length !== EQUALIZER_BAND_FREQUENCIES.length ||
    !Array.from(answer.bands).every(value => typeof value === "number" && Number.isFinite(value)) ||
    typeof answer.preamp !== "number" ||
    !Number.isFinite(answer.preamp) ||
    typeof answer.explanation !== "string"
  )
    return { ok: false };

  return {
    ok: true,
    values: {
      bands: answer.bands.map(value => normalizeValue(value, EQUALIZER_BAND_MIN_DB, EQUALIZER_BAND_MAX_DB, EQUALIZER_STEP_DB)),
      preamp: normalizeValue(answer.preamp, EQUALIZER_PREAMP_MIN_DB, EQUALIZER_PREAMP_MAX_DB, EQUALIZER_STEP_DB),
      preampManual: true
    },
    explanation: answer.explanation.trim().slice(0, EQUALIZER_EXPLANATION_MAX)
  };
}
