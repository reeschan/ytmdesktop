import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { EQUALIZER_PROMPT_MAX } from "~shared/equalizer";
import { GroovingFailureReason, GroovingProvider } from "~shared/grooving";
import { requestEqualizerTuning } from "./llm";

const config = { provider: GroovingProvider.Gemini, apiKey: "secret-test-key", model: "test-model" };
const input = {
  prompt: "warmer",
  values: { bands: [6, 0, 0, 0, 0, 0, 0, 0, 0, 0], preamp: 9, preampManual: false },
  song: null,
  language: "ja" as const
};
const response = { bands: Array<number>(10).fill(1), preamp: -1, explanation: " Clear sound. " };

function answering(value: unknown): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(value) }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: { total: 120, noCache: 120, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 30, text: 30, reasoning: undefined }
      },
      warnings: []
    })
  });
}

describe("requestEqualizerTuning", () => {
  it("returns normalized values and an explanation", async () => {
    const result = await requestEqualizerTuning(config, input, { model: answering(response) });
    expect(result).toMatchObject({
      ok: true,
      value: { values: { bands: response.bands, preamp: -1, preampManual: true }, explanation: "Clear sound." }
    });
  });

  it("clamps and rounds out-of-range answers", async () => {
    const result = await requestEqualizerTuning(config, input, {
      model: answering({ ...response, bands: [20, -20, 1.3, ...Array<number>(7).fill(0)], preamp: -20 })
    });
    expect(result).toMatchObject({ ok: true, value: { values: { bands: [12, -12, 1.5, ...Array<number>(7).fill(0)], preamp: -12 } } });
  });

  it("rejects nine bands as unusable", async () => {
    const result = await requestEqualizerTuning(config, input, { model: answering({ ...response, bands: Array<number>(9).fill(0) }) });
    expect(result).toMatchObject({ ok: false, reason: GroovingFailureReason.Unusable });
  });

  it("returns a reason when the model throws", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("failed");
      }
    });
    expect(await requestEqualizerTuning(config, input, { model })).toMatchObject({ ok: false, reason: GroovingFailureReason.Network });
  });

  it("limits the listener text, excludes the key and omits a missing song", async () => {
    const model = answering(response);
    await requestEqualizerTuning(config, { ...input, prompt: `  ${"x".repeat(EQUALIZER_PROMPT_MAX + 5)}  ` }, { model });
    const sent = JSON.stringify(model.doGenerateCalls[0].prompt);
    expect(sent).not.toContain(config.apiKey);
    expect(sent).toContain("x".repeat(EQUALIZER_PROMPT_MAX));
    expect(sent).not.toContain("x".repeat(EQUALIZER_PROMPT_MAX + 1));
    expect(sent).not.toContain("Song:");
    expect(sent).toContain("Preamp: -6 dB");
  });

  it("flattens line breaks in song fields and sends manual preamp", async () => {
    const model = answering(response);
    await requestEqualizerTuning(
      config,
      { ...input, values: { ...input.values, preampManual: true }, song: { title: "First\nSecond", artist: "A\r\nB" } },
      { model }
    );
    const sent = JSON.stringify(model.doGenerateCalls[0].prompt);
    expect(sent).toContain("Song: First Second");
    expect(sent).toContain("Artist: A B");
    expect(sent).toContain("Preamp: 9 dB");
  });
});
