import { describe, expect, it } from "vitest";
import { BundledEqualizerPresetId, EqualizerPresetKind, EqualizerPresetRejection, type EqualizerSettings } from "~shared/equalizer";
import { EqualizerAiPhase, EqualizerSignalType } from "~shared/equalizer/messages";
import { GroovingFailureReason, GroovingProvider } from "~shared/grooving";
import {
  EqualizerEffectType,
  EqualizerEventType,
  initialEqualizerModel,
  reduceEqualizer,
  toEqualizerViewState,
  type EqualizerEvent
} from "./effects";

const settings = (): EqualizerSettings => ({
  enabled: false,
  values: { bands: Array(10).fill(0), preamp: 0, preampManual: false },
  selectedPreset: { kind: EqualizerPresetKind.Bundled, id: BundledEqualizerPresetId.Flat },
  presets: [],
  aiConsentAt: null
});
const context = { hasKey: true, now: "2026-01-01" };
const signal = (value: Extract<EqualizerEvent, { type: typeof EqualizerEventType.Signal }>["signal"]): EqualizerEvent => ({
  type: EqualizerEventType.Signal,
  signal: value
});

describe("equalizer transitions", () => {
  it("changes controls and manages saved presets", () => {
    let model = initialEqualizerModel(settings());
    let result = reduceEqualizer(model, signal({ type: EqualizerSignalType.SetEnabled, enabled: true }), context);
    expect(result.model.settings.enabled).toBe(true);
    expect(result.effects).toContainEqual({ type: EqualizerEffectType.SaveSettings });
    model = reduceEqualizer(result.model, signal({ type: EqualizerSignalType.SetBand, index: 0, db: 6 }), context).model;
    expect(toEqualizerViewState(model, GroovingProvider.OpenAI).values.preamp).toBe(-6);
    model = reduceEqualizer(
      model,
      signal({ type: EqualizerSignalType.SelectPreset, preset: { kind: EqualizerPresetKind.Bundled, id: BundledEqualizerPresetId.Rock } }),
      context
    ).model;
    expect(model.settings.values.bands[0]).toBe(4);
    model = reduceEqualizer(model, signal({ type: EqualizerSignalType.SavePreset, name: " mine ", overwrite: false }), context).model;
    expect(model.settings.selectedPreset).toEqual({ kind: EqualizerPresetKind.Saved, name: "mine" });
    model = reduceEqualizer(model, signal({ type: EqualizerSignalType.SavePreset, name: "mine", overwrite: false }), context).model;
    expect(model.notice?.rejection).toBe(EqualizerPresetRejection.Duplicate);
    model = reduceEqualizer(model, signal({ type: EqualizerSignalType.DeletePreset, name: "mine" }), context).model;
    expect(model.settings.selectedPreset).toBeNull();
    expect(model.settings.presets).toEqual([]);
  });

  it("requires a key and consent and refuses a second request", () => {
    const initial = initialEqualizerModel(settings());
    expect(reduceEqualizer(initial, signal({ type: EqualizerSignalType.AiRequest, prompt: "x" }), { ...context, hasKey: false }).model.ai.phase).toBe(
      EqualizerAiPhase.NoKey
    );
    const consent = reduceEqualizer(initial, signal({ type: EqualizerSignalType.AiRequest, prompt: "x" }), context);
    expect(consent.model.ai.phase).toBe(EqualizerAiPhase.Consent);
    expect(consent.effects).not.toContainEqual(expect.objectContaining({ type: EqualizerEffectType.RequestAi }));
    const declined = reduceEqualizer(consent.model, signal({ type: EqualizerSignalType.AiConsent, send: false }), context);
    expect(declined.effects).toEqual([{ type: EqualizerEffectType.SendState }]);
    const running = reduceEqualizer(consent.model, signal({ type: EqualizerSignalType.AiConsent, send: true }), context);
    expect(running.effects).toContainEqual(expect.objectContaining({ type: EqualizerEffectType.RequestAi, prompt: "x" }));
    expect(reduceEqualizer(running.model, signal({ type: EqualizerSignalType.AiRequest, prompt: "again" }), context).effects).toEqual([]);
  });

  it("handles manual preamp, renamed presets and missing preset references", () => {
    let model = initialEqualizerModel(settings());
    model = reduceEqualizer(model, signal({ type: EqualizerSignalType.SetEnabled, enabled: true }), context).model;
    model = reduceEqualizer(model, signal({ type: EqualizerSignalType.SetEnabled, enabled: false }), context).model;
    expect(model.settings.enabled).toBe(false);
    model = reduceEqualizer(model, signal({ type: EqualizerSignalType.SetPreamp, db: 2 }), context).model;
    expect(toEqualizerViewState(model, GroovingProvider.OpenAI).values.preamp).toBe(2);
    model = reduceEqualizer(model, signal({ type: EqualizerSignalType.ResetPreamp }), context).model;
    expect(model.settings.values.preampManual).toBe(false);
    model = reduceEqualizer(model, signal({ type: EqualizerSignalType.SavePreset, name: "one", overwrite: false }), context).model;
    model = reduceEqualizer(model, signal({ type: EqualizerSignalType.RenamePreset, from: "one", to: "two" }), context).model;
    expect(model.settings.selectedPreset).toEqual({ kind: EqualizerPresetKind.Saved, name: "two" });
    const values = model.settings.values;
    model = reduceEqualizer(
      model,
      signal({ type: EqualizerSignalType.SelectPreset, preset: { kind: EqualizerPresetKind.Saved, name: "missing" } }),
      context
    ).model;
    expect(model.settings.selectedPreset).toBeNull();
    expect(model.settings.values).toEqual(values);
  });

  it("keeps a running request across settings changes and clips its prompt", () => {
    const initial = initialEqualizerModel({ ...settings(), aiConsentAt: context.now });
    const started = reduceEqualizer(initial, signal({ type: EqualizerSignalType.AiRequest, prompt: `  ${"a".repeat(210)}  ` }), context);
    expect(started.effects).toContainEqual(expect.objectContaining({ type: EqualizerEffectType.RequestAi, prompt: "a".repeat(200) }));
    const changed = reduceEqualizer(
      started.model,
      { type: EqualizerEventType.SettingsChanged, settings: { ...initial.settings, aiConsentAt: null } },
      context
    );
    expect(changed.model.currentRequestId).toBe(started.model.currentRequestId);
    expect(changed.model.ai.phase).toBe(EqualizerAiPhase.Running);
  });

  it("applies, undoes, rejects late results and preserves values on failure", () => {
    const initial = initialEqualizerModel({ ...settings(), aiConsentAt: context.now });
    const running = reduceEqualizer(initial, signal({ type: EqualizerSignalType.AiRequest, prompt: " test " }), context).model;
    const values = { ...initial.settings.values, bands: [3, ...Array(9).fill(0)] };
    const success: EqualizerEvent = {
      type: EqualizerEventType.AiResult,
      requestId: running.currentRequestId!,
      result: { ok: true, values, explanation: "ok" }
    };
    const applied = reduceEqualizer(running, success, context).model;
    expect(applied.settings.values).toEqual(values);
    expect(reduceEqualizer(applied, signal({ type: EqualizerSignalType.AiUndo }), context).model.settings.values).toEqual(initial.settings.values);
    expect(reduceEqualizer(applied, signal({ type: EqualizerSignalType.SetBand, index: 0, db: 4 }), context).model.undo).toBeNull();
    const cancelled = reduceEqualizer(running, signal({ type: EqualizerSignalType.AiCancel }), context).model;
    expect(reduceEqualizer(cancelled, success, context)).toEqual({ model: cancelled, effects: [] });
    for (const limitedByApp of [true, false]) {
      const failed = reduceEqualizer(
        running,
        {
          type: EqualizerEventType.AiResult,
          requestId: running.currentRequestId!,
          result: { ok: false, reason: GroovingFailureReason.Network, limitedByApp }
        },
        context
      ).model;
      expect(failed.settings.values).toEqual(initial.settings.values);
      expect(failed.ai.phase).toBe(limitedByApp ? EqualizerAiPhase.Limited : EqualizerAiPhase.Failed);
    }
  });
});
