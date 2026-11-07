import { describe, expect, it } from "vitest";
import { EQUALIZER_SPECTRUM_BAR_COUNT, equalizerSpectrumBars } from "./spectrum";

describe("equalizerSpectrumBars", () => {
  it.each([44100, 48000])("produces 48 bounded silent bars at %i Hz", sampleRate => {
    const bars = equalizerSpectrumBars(new Uint8Array(2048), sampleRate);
    expect(bars).toHaveLength(EQUALIZER_SPECTRUM_BAR_COUNT);
    expect(bars.every(value => value >= 0 && value <= 1)).toBe(true);
    expect(bars.every(value => value === 0)).toBe(true);
  });

  it.each([44100, 48000])("places a 1 kHz peak in its logarithmic bar at %i Hz", sampleRate => {
    const magnitudes = new Uint8Array(2048);
    const bin = Math.round((1000 * 2 * magnitudes.length) / sampleRate);
    magnitudes[bin] = 255;
    const bars = equalizerSpectrumBars(magnitudes, sampleRate);
    const frequency = (bin * sampleRate) / (2 * magnitudes.length);
    const bar = Math.floor((Math.log(frequency / 30) / Math.log(16000 / 30)) * 48);
    expect(bars[bar]).toBe(1);
    expect(Math.max(...bars)).toBe(1);
    expect(bars.every(value => value >= 0 && value <= 1)).toBe(true);
  });

  it("uses the closest bin for an empty range and accepts custom options", () => {
    expect(equalizerSpectrumBars([0, 128, 255, 0], 8000, { barCount: 2, minFrequency: 1100, maxFrequency: 1500 })).toEqual([128 / 255, 128 / 255]);
  });
});
