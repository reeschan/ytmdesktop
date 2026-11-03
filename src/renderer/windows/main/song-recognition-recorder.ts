import {
  SONG_RECOGNITION_RECORD_SECONDS,
  SONG_RECOGNITION_RECORDER_GLOBAL,
  SONG_RECOGNITION_SAMPLE_RATE,
  SongRecognitionInputDevice,
  SongRecognitionRecorder,
  SongRecognitionRecordSource,
  SongRecognitionRecording,
  SongRecognitionSourceKind
} from "~shared/song-recognition";
import { encodePcmBase64 } from "~shared/song-recognition/audio";

declare global {
  interface Window {
    [SONG_RECOGNITION_RECORDER_GLOBAL]?: SongRecognitionRecorder;
  }
}

const COLLECTOR_PROCESSOR = "ytmd-song-recognition-collector";

// Counts frames on the audio thread and posts the collected mono samples once
const COLLECTOR_SOURCE = `
class Collector extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.samples = new Float32Array(options.processorOptions.frames);
    this.written = 0;
  }

  process(inputs) {
    if (this.written >= this.samples.length) return false;
    const channel = inputs[0] && inputs[0].length > 0 ? inputs[0][0] : null;
    const count = Math.min(channel ? channel.length : 128, this.samples.length - this.written);
    if (channel) this.samples.set(channel.subarray(0, count), this.written);
    this.written += count;
    if (this.written >= this.samples.length) {
      this.port.postMessage(this.samples, [this.samples.buffer]);
      return false;
    }
    return true;
  }
}
registerProcessor(${JSON.stringify(COLLECTOR_PROCESSOR)}, Collector);
`;

// Device ids that alias another device
const ALIAS_DEVICE_IDS = ["default", "communications"];

// getUserMedia error names that mean the requested device is not connected
const MISSING_DEVICE_ERRORS = ["OverconstrainedError", "NotFoundError"];

const FAILED: SongRecognitionRecording = Object.freeze({ ok: false });
const ABORTED = Symbol("aborted");

type Session = {
  id: number;
  isAborted: boolean;
  abort(): void;
  aborted: Promise<typeof ABORTED>;
};

let generation = 0;
let current: Session | null = null;

function createSession(): Session {
  let resolveAborted: (value: typeof ABORTED) => void = () => undefined;
  const aborted = new Promise<typeof ABORTED>(resolve => (resolveAborted = resolve));
  const session: Session = {
    id: ++generation,
    isAborted: false,
    abort: () => {
      session.isAborted = true;
      resolveAborted(ABORTED);
    },
    aborted
  };
  return session;
}

function isLive(session: Session) {
  return session.id === generation && !session.isAborted;
}

function untilAborted<T>(session: Session, promise: Promise<T>): Promise<T | typeof ABORTED> {
  return Promise.race([promise, session.aborted]);
}

function stopTracks(tracks: MediaStreamTrack[]) {
  for (const track of tracks) track.stop();
}

function isMissingDevice(error: unknown) {
  const name = typeof error === "object" && error !== null ? (error as { name?: unknown }).name : undefined;
  return typeof name === "string" && MISSING_DEVICE_ERRORS.includes(name);
}

// Calls getDisplayMedia / getUserMedia synchronously so the user gesture still applies.
// A device that is missing falls back to the default microphone while isWanted() holds.
function openStream(source: SongRecognitionRecordSource, isWanted: () => boolean): Promise<MediaStream> {
  if (source.kind === SongRecognitionSourceKind.PcAudio) {
    return navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
  }
  const audio: MediaTrackConstraints = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
  if (source.kind !== SongRecognitionSourceKind.Device) return navigator.mediaDevices.getUserMedia({ audio });
  return navigator.mediaDevices.getUserMedia({ audio: { ...audio, deviceId: { exact: source.deviceId } } }).catch((error: unknown) => {
    if (!isMissingDevice(error) || !isWanted()) throw error;
    refreshDevices();
    return navigator.mediaDevices.getUserMedia({ audio });
  });
}

function cancel() {
  generation++;
  const session = current;
  current = null;
  session?.abort();
}

