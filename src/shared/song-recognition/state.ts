// Decides the next state of song recognition and the effects to run, from the current state and an event

import { SongRecognitionPhase, SongRecognitionResultKind } from "./index";
import { SongRecognitionMatch, SongRecognitionResult } from "./response";

// Where the press came from: the search box icon searches, the Grooving button only remembers
export const SongRecognitionDestination = {
  Search: "search",
  Grooving: "grooving"
} as const;
export type SongRecognitionDestination = (typeof SongRecognitionDestination)[keyof typeof SongRecognitionDestination];

export type SongRecognitionState = {
  phase: SongRecognitionPhase;
  // Set only while the phase is message
  message: SongRecognitionResultKind | null;
  // The playback was paused by us for the recording and not resumed yet
  pausedByUs: boolean;
  // The destination of the press that started the recording, kept until the query ends
  destination: SongRecognitionDestination;
};

export const INITIAL_SONG_RECOGNITION_STATE: SongRecognitionState = {
  phase: SongRecognitionPhase.Idle,
  message: null,
  pausedByUs: false,
  destination: SongRecognitionDestination.Search
};
export const SongRecognitionEventType = {
  Press: "press",
  Recorded: "recorded",
  RecordFailed: "record-failed",
  Result: "result",
  MessageExpired: "message-expired",
  Disabled: "disabled",
  UserPlayed: "user-played"
} as const;
export type SongRecognitionEventType = (typeof SongRecognitionEventType)[keyof typeof SongRecognitionEventType];

export type SongRecognitionEvent =
  // enabled: the integration can be used, pcAudio: the source actually recorded is the PC audio, playing: YTM is playing
  // destination: where the press came from; omitted means Search
  | { type: typeof SongRecognitionEventType.Press; enabled: boolean; pcAudio: boolean; playing: boolean; destination?: SongRecognitionDestination }
  | { type: typeof SongRecognitionEventType.Recorded; pcm: string }
  | { type: typeof SongRecognitionEventType.RecordFailed }
  | { type: typeof SongRecognitionEventType.Result; result: SongRecognitionResult }
  | { type: typeof SongRecognitionEventType.MessageExpired }
  | { type: typeof SongRecognitionEventType.Disabled }
  | { type: typeof SongRecognitionEventType.UserPlayed };

export const SongRecognitionEffectType = {
  StartRecording: "start-recording",
  CancelRecording: "cancel-recording",
  Query: "query",
  AbortQuery: "abort-query",
  Pause: "pause",
  Resume: "resume",
  Search: "search",
  Remember: "remember",
  StartMessageTimer: "start-message-timer"
} as const;
export type SongRecognitionEffectType = (typeof SongRecognitionEffectType)[keyof typeof SongRecognitionEffectType];

export type SongRecognitionEffect =
  | { type: typeof SongRecognitionEffectType.StartRecording }
  | { type: typeof SongRecognitionEffectType.CancelRecording }
  | { type: typeof SongRecognitionEffectType.Query; pcm: string }
  | { type: typeof SongRecognitionEffectType.AbortQuery }
  | { type: typeof SongRecognitionEffectType.Pause }
  | { type: typeof SongRecognitionEffectType.Resume }
  | { type: typeof SongRecognitionEffectType.Search; query: string }
  | { type: typeof SongRecognitionEffectType.Remember; title: string; artist: string }
  | { type: typeof SongRecognitionEffectType.StartMessageTimer };

export type SongRecognitionDecision = { state: SongRecognitionState; effects: SongRecognitionEffect[] };

const IDLE_STATE = INITIAL_SONG_RECOGNITION_STATE;

function resumeIfPaused(state: SongRecognitionState): SongRecognitionEffect[] {
  return state.pausedByUs ? [{ type: SongRecognitionEffectType.Resume }] : [];
}

export function decideSongRecognition(state: SongRecognitionState, event: SongRecognitionEvent): SongRecognitionDecision {
  const ignored: SongRecognitionDecision = { state, effects: [] };

  switch (event.type) {
    case SongRecognitionEventType.Press: {
      switch (state.phase) {
        case SongRecognitionPhase.Idle:
        case SongRecognitionPhase.Message: {
          if (!event.enabled) return ignored;
          const pause = event.pcAudio && event.playing;
          return {
            state: {
              phase: SongRecognitionPhase.Recording,
              message: null,
              pausedByUs: pause,
              destination: event.destination ?? SongRecognitionDestination.Search
            },
            effects: [...(pause ? [{ type: SongRecognitionEffectType.Pause } as const] : []), { type: SongRecognitionEffectType.StartRecording }]
          };
        }
        case SongRecognitionPhase.Recording:
          return { state: IDLE_STATE, effects: [{ type: SongRecognitionEffectType.CancelRecording }, ...resumeIfPaused(state)] };
        default:
          return ignored;
      }
    }
    case SongRecognitionEventType.Recorded: {
      if (state.phase !== SongRecognitionPhase.Recording) return ignored;
      return {
        state: { phase: SongRecognitionPhase.Searching, message: null, pausedByUs: false, destination: state.destination },
        effects: [...resumeIfPaused(state), { type: SongRecognitionEffectType.Query, pcm: event.pcm }]
      };
    }
    case SongRecognitionEventType.RecordFailed: {
      if (state.phase !== SongRecognitionPhase.Recording) return ignored;
      return {
        state: {
          phase: SongRecognitionPhase.Message,
          message: SongRecognitionResultKind.SourceUnavailable,
          pausedByUs: false,
          destination: SongRecognitionDestination.Search
        },
        effects: [...resumeIfPaused(state), { type: SongRecognitionEffectType.StartMessageTimer }]
      };
    }
    case SongRecognitionEventType.UserPlayed: {
      if (state.phase !== SongRecognitionPhase.Recording) return ignored;
      return { state: { ...state, pausedByUs: false }, effects: [] };
    }
    case SongRecognitionEventType.Result: {
      if (state.phase !== SongRecognitionPhase.Searching) return ignored;
      const { result } = event;
      if (result.kind === SongRecognitionMatch) {
        const remember: SongRecognitionEffect = { type: SongRecognitionEffectType.Remember, title: result.title, artist: result.artist };
        return {
          state: IDLE_STATE,
          effects:
            state.destination === SongRecognitionDestination.Grooving
              ? [remember]
              : [{ type: SongRecognitionEffectType.Search, query: result.query }, remember]
        };
      }
      return {
        state: { phase: SongRecognitionPhase.Message, message: result.kind, pausedByUs: false, destination: SongRecognitionDestination.Search },
        effects: [{ type: SongRecognitionEffectType.StartMessageTimer }]
      };
    }
    case SongRecognitionEventType.MessageExpired:
      return state.phase === SongRecognitionPhase.Message ? { state: IDLE_STATE, effects: [] } : ignored;
    case SongRecognitionEventType.Disabled: {
      switch (state.phase) {
        case SongRecognitionPhase.Recording:
          return { state: IDLE_STATE, effects: [{ type: SongRecognitionEffectType.CancelRecording }, ...resumeIfPaused(state)] };
        case SongRecognitionPhase.Searching:
          return { state: IDLE_STATE, effects: [{ type: SongRecognitionEffectType.AbortQuery }] };
        default:
          return { state: IDLE_STATE, effects: [] };
      }
    }
  }
}
