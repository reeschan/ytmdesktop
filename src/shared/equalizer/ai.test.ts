import { describe, expect, it } from "vitest";
import { EQUALIZER_EXPLANATION_MAX, normalizeEqualizerAnswer } from "./ai";

const answer = () => ({ bands: Array<number>(10).fill(0), preamp: 0, explanation: "  clear  " });

describe("normalizeEqualizerAnswer", () => {
  it("accepts a valid answer and trims its explanation", () => {
    expect(normalizeEqualizerAnswer(answer())).toEqual({
      ok: true,
      values: { bands: Array<number>(10).fill(0), preamp: 0, preampManual: true },
      explanation: "clear"
    });
  });

  it("clamps and rounds values without negative zero", () => {
    const input = answer();
    input.bands.splice(0, 5, 20, -30, 1.26, 1.24, -0.01);
    input.preamp = -30;
    const result = normalizeEqualizerAnswer(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.bands.slice(0, 5)).toEqual([12, -12, 1.5, 1, 0]);
      expect(Object.is(result.values.bands[4], -0)).toBe(false);
      expect(result.values.preamp).toBe(-12);
    }
    expect(normalizeEqualizerAnswer({ ...answer(), preamp: 20 })).toMatchObject({ values: { preamp: 12 } });
  });

  it.each([Array(9).fill(0), Array(11).fill(0), [...Array(9).fill(0), NaN], [...Array(9).fill(0), Infinity], [...Array(9).fill(0), "1"], Array(10)])(
    "rejects invalid bands",
    bands => {
      expect(normalizeEqualizerAnswer({ ...answer(), bands })).toEqual({ ok: false });
    }
  );

  it.each([NaN, Infinity, "1"])("rejects invalid preamp %s", preamp => {
    expect(normalizeEqualizerAnswer({ ...answer(), preamp })).toEqual({ ok: false });
  });

  it("rejects a missing explanation and truncates a long one", () => {
    expect(normalizeEqualizerAnswer({ ...answer(), explanation: undefined })).toEqual({ ok: false });
    expect(normalizeEqualizerAnswer({ ...answer(), explanation: "x".repeat(121) })).toMatchObject({
      explanation: "x".repeat(EQUALIZER_EXPLANATION_MAX)
    });
  });
});
