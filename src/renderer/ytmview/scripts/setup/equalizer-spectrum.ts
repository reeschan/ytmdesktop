import { type EqualizerValues, EQUALIZER_BAND_MAX_DB, EQUALIZER_BAND_MIN_DB } from "~shared/equalizer";
import { equalizerFilterPlan } from "~shared/equalizer/filters";
import { equalizerSpectrumBars, EQUALIZER_SPECTRUM_MIN_FREQUENCY, EQUALIZER_SPECTRUM_MAX_FREQUENCY } from "~shared/equalizer/spectrum";
import { getEqualizerAudio } from "./equalizer-audio";

const IDLE_INTERVAL_MS = 1000;
const CURVE_POINTS = 128;
const CURVE_SAMPLE_RATE = 44100;

export function drawEqualizerSpectrum(
  context: CanvasRenderingContext2D,
  bars: number[],
  options: { color: string; width: number; height: number; gap: number }
) {
  const { color, width, height, gap } = options;
  const gradient = context.createLinearGradient(0, height, 0, 0);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "transparent");
  context.fillStyle = gradient;
  const step = width / bars.length;
  bars.forEach((bar, index) => {
    const barHeight = Math.max(0, Math.min(1, bar)) * height;
    context.fillRect(index * step, height - barHeight, Math.max(0, step - gap), barHeight);
  });
}

export function drawEqualizerCurve(context: CanvasRenderingContext2D, enabled: boolean, values: EqualizerValues, color: string) {
  const { width, height } = context.canvas;
  const frequencies = Float32Array.from(
    { length: CURVE_POINTS },
    (_, index) =>
      EQUALIZER_SPECTRUM_MIN_FREQUENCY * (EQUALIZER_SPECTRUM_MAX_FREQUENCY / EQUALIZER_SPECTRUM_MIN_FREQUENCY) ** (index / (CURVE_POINTS - 1))
  );
  const plan = equalizerFilterPlan(enabled, values);
  const offline = new OfflineAudioContext(1, 1, CURVE_SAMPLE_RATE);
  const response = new Float32Array(CURVE_POINTS).fill(plan.preampGain);
  for (const item of plan.filters) {
    const filter = offline.createBiquadFilter();
    filter.type = item.type;
    filter.frequency.value = item.frequency;
    filter.Q.value = item.q;
    filter.gain.value = item.gainDb;
    const magnitude = new Float32Array(CURVE_POINTS);
    filter.getFrequencyResponse(frequencies, magnitude, new Float32Array(CURVE_POINTS));
    magnitude.forEach((value, index) => {
      response[index] *= value;
    });
  }
  context.strokeStyle = color;
  context.lineWidth = 2 * window.devicePixelRatio;
  context.beginPath();
  response.forEach((magnitude, index) => {
    const db = Math.max(EQUALIZER_BAND_MIN_DB, Math.min(EQUALIZER_BAND_MAX_DB, 20 * Math.log10(magnitude)));
    const x = (index / (CURVE_POINTS - 1)) * width;
    const y = (height * (EQUALIZER_BAND_MAX_DB - db)) / (EQUALIZER_BAND_MAX_DB - EQUALIZER_BAND_MIN_DB);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();
}

export function startEqualizerSpectrum(
  canvas: HTMLCanvasElement,
  options: { reducedMotionIntervalMs: number; drawCurve?: (context: CanvasRenderingContext2D, color: string) => void; gap?: number }
): () => void {
  const context = canvas.getContext("2d");
  if (!context) return () => {};
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let frame: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  function cancel() {
    if (frame !== null) cancelAnimationFrame(frame);
    if (timer !== null) clearTimeout(timer);
    frame = null;
    timer = null;
  }
  function schedule(delay: number | null) {
    if (stopped) return;
    if (delay === null) frame = requestAnimationFrame(draw);
    else timer = setTimeout(draw, delay);
  }
  function draw() {
    frame = null;
    timer = null;
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    context!.clearRect(0, 0, width, height);
    const color = getComputedStyle(document.documentElement).getPropertyValue("--ytmd-color-accent").trim();
    const audio = getEqualizerAudio().getAnalyser();
    let active = false;
    if (audio) {
      const data = new Uint8Array(audio.analyser.frequencyBinCount);
      audio.analyser.getByteFrequencyData(data);
      const bars = equalizerSpectrumBars(data, audio.sampleRate);
      active = bars.some(value => value > 0);
      drawEqualizerSpectrum(context!, bars, { color, width, height, gap: (options.gap ?? 1) * ratio });
    }
    options.drawCurve?.(context!, color);
    schedule(active ? (motion.matches ? options.reducedMotionIntervalMs : null) : IDLE_INTERVAL_MS);
  }
  function wake() {
    cancel();
    draw();
  }
  document.addEventListener("play", wake, true);
  motion.addEventListener("change", wake);
  wake();
  return () => {
    stopped = true;
    cancel();
    document.removeEventListener("play", wake, true);
    motion.removeEventListener("change", wake);
  };
}
