export const EQUALIZER_SPECTRUM_BAR_COUNT = 48;
export const EQUALIZER_SPECTRUM_MIN_FREQUENCY = 30;
export const EQUALIZER_SPECTRUM_MAX_FREQUENCY = 16000;

export function equalizerSpectrumBars(
  magnitudes: ArrayLike<number>,
  sampleRate: number,
  options: { barCount?: number; minFrequency?: number; maxFrequency?: number } = {}
): number[] {
  const {
    barCount = EQUALIZER_SPECTRUM_BAR_COUNT,
    minFrequency = EQUALIZER_SPECTRUM_MIN_FREQUENCY,
    maxFrequency = EQUALIZER_SPECTRUM_MAX_FREQUENCY
  } = options;
  const bars: number[] = [];
  const binWidth = sampleRate / (2 * magnitudes.length);
  const ratio = maxFrequency / minFrequency;
  for (let bar = 0; bar < barCount; bar++) {
    const lower = minFrequency * ratio ** (bar / barCount);
    const upper = minFrequency * ratio ** ((bar + 1) / barCount);
    const start = Math.max(0, Math.ceil(lower / binWidth));
    const end = Math.min(magnitudes.length, Math.ceil(upper / binWidth));
    let maximum = 0;
    for (let bin = start; bin < end; bin++) maximum = Math.max(maximum, magnitudes[bin]);
    if (start >= end && magnitudes.length > 0) {
      const nearest = Math.max(0, Math.min(magnitudes.length - 1, Math.round(Math.sqrt(lower * upper) / binWidth)));
      maximum = magnitudes[nearest];
    }
    bars.push(maximum / 255);
  }
  return bars;
}
