import { SONG_RECOGNITION_SAMPLE_RATE } from "./index";

const CHUNK_SIZE = 0x8000;

function mixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const length = channels.length > 0 ? channels[0].length : 0;
  const mono = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (const channel of channels) sum += channel[i];
    mono[i] = sum / channels.length;
  }
  return mono;
}

function resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  const outLength = Math.floor((input.length * toRate) / fromRate);
  const output = new Float32Array(outLength);
  const ratio = fromRate / toRate;
  for (let i = 0; i < outLength; i++) {
    const position = i * ratio;
    const index = Math.floor(position);
    const fraction = position - index;
    const current = input[index];
    const next = index + 1 < input.length ? input[index + 1] : current;
    output[i] = current + (next - current) * fraction;
  }
  return output;
}

// Mixes the channels to mono, resamples to 44.1kHz and writes 16-bit little-endian PCM
export function encodePcm16(channels: Float32Array[], sampleRate: number): Uint8Array {
  const samples = resampleLinear(mixToMono(channels), sampleRate, SONG_RECOGNITION_SAMPLE_RATE);
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767), true);
  }
  return bytes;
}

// Same as encodePcm16, returned as base64
export function encodePcmBase64(channels: Float32Array[], sampleRate: number): string {
  const bytes = encodePcm16(channels, sampleRate);
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary);
}
