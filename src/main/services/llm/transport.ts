// LLM calls through the AI SDK with zod structured output.
// Pure transport: never throws, never logs, and does not import electron, electron-log or the config store.
// Only the failure reason leaves this module (never the raw error: APICallError carries the prompt).
// Loaded lazily (dynamic import) so the AI SDK does not slow the start; do not import it from a module loaded at startup.
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import {
  APICallError,
  generateText,
  JSONParseError,
  LanguageModel,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  Output,
  RetryError,
  TypeValidationError
} from "ai";
import type { z } from "zod";
import { GroovingFailureReason, GroovingProvider } from "~shared/grooving";
import type { LlmConfig } from "./config";

export const LlmFailureKind = {
  Unusable: "unusable",
  Failed: "failed"
} as const;
export type LlmFailureKind = (typeof LlmFailureKind)[keyof typeof LlmFailureKind];

export type LlmUsage = { inputTokens: number; outputTokens: number };
export type LlmResult<T> =
  | { ok: true; value: T; usage: LlmUsage }
  | { ok: false; kind: LlmFailureKind; reason: GroovingFailureReason; usage: LlmUsage };
// signal stops the call midway (for example when the screen closes), model replaces the model made from the provider (for example a fake model for tests)
export type LlmOptions = { signal?: AbortSignal; model?: LanguageModel };
export type LlmPrompt = { system: string; prompt: string };

// The official endpoints, set explicitly so that ANTHROPIC_BASE_URL / OPENAI_BASE_URL cannot send the key elsewhere.
// Always a provider instance: a plain model id string would go to the AI SDK's default provider (the Vercel gateway)
const PROVIDER_MODELS: Record<GroovingProvider, (apiKey: string, model: string) => LanguageModel> = {
  [GroovingProvider.Gemini]: (apiKey, model) =>
    createGoogleGenerativeAI({ apiKey, baseURL: "https://generativelanguage.googleapis.com/v1beta" })(model),
  [GroovingProvider.Anthropic]: (apiKey, model) => createAnthropic({ apiKey, baseURL: "https://api.anthropic.com/v1" })(model),
  [GroovingProvider.OpenAI]: (apiKey, model) => createOpenAI({ apiKey, baseURL: "https://api.openai.com/v1" })(model)
};

const NO_USAGE: LlmUsage = { inputTokens: 0, outputTokens: 0 };

export function createLlmModel(config: LlmConfig): LanguageModel {
  return PROVIDER_MODELS[config.provider](config.apiKey, config.model);
}

function toUsage(usage: { inputTokens?: number; outputTokens?: number } | undefined): LlmUsage {
  return { inputTokens: usage?.inputTokens ?? 0, outputTokens: usage?.outputTokens ?? 0 };
}

function unusable(usage: LlmUsage): LlmResult<never> {
  return { ok: false, kind: LlmFailureKind.Unusable, reason: GroovingFailureReason.Unusable, usage };
}

function failed(reason: GroovingFailureReason, usage: LlmUsage): LlmResult<never> {
  return { ok: false, kind: LlmFailureKind.Failed, reason, usage };
}

function isUnusableAnswer(error: unknown): boolean {
  return (
    NoObjectGeneratedError.isInstance(error) ||
    NoOutputGeneratedError.isInstance(error) ||
    JSONParseError.isInstance(error) ||
    TypeValidationError.isInstance(error)
  );
}

function classifyFailure(error: unknown): GroovingFailureReason {
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  if (!APICallError.isInstance(cause)) return GroovingFailureReason.Network;
  const status = cause.statusCode;
  if (status === 401 || status === 403) return GroovingFailureReason.InvalidKey;
  // Gemini answers a wrong key with 400 INVALID_ARGUMENT and API_KEY_INVALID in the body
  if (status === 400 && (cause.responseBody ?? "").includes("API_KEY_INVALID")) return GroovingFailureReason.InvalidKey;
  if (status === 404) return GroovingFailureReason.ModelNotFound;
  if (status === 429) return GroovingFailureReason.RateLimited;
  // Any other 4xx (for example Anthropic's 400 "credit balance is too low"): the provider refused the request, retrying does not help
  if (status !== undefined && status >= 400 && status <= 499) return GroovingFailureReason.Rejected;
  return GroovingFailureReason.Network;
}

// The one place that holds the timeout, the retry policy, the failure classes and the usage
export async function callStructuredLlm<S, T>(
  config: LlmConfig,
  schema: z.ZodType<S>,
  prompt: LlmPrompt,
  timeoutMs: number,
  options: LlmOptions | undefined,
  finish: (answer: S) => T | null // null: the answer has the right shape but nothing usable in it
): Promise<LlmResult<T>> {
  if (!options?.model && config.apiKey.trim() === "") return failed(GroovingFailureReason.InvalidKey, NO_USAGE);

  // AbortController + setTimeout instead of AbortSignal.timeout so that fake timers drive it
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const callerSignal = options?.signal;
  const onCallerAbort = () => controller.abort();
  callerSignal?.addEventListener("abort", onCallerAbort, { once: true });
  if (callerSignal?.aborted) controller.abort();

  try {
    const model = options?.model ?? createLlmModel(config);
    const result = await generateText({
      model,
      system: prompt.system,
      prompt: prompt.prompt,
      output: Output.object({ schema }),
      // Retries belong to the caller's flow (once for an unusable answer, the user's "retry" for failures).
      // The SDK's own retries would wrap a 429 in a RetryError and stack waits inside the timeout
      maxRetries: 0,
      abortSignal: controller.signal
    });
    const usage = toUsage(result.totalUsage);
    if (result.finishReason === "length" || result.finishReason === "content-filter") return unusable(usage);
    const value = finish(result.output);
    return value === null ? unusable(usage) : { ok: true, value, usage };
  } catch (error) {
    if (controller.signal.aborted) return failed(GroovingFailureReason.Network, NO_USAGE);
    if (isUnusableAnswer(error)) return unusable(NoObjectGeneratedError.isInstance(error) ? toUsage(error.usage) : NO_USAGE);
    return failed(classifyFailure(error), NO_USAGE);
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", onCallerAbort);
  }
}