async function record(source: SongRecognitionRecordSource): Promise<SongRecognitionRecording> {
  let session: Session | null = null;
  let tracks: MediaStreamTrack[] = [];
  const nodes: AudioNode[] = [];
  let context: AudioContext | null = null;
  let moduleUrl: string | null = null;
  try {
    cancel();
    session = createSession();
    current = session;
    const live = session;

    const opened = openStream(source, () => isLive(live));
    // A stream that arrives after this recording was dropped is stopped right away
    opened.then(
      stream => {
        if (!isLive(live)) stopTracks(stream.getTracks());
      },
      () => undefined
    );
    const stream = await untilAborted(live, opened);
    if (stream === ABORTED) return FAILED;
    tracks = stream.getTracks();
    if (!isLive(live)) return FAILED;

    stopTracks(stream.getVideoTracks());
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return FAILED;
    for (const track of audioTracks) {
      if (track.readyState === "ended") return FAILED;
      track.addEventListener("ended", () => live.abort());
    }

    context = new AudioContext({ sampleRate: SONG_RECOGNITION_SAMPLE_RATE });
    if ((await untilAborted(live, context.resume())) === ABORTED || !isLive(live)) return FAILED;
    if (context.state !== "running") return FAILED;

    moduleUrl = URL.createObjectURL(new Blob([COLLECTOR_SOURCE], { type: "text/javascript" }));
    if ((await untilAborted(live, context.audioWorklet.addModule(moduleUrl))) === ABORTED || !isLive(live)) return FAILED;

    const sampleRate = context.sampleRate;
    const input = new MediaStreamAudioSourceNode(context, { mediaStream: new MediaStream(audioTracks) });
    const collector = new AudioWorkletNode(context, COLLECTOR_PROCESSOR, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      channelCount: 1,
      channelCountMode: "explicit",
      channelInterpretation: "speakers",
      processorOptions: { frames: SONG_RECOGNITION_RECORD_SECONDS * sampleRate }
    });
    // Keeps the graph running without playing the recorded audio back
    const mute = new GainNode(context, { gain: 0 });
    nodes.push(input, collector, mute);

    const collected = new Promise<Float32Array>(resolve => {
      collector.port.onmessage = (event: MessageEvent) => {
        if (event.data instanceof Float32Array) resolve(event.data);
      };
    });
    input.connect(collector);
    collector.connect(mute);
    mute.connect(context.destination);

    const samples = await untilAborted(live, collected);
    if (samples === ABORTED || !isLive(live)) return FAILED;
    return { ok: true, pcm: encodePcmBase64([samples], sampleRate) };
  } catch {
    return FAILED;
  } finally {
    stopTracks(tracks);
    for (const node of nodes) node.disconnect();
    if (context) context.close().catch(() => undefined);
    if (moduleUrl) URL.revokeObjectURL(moduleUrl);
    if (session && current === session) current = null;
  }
}

let devicesRequest = 0;
let lastDevices: string | null = null;

async function publishDevices() {
  const request = ++devicesRequest;
  const all = await navigator.mediaDevices.enumerateDevices();
  if (request !== devicesRequest) return;
  const devices: SongRecognitionInputDevice[] = all
    .filter(device => device.kind === "audioinput" && !ALIAS_DEVICE_IDS.includes(device.deviceId))
    .map(device => ({ deviceId: device.deviceId, label: device.label }));
  const serialized = JSON.stringify(devices);
  if (serialized === lastDevices) return;
  lastDevices = serialized;
  window.ytmd.memoryStore.set("songRecognitionDevices", devices);
}

function refreshDevices() {
  publishDevices().catch(error => console.error("Failed to list the song recognition input devices", error));
}

// Exposes the recorder on window and keeps the input device list in the memory store
export function startSongRecognitionRecorder() {
  if (!Object.prototype.hasOwnProperty.call(window, SONG_RECOGNITION_RECORDER_GLOBAL)) {
    const recorder: SongRecognitionRecorder = Object.freeze({ record, cancel });
    Object.defineProperty(window, SONG_RECOGNITION_RECORDER_GLOBAL, { value: recorder, writable: false });
  }
  navigator.mediaDevices.addEventListener("devicechange", refreshDevices);
  refreshDevices();
}
