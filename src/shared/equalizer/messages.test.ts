import { describe, expect, it } from "vitest";
import { GroovingFailureReason, GroovingProvider } from "../grooving";
import { BundledEqualizerPresetId, EqualizerPresetKind, EqualizerPresetRejection } from "./index";
import {
  EqualizerAiPhase,
  EqualizerMessageOp,
  EqualizerSignalType as S,
  isEqualizerSignal,
  isEqualizerViewMessage,
  isEqualizerViewState
} from "./messages";

const values = { bands: Array(10).fill(0), preamp: 0, preampManual: false };
const preset = { kind: EqualizerPresetKind.Bundled, id: BundledEqualizerPresetId.Flat };
const state = {
  enabled: true,
  values,
  selectedPreset: null,
  presets: [],
  modified: false,
  ai: { phase: EqualizerAiPhase.Idle },
  provider: GroovingProvider.OpenAI,
  notice: null
};

describe("equalizer signals", () => {
  it.each([
    { type: S.SetEnabled, enabled: true },
    { type: S.SetBand, index: 0, db: -12 },
    { type: S.SetPreamp, db: 12 },
    { type: S.ResetPreamp },
    { type: S.SelectPreset, preset },
    { type: S.SavePreset, name: "name", overwrite: false },
    { type: S.RenamePreset, from: "a", to: "b" },
    { type: S.DeletePreset, name: "a" },
    { type: S.AiRequest, prompt: "hello" },
    { type: S.AiCancel },
    { type: S.AiUndo },
    { type: S.AiConsent, send: true },
    { type: S.AiDismiss },
    { type: S.DismissNotice },
    { type: S.OpenSettings }
  ])("accepts $type", signal => expect(isEqualizerSignal(signal)).toBe(true));

  it.each([
    null,
    1,
    [],
    { type: "unknown" },
    ...[10, -1, 1.5, NaN, "3"].map(index => ({ type: S.SetBand, index, db: 0 })),
    ...[13, NaN, Infinity].map(db => ({ type: S.SetBand, index: 0, db })),
    { type: S.AiRequest, prompt: "x".repeat(2001) },
    { type: S.SelectPreset, preset: { kind: "unknown" } },
    { type: S.SelectPreset, preset: { ...preset, id: "nope" } },
    { type: S.AiConsent, send: "true" }
  ])("rejects invalid input %#", input => expect(isEqualizerSignal(input)).toBe(false));
});

describe("equalizer view state", () => {
  it("accepts a state and its message envelope", () => {
    expect(isEqualizerViewState(state)).toBe(true);
    expect(isEqualizerViewMessage({ op: EqualizerMessageOp.State, state })).toBe(true);
    expect(isEqualizerViewMessage({ op: EqualizerMessageOp.Signal, state })).toBe(false);
  });
  it.each(["", "   ", "x".repeat(31), "x".repeat(200)])("accepts notice name %s", name => {
    expect(isEqualizerViewState({ ...state, notice: { rejection: EqualizerPresetRejection.EmptyName, name } })).toBe(true);
  });
  it("accepts empty explanation and over 50 saved presets", () => {
    expect(
      isEqualizerViewState({
        ...state,
        ai: { phase: EqualizerAiPhase.Applied, explanation: "", canUndo: true },
        presets: Array(51).fill({ name: "x", values })
      })
    ).toBe(true);
  });
  it.each(Object.values(GroovingFailureReason))("accepts failure reason %s", reason => {
    expect(isEqualizerViewState({ ...state, ai: { phase: EqualizerAiPhase.Failed, reason } })).toBe(true);
  });
  it.each(Object.values(GroovingProvider))("accepts provider %s", provider => expect(isEqualizerViewState({ ...state, provider })).toBe(true));
  it.each([
    null,
    1,
    [],
    { ...state, ai: { phase: EqualizerAiPhase.Applied, canUndo: true } },
    { ...state, ai: { phase: EqualizerAiPhase.Applied, explanation: 1, canUndo: true } },
    { ...state, ai: { phase: EqualizerAiPhase.Failed, reason: "unknown" } },
    { ...state, values: { ...values, bands: Array(9).fill(0) } },
    { ...state, values: { ...values, preamp: Infinity } }
  ])("rejects invalid input %#", input => expect(isEqualizerViewState(input)).toBe(false));
});
