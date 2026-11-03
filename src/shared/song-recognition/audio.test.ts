import { describe, expect, it } from "vitest";
import { encodePcm16, encodePcmBase64 } from "./audio";

function readInt16(bytes: Uint8Array): number[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const values: number[] = [];
  for (let i = 0; i < bytes.byteLength; i += 2) values.push(view.getInt16(i, true));
  return values;
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

describe("encodePcm16", () => {
  it("converts 48kHz stereo to 44.1kHz mono with the expected sample and byte counts", () => {
    const left = new Float32Array(48000).fill(0.5);
    const right = new Float32Array(48000).fill(0.5);
    const bytes = encodePcm16([left, right], 48000);
    const expectedSamples = Math.floor((48000 * 44100) / 48000);
    expect(bytes.byteLength).toBe(expectedSamples * 2);
    expect(readInt16(bytes)).toHaveLength(44100);
  });

  it("averages channels sample by sample", () => {
    const bytes = encodePcm16([new Float32Array([1, 0]), new Float32Array([-1, 0.5])], 44100);
    const values = readInt16(bytes);
    expect(values[0]).toBe(0);
    expect(values[1]).toBeGreaterThan(0);
  });

  it("clamps values beyond +-1 to 32767 and -32768", () => {
    const bytes = encodePcm16([new Float32Array([2, -2, 1, -1])], 44100);
    expect(readInt16(bytes)).toEqual([32767, -32768, 32767, -32768]);
  });

  it("turns silence into a run of zeros", () => {
    const bytes = encodePcm16([new Float32Array(100)], 44100);
    expect(readInt16(bytes)).toEqual(Array.from({ length: 100 }, () => 0));
  });

  it("keeps the sample count for 44100Hz mono", () => {
    const bytes = encodePcm16([new Float32Array(1234).fill(0.25)], 44100);
    expect(bytes.byteLength).toBe(1234 * 2);
  });

  it("writes little-endian 16-bit samples", () => {
    const bytes = encodePcm16([new Float32Array([1])], 44100);
    expect(Array.from(bytes)).toEqual([0xff, 0x7f]);
  });

  it("interpolates linearly when resampling", () => {
    // 22050Hz -> 44100Hz doubles the sample count; the midpoint lies between neighbours
    const bytes = encodePcm16([new Float32Array([0, 1, 1, 1])], 22050);
    const values = readInt16(bytes);
    expect(values).toHaveLength(8);
    expect(values[0]).toBe(0);
    expect(values[1]).toBeGreaterThan(0);
    expect(values[1]).toBeLessThan(32767);
  });
});

describe("encodePcmBase64", () => {
  it("decodes back to the same bytes as encodePcm16", () => {
    const channel = new Float32Array(5000).map((_, i) => Math.sin(i / 10));
    const channels = [channel, channel.map(v => v * 0.5)];
    const bytes = encodePcm16(channels, 48000);
    expect(Array.from(fromBase64(encodePcmBase64(channels, 48000)))).toEqual(Array.from(bytes));
  });

  it("handles arrays larger than the argument limit", () => {
    const channel = new Float32Array(500000).fill(0.1);
    const bytes = encodePcm16([channel], 44100);
    expect(fromBase64(encodePcmBase64([channel], 44100))).toEqual(bytes);
  });
});
