import { describe, expect, it } from "vitest";
import { BundledEqualizerPresetId, EqualizerPresetKind, EqualizerPresetRejection, EqualizerValues } from "./index";
import {
  BUNDLED_EQUALIZER_PRESETS,
  deleteEqualizerPreset,
  effectiveEqualizerPreamp,
  equalizerPresetValues,
  isEqualizerModified,
  renameEqualizerPreset,
  saveEqualizerPreset
} from "./presets";

const values = (bands = Array<number>(10).fill(0), preamp = 0, preampManual = false): EqualizerValues => ({ bands, preamp, preampManual });
const saved = [
  { name: "One", values: values() },
  { name: "Two", values: values(Array<number>(10).fill(1)) }
];
const ref = { kind: EqualizerPresetKind.Saved, name: "One" } as const;

describe("equalizer presets", () => {
  it.each([
    [values([6, 0]), -6],
    [values([0, -2]), 0],
    [values([6], 3, true), 3]
  ])("computes the effective preamp", (input, expected) => {
    expect(effectiveEqualizerPreamp(input)).toBe(expected);
  });

  it("contains seven bounded ten-band presets", () => {
    expect(BUNDLED_EQUALIZER_PRESETS).toHaveLength(7);
    for (const preset of BUNDLED_EQUALIZER_PRESETS) {
      expect(preset.values.bands).toHaveLength(10);
      expect(preset.values.bands.every(db => db >= -12 && db <= 12)).toBe(true);
      expect(preset.values.preamp).toBe(0);
      expect(preset.values.preampManual).toBe(false);
    }
  });

  it.each([
    [" ", [], EqualizerPresetRejection.EmptyName],
    ["x".repeat(31), [], EqualizerPresetRejection.NameTooLong],
    ["ボーカル", [], EqualizerPresetRejection.BundledName],
    [" Vocal ", [], EqualizerPresetRejection.BundledName],
    [" One ", saved, EqualizerPresetRejection.Duplicate],
    ["New", Array.from({ length: 50 }, (_, i) => ({ name: `${i}`, values: values() })), EqualizerPresetRejection.Full]
  ])("rejects invalid saves: %s", (name, presets, rejection) => {
    expect(saveEqualizerPreset(presets, name, values(), { overwrite: false })).toEqual({ ok: false, rejection });
  });

  it("trims names and preserves positions when overwriting, renaming and deleting", () => {
    const original = structuredClone(saved);
    const replacement = values(Array<number>(10).fill(2));
    expect(saveEqualizerPreset(saved, " One ", replacement, { overwrite: true })).toEqual({
      ok: true,
      presets: [{ name: "One", values: replacement }, saved[1]]
    });
    expect(saveEqualizerPreset(saved, " Three ", replacement, { overwrite: false })).toEqual({
      ok: true,
      presets: [...saved, { name: "Three", values: replacement }]
    });
    expect(renameEqualizerPreset(saved, " One ", " New ")).toEqual({ ok: true, presets: [{ ...saved[0], name: "New" }, saved[1]] });
    expect(renameEqualizerPreset(saved, "One", " Two ")).toEqual({ ok: false, rejection: EqualizerPresetRejection.Duplicate });
    expect(deleteEqualizerPreset(saved, " Two ")).toEqual({ ok: true, presets: [saved[0]] });
    expect(deleteEqualizerPreset(saved, "missing")).toEqual({ ok: false, rejection: EqualizerPresetRejection.NotFound });
    expect(renameEqualizerPreset(saved, "missing", "New")).toEqual({ ok: false, rejection: EqualizerPresetRejection.NotFound });
    expect(saved).toEqual(original);
  });

  it("resolves references and compares values", () => {
    expect(equalizerPresetValues(ref, saved)).toEqual(saved[0].values);
    expect(equalizerPresetValues({ kind: EqualizerPresetKind.Bundled, id: BundledEqualizerPresetId.Flat }, saved)).toEqual(values());
    expect(equalizerPresetValues({ kind: EqualizerPresetKind.Saved, name: "missing" }, saved)).toBeNull();
    expect(isEqualizerModified(values(), ref, saved)).toBe(false);
    expect(isEqualizerModified(values([1, ...Array<number>(9).fill(0)]), ref, saved)).toBe(true);
    expect(isEqualizerModified(values(), null, saved)).toBe(false);
    expect(isEqualizerModified(values(undefined, 4), ref, saved)).toBe(false);
    expect(isEqualizerModified(values(undefined, 0, true), ref, saved)).toBe(true);
  });
});
