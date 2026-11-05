// Shared names and shapes for song recognition (main, app windows and the YTM page)

export const SongRecognitionSourceKind = {
  PcAudio: "pc-audio",
  DefaultMic: "default-mic",
  Device: "device"
} as const;
export type SongRecognitionSourceKind = (typeof SongRecognitionSourceKind)[keyof typeof SongRecognitionSourceKind];

// The saved setting
export type SongRecognitionSourceSetting = {
  kind: SongRecognitionSourceKind;
  deviceId: string | null;
  label: string | null;
};

export const DEFAULT_SONG_RECOGNITION_SOURCE: SongRecognitionSourceSetting = {
  kind: SongRecognitionSourceKind.PcAudio,
  deviceId: null,
  label: null
};

// The source actually recorded from
export type SongRecognitionRecordSource =
  | { kind: typeof SongRecognitionSourceKind.PcAudio }
  | { kind: typeof SongRecognitionSourceKind.DefaultMic }
  | { kind: typeof SongRecognitionSourceKind.Device; deviceId: string };

export type SongRecognitionInputDevice = {
  deviceId: string;
  label: string;
};

export const SongRecognitionPhase = {
  Idle: "idle",
  Recording: "recording",
  Searching: "searching",
  Message: "message"
} as const;
export type SongRecognitionPhase = (typeof SongRecognitionPhase)[keyof typeof SongRecognitionPhase];

export const SongRecognitionResultKind = {
  NoMatch: "no-match",
  InvalidKey: "invalid-key",
  LimitReached: "limit-reached",
  NetworkError: "network-error",
  SourceUnavailable: "source-unavailable"
} as const;
export type SongRecognitionResultKind = (typeof SongRecognitionResultKind)[keyof typeof SongRecognitionResultKind];

export const SONG_RECOGNITION_MESSAGE_TEXT: Record<SongRecognitionResultKind, string> = {
  [SongRecognitionResultKind.NoMatch]: "No match found",
  [SongRecognitionResultKind.InvalidKey]: "Invalid API key",
  [SongRecognitionResultKind.LimitReached]: "API limit reached",
  [SongRecognitionResultKind.NetworkError]: "Network error",
  [SongRecognitionResultKind.SourceUnavailable]: "Audio source unavailable"
};

// Sent from main to the YTM view
export type SongRecognitionViewState = {
  visible: boolean;
  phase: SongRecognitionPhase;
  message: string | null;
};

export const SONG_RECOGNITION_RECORD_SECONDS = 5;
export const SONG_RECOGNITION_SAMPLE_RATE = 44100;
export const SONG_RECOGNITION_MESSAGE_MS = 4000;
export const SONG_RECOGNITION_TIMEOUT_MS = 15000;

export const SHAZAM_API_KEY_URL = "https://rapidapi.com/apidojo/api/shazam";
export const SHAZAM_DETECT_URL = "https://shazam.p.rapidapi.com/songs/v2/detect";
export const SHAZAM_API_HOST = "shazam.p.rapidapi.com";

// Between main and the YTM preload
export const SongRecognitionIpc = {
  // main -> YTM: SongRecognitionViewState
  State: "songRecognition:state",
  // main -> YTM: the search text
  Search: "songRecognition:search",
  // YTM -> main: the icon was pressed
  Press: "songRecognition:press",
  // YTM -> main: the Grooving destination button was pressed (remember the song, do not search)
  PressForGrooving: "songRecognition:pressForGrooving"
} as const;
export type SongRecognitionIpc = (typeof SongRecognitionIpc)[keyof typeof SongRecognitionIpc];

// Between the YTM preload and the page
export const SongRecognitionMessageOp = {
  State: "ytmd-song-recognition-state",
  Search: "ytmd-song-recognition-search",
  Press: "ytmd-song-recognition-press",
  PressForGrooving: "ytmd-song-recognition-press-for-grooving",
  // The page started listening; the preload sends the last state again
  Listening: "ytmd-song-recognition-listening"
} as const;
export type SongRecognitionMessageOp = (typeof SongRecognitionMessageOp)[keyof typeof SongRecognitionMessageOp];

// Global on the app window's main world: { record, cancel }
export const SONG_RECOGNITION_RECORDER_GLOBAL = "ytmdSongRecognitionRecorder";

// pcm is base64 of 16-bit mono PCM
export type SongRecognitionRecording = { ok: true; pcm: string } | { ok: false };

export type SongRecognitionRecorder = {
  record(source: SongRecognitionRecordSource): Promise<SongRecognitionRecording>;
  cancel(): void;
};
