// Token counts and cost estimates for Grooving (one run and this month)

import type { GroovingUsage, GroovingUsageAmounts } from "./index";

export const GroovingUsageFeature = {
  Grooving: "grooving",
  Equalizer: "equalizer"
} as const;
export type GroovingUsageFeature = (typeof GroovingUsageFeature)[keyof typeof GroovingUsageFeature];

// USD per 1,000,000 tokens, as of 2026-11-03.
// These are third-party aggregated values; check them again against each provider's official pricing page.
export const GROOVING_PRICES_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  "gemini-3.5-flash-lite": { input: 0.3, output: 2.5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "gpt-6-luna": { input: 0.1, output: 0.5 }
};
export const GROOVING_PRICES_AS_OF = "2026-11-03";

const TOKENS_PER_PRICE_UNIT = 1_000_000;

// null when the model is not in the table (a model the user typed in)
export function estimateGroovingUsd(model: string, inputTokens: number, outputTokens: number): number | null {
  if (!Object.hasOwn(GROOVING_PRICES_USD_PER_MTOK, model)) return null;
  const price = GROOVING_PRICES_USD_PER_MTOK[model];
  return (inputTokens * price.input + outputTokens * price.output) / TOKENS_PER_PRICE_UNIT;
}

// YYYY-MM in the user's local time
export function groovingMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Starts from 0 when the month differs. An unknown (null) cost adds no cost, and adds its input and output tokens to unpricedTokens.
// A current saved before unpricedTokens was added counts it as 0
export function addGroovingUsage(
  current: GroovingUsage | null,
  add: { month: string; inputTokens: number; outputTokens: number; estimatedUsd: number | null; feature?: GroovingUsageFeature }
): GroovingUsage {
  const base =
    current !== null && current.month === add.month
      ? { ...current, unpricedTokens: current.unpricedTokens ?? 0 }
      : { inputTokens: 0, outputTokens: 0, estimatedUsd: 0, unpricedTokens: 0 };
  const sum = (base: GroovingUsageAmounts): GroovingUsageAmounts => ({
    inputTokens: base.inputTokens + add.inputTokens,
    outputTokens: base.outputTokens + add.outputTokens,
    estimatedUsd: base.estimatedUsd + (add.estimatedUsd ?? 0),
    unpricedTokens: base.unpricedTokens + (add.estimatedUsd === null ? add.inputTokens + add.outputTokens : 0)
  });
  const equalizer = "equalizer" in base ? base.equalizer : undefined;
  return {
    month: add.month,
    ...sum(base),
    ...(add.feature === GroovingUsageFeature.Equalizer
      ? { equalizer: sum(equalizer ?? { inputTokens: 0, outputTokens: 0, estimatedUsd: 0, unpricedTokens: 0 }) }
      : equalizer === undefined
        ? {}
        : { equalizer })
  };
}
