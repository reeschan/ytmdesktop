import { describe, expect, it } from "vitest";
import type { GroovingUsage } from "./index";
import {
  addGroovingUsage,
  estimateGroovingUsd,
  GROOVING_PRICES_AS_OF,
  GROOVING_PRICES_USD_PER_MTOK,
  GroovingUsageFeature,
  groovingMonth
} from "./usage";

describe("GROOVING_PRICES_USD_PER_MTOK", () => {
  it("has the three default models and a date", () => {
    expect(Object.keys(GROOVING_PRICES_USD_PER_MTOK).sort()).toEqual(["claude-haiku-5-5", "gemini-3.5-flash-lite", "gpt-6-luna"]);
    expect(GROOVING_PRICES_AS_OF).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("estimateGroovingUsd", () => {
  it.each([
    ["claude-haiku-5-5", 1_000_000, 1_000_000, 0.6],
    ["gemini-3.5-flash-lite", 1_000_000, 1_000_000, 2.8],
    ["gpt-6-luna", 1_000_000, 1_000_000, 0.6],
    ["gemini-3.5-flash-lite", 2_000_000, 0, 0.6],
    ["gemini-3.5-flash-lite", 0, 400_000, 1],
    ["claude-haiku-5-5", 12_345, 678, 0.0012345 + 0.000339]
  ])("prices %s for %i input and %i output tokens", (model, inputTokens, outputTokens, usd) => {
    expect(estimateGroovingUsd(model, inputTokens, outputTokens)).toBeCloseTo(usd, 10);
  });

  it("is 0 for no tokens", () => {
    expect(estimateGroovingUsd("claude-haiku-5-5", 0, 0)).toBe(0);
  });

  it.each(["claude-opus-5-5", "", "Claude-Haiku-5-5", "toString", "constructor", "__proto__"])("is null for a model not in the table (%j)", model => {
    expect(estimateGroovingUsd(model, 1_000_000, 1_000_000)).toBeNull();
  });
});

describe("addGroovingUsage", () => {
  it("creates a new usage when current is null", () => {
    expect(addGroovingUsage(null, { month: "2026-11", inputTokens: 100, outputTokens: 20, estimatedUsd: 0.5 })).toEqual({
      month: "2026-11",
      inputTokens: 100,
      outputTokens: 20,
      estimatedUsd: 0.5,
      unpricedTokens: 0
    });
  });

  it("creates a new usage with no cost when current is null and the cost is unknown", () => {
    expect(addGroovingUsage(null, { month: "2026-11", inputTokens: 100, outputTokens: 20, estimatedUsd: null })).toEqual({
      month: "2026-11",
      inputTokens: 100,
      outputTokens: 20,
      estimatedUsd: 0,
      unpricedTokens: 120
    });
  });

  it("adds within the same month", () => {
    const result = addGroovingUsage(
      { month: "2026-11", inputTokens: 1000, outputTokens: 200, estimatedUsd: 0.1, unpricedTokens: 0 },
      { month: "2026-11", inputTokens: 500, outputTokens: 50, estimatedUsd: 0.2 }
    );
    expect(result.month).toBe("2026-11");
    expect(result.inputTokens).toBe(1500);
    expect(result.outputTokens).toBe(250);
    expect(result.estimatedUsd).toBeCloseTo(0.3, 10);
  });

  it("starts from 0 when the month changed", () => {
    expect(
      addGroovingUsage(
        { month: "2026-10", inputTokens: 1000, outputTokens: 200, estimatedUsd: 0.1, unpricedTokens: 0 },
        { month: "2026-11", inputTokens: 500, outputTokens: 50, estimatedUsd: 0.2 }
      )
    ).toEqual({ month: "2026-11", inputTokens: 500, outputTokens: 50, estimatedUsd: 0.2, unpricedTokens: 0 });
  });

  it("starts from 0 with no cost when the month changed and the cost is unknown", () => {
    expect(
      addGroovingUsage(
        { month: "2026-10", inputTokens: 1000, outputTokens: 200, estimatedUsd: 0.1, unpricedTokens: 0 },
        { month: "2026-11", inputTokens: 500, outputTokens: 50, estimatedUsd: null }
      )
    ).toEqual({ month: "2026-11", inputTokens: 500, outputTokens: 50, estimatedUsd: 0, unpricedTokens: 550 });
  });

  it("adds the tokens but not the cost when the cost is unknown", () => {
    const result = addGroovingUsage(
      { month: "2026-11", inputTokens: 1000, outputTokens: 200, estimatedUsd: 0.1, unpricedTokens: 0 },
      { month: "2026-11", inputTokens: 500, outputTokens: 50, estimatedUsd: null }
    );
    expect(result.inputTokens).toBe(1500);
    expect(result.outputTokens).toBe(250);
    expect(result.estimatedUsd).toBeCloseTo(0.1, 10);
  });

  it("does not change current", () => {
    const current = { month: "2026-11", inputTokens: 1000, outputTokens: 200, estimatedUsd: 0.1, unpricedTokens: 0 };
    addGroovingUsage(current, { month: "2026-11", inputTokens: 500, outputTokens: 50, estimatedUsd: 0.2 });
    expect(current).toEqual({ month: "2026-11", inputTokens: 1000, outputTokens: 200, estimatedUsd: 0.1, unpricedTokens: 0 });
  });

  it("adds the input and output tokens of an unknown cost to unpricedTokens (unpriced)", () => {
    expect(addGroovingUsage(null, { month: "2026-11", inputTokens: 100, outputTokens: 20, estimatedUsd: null }).unpricedTokens).toBe(120);
  });

  it("does not change unpricedTokens when the cost is known (unpriced)", () => {
    const result = addGroovingUsage(
      { month: "2026-11", inputTokens: 1000, outputTokens: 200, estimatedUsd: 0.1, unpricedTokens: 300 },
      { month: "2026-11", inputTokens: 500, outputTokens: 50, estimatedUsd: 0.2 }
    );
    expect(result.unpricedTokens).toBe(300);
  });

  it("adds unpricedTokens within the same month (unpriced)", () => {
    const result = addGroovingUsage(
      { month: "2026-11", inputTokens: 1000, outputTokens: 200, estimatedUsd: 0.1, unpricedTokens: 300 },
      { month: "2026-11", inputTokens: 500, outputTokens: 50, estimatedUsd: null }
    );
    expect(result.unpricedTokens).toBe(850);
  });

  it("starts unpricedTokens from 0 when the month changed (unpriced)", () => {
    const result = addGroovingUsage(
      { month: "2026-10", inputTokens: 1000, outputTokens: 200, estimatedUsd: 0.1, unpricedTokens: 300 },
      { month: "2026-11", inputTokens: 500, outputTokens: 50, estimatedUsd: null }
    );
    expect(result.unpricedTokens).toBe(550);
  });

  it("counts a missing unpricedTokens of an old saved value as 0 (unpriced)", () => {
    const old = { month: "2026-11", inputTokens: 1000, outputTokens: 200, estimatedUsd: 0.1 } as unknown as GroovingUsage;
    expect(addGroovingUsage(old, { month: "2026-11", inputTokens: 500, outputTokens: 50, estimatedUsd: null })).toEqual({
      month: "2026-11",
      inputTokens: 1500,
      outputTokens: 250,
      estimatedUsd: 0.1,
      unpricedTokens: 550
    });
    expect(addGroovingUsage(old, { month: "2026-11", inputTokens: 500, outputTokens: 50, estimatedUsd: 0.2 }).unpricedTokens).toBe(0);
  });
});

describe("addGroovingUsage feature breakdown", () => {
  const old = { month: "2026-11", inputTokens: 100, outputTokens: 20, estimatedUsd: 1, unpricedTokens: 0 };
  const equalizer = { inputTokens: 30, outputTokens: 10, estimatedUsd: 0.5, unpricedTokens: 0 };

  it("adds equalizer usage to old totals and a new breakdown", () => {
    expect(
      addGroovingUsage(old, { month: old.month, inputTokens: 30, outputTokens: 10, estimatedUsd: 0.5, feature: GroovingUsageFeature.Equalizer })
    ).toEqual({
      month: old.month,
      inputTokens: 130,
      outputTokens: 30,
      estimatedUsd: 1.5,
      unpricedTokens: 0,
      equalizer
    });
  });

  it("preserves the breakdown for grooving usage, including the default feature", () => {
    const current = { ...old, equalizer };
    const add = { month: old.month, inputTokens: 10, outputTokens: 5, estimatedUsd: 0.25 };
    expect(addGroovingUsage(current, add).equalizer).toEqual(equalizer);
    expect(addGroovingUsage(current, { ...add, feature: GroovingUsageFeature.Grooving }).equalizer).toEqual(equalizer);
  });

  it("resets the breakdown when the month changes", () => {
    const current = { ...old, equalizer };
    expect(addGroovingUsage(current, { month: "2026-12", inputTokens: 2, outputTokens: 1, estimatedUsd: 0.1 }).equalizer).toBeUndefined();
    expect(
      addGroovingUsage(current, { month: "2026-12", inputTokens: 2, outputTokens: 1, estimatedUsd: 0.1, feature: GroovingUsageFeature.Equalizer })
        .equalizer
    ).toEqual({ inputTokens: 2, outputTokens: 1, estimatedUsd: 0.1, unpricedTokens: 0 });
  });

  it("adds unknown-cost equalizer tokens to both unpriced totals", () => {
    const result = addGroovingUsage(
      { ...old, equalizer },
      { month: old.month, inputTokens: 7, outputTokens: 3, estimatedUsd: null, feature: GroovingUsageFeature.Equalizer }
    );
    expect(result.unpricedTokens).toBe(10);
    expect(result.equalizer).toEqual({ inputTokens: 37, outputTokens: 13, estimatedUsd: 0.5, unpricedTokens: 10 });
  });
});

describe("groovingMonth", () => {
  it("returns the local year and the two-digit month (groovingMonth)", () => {
    expect(groovingMonth(new Date(2026, 0, 31, 23, 59))).toBe("2026-01");
    expect(groovingMonth(new Date(2026, 11, 1, 0, 0))).toBe("2026-12");
  });

  it("returns YYYY-MM for now when called with no argument (groovingMonth)", () => {
    expect(groovingMonth()).toMatch(/^\d{4}-\d{2}$/);
  });
});
