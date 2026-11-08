import { describe, expect, it } from "vitest";
import { EQUALIZER_BAND_FREQUENCIES, type EqualizerValues } from "./index";
import { EQUALIZER_PEAKING_Q, EqualizerFilterType, equalizerFilterPlan } from "./filters";

describe("equalizerFilterPlan", () => {
  const values: EqualizerValues = { bands: [6, 5, 4, 3, 2, 1, 0, -1, -2, -3], preamp: 3, preampManual: false };

  it("plans ten filters with the band frequencies and gains", () => {
    const plan = equalizerFilterPlan(true, values);
    expect(plan.filters.map(filter => filter.type)).toEqual([
      EqualizerFilterType.LowShelf,
      ...Array(8).fill(EqualizerFilterType.Peaking),
      EqualizerFilterType.HighShelf
    ]);
    expect(plan.filters.map(filter => filter.frequency)).toEqual(EQUALIZER_BAND_FREQUENCIES);
    expect(plan.filters.map(filter => filter.gainDb)).toEqual(values.bands);
    expect(plan.filters.every(filter => filter.q === EQUALIZER_PEAKING_Q)).toBe(true);
    expect(plan.preampGain).toBeCloseTo(0.501, 3);
  });

  it("bypasses all gains when disabled", () => {
    const plan = equalizerFilterPlan(false, values);
    expect(plan.filters.map(filter => filter.gainDb)).toEqual(Array(10).fill(0));
    expect(plan.preampGain).toBe(1);
  });

  it("uses the manual preamp when selected", () => {
    expect(equalizerFilterPlan(true, { ...values, preampManual: true }).preampGain).toBeCloseTo(10 ** (3 / 20));
  });
});
