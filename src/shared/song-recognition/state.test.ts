import { describe, expect, it } from "vitest";
import { SongRecognitionPhase, SongRecognitionResultKind } from "~shared/song-recognition";
import {
  decideSongRecognition,
  INITIAL_SONG_RECOGNITION_STATE,
  SongRecognitionEffect,
  SongRecognitionEffectType,
  SongRecognitionEvent,
  SongRecognitionEventType,
  SongRecognitionState
} from "~shared/song-recognition/state";

const IDLE: SongRecognitionState = { phase: SongRecognitionPhase.Idle, message: null, pausedByUs: false };
const RECORDING: SongRecognitionState = { phase: SongRecognitionPhase.Recording, message: null, pausedByUs: false };
const RECORDING_PAUSED: SongRecognitionState = { ...RECORDING, pausedByUs: true };
const SEARCHING: SongRecognitionState = { phase: SongRecognitionPhase.Searching, message: null, pausedByUs: false };
const MESSAGE: SongRecognitionState = { phase: SongRecognitionPhase.Message, message: SongRecognitionResultKind.NoMatch, pausedByUs: false };

const START = { type: SongRecognitionEffectType.StartRecording } as const;
const CANCEL = { type: SongRecognitionEffectType.CancelRecording } as const;
const PAUSE = { type: SongRecognitionEffectType.Pause } as const;
const RESUME = { type: SongRecognitionEffectType.Resume } as const;
const TIMER = { type: SongRecognitionEffectType.StartMessageTimer } as const;

const press = (enabled: boolean, pcAudio: boolean, playing: boolean): SongRecognitionEvent => ({
  type: SongRecognitionEventType.Press,
  enabled,
  pcAudio,
  playing
});
const recorded: SongRecognitionEvent = { type: SongRecognitionEventType.Recorded, pcm: "AAAA" };
const recordFailed: SongRecognitionEvent = { type: SongRecognitionEventType.RecordFailed };
const matched: SongRecognitionEvent = {
  type: SongRecognitionEventType.Result,
  result: { kind: "match", query: "Artist Title" }
};
const resultOf = (kind: SongRecognitionResultKind): SongRecognitionEvent => ({ type: SongRecognitionEventType.Result, result: { kind } });
const expired: SongRecognitionEvent = { type: SongRecognitionEventType.MessageExpired };
const disabled: SongRecognitionEvent = { type: SongRecognitionEventType.Disabled };
const userPlayed: SongRecognitionEvent = { type: SongRecognitionEventType.UserPlayed };

type Case = [string, SongRecognitionState, SongRecognitionEvent, SongRecognitionState, SongRecognitionEffect[]];

const CASES: Case[] = [
  ["idle, press (enabled, mic)", IDLE, press(true, false, false), RECORDING, [START]],
  ["idle, press (enabled, pc audio, not playing)", IDLE, press(true, true, false), RECORDING, [START]],
  ["idle, press (enabled, mic, playing)", IDLE, press(true, false, true), RECORDING, [START]],
  ["idle, press (enabled, pc audio, playing)", IDLE, press(true, true, true), RECORDING_PAUSED, [PAUSE, START]],
  ["message, press (enabled)", MESSAGE, press(true, false, false), RECORDING, [START]],
  ["message, press (enabled, pc audio, playing)", MESSAGE, press(true, true, true), RECORDING_PAUSED, [PAUSE, START]],
  ["idle, press (not enabled)", IDLE, press(false, true, true), IDLE, []],
  ["message, press (not enabled)", MESSAGE, press(false, true, true), MESSAGE, []],
  ["recording, press", RECORDING, press(true, true, true), IDLE, [CANCEL]],
  ["recording (paused by us), press", RECORDING_PAUSED, press(true, true, true), IDLE, [CANCEL, RESUME]],
  ["searching, press", SEARCHING, press(true, true, true), SEARCHING, []],
  ["recording, recorded", RECORDING, recorded, SEARCHING, [{ type: SongRecognitionEffectType.Query, pcm: "AAAA" }]],
  ["recording (paused by us), recorded", RECORDING_PAUSED, recorded, SEARCHING, [RESUME, { type: SongRecognitionEffectType.Query, pcm: "AAAA" }]],
  [
    "recording, record failed",
    RECORDING,
    recordFailed,
    { phase: SongRecognitionPhase.Message, message: SongRecognitionResultKind.SourceUnavailable, pausedByUs: false },
    [TIMER]
  ],
  [
    "recording (paused by us), record failed",
    RECORDING_PAUSED,
    recordFailed,
    { phase: SongRecognitionPhase.Message, message: SongRecognitionResultKind.SourceUnavailable, pausedByUs: false },
    [RESUME, TIMER]
  ],
  ["recording (paused by us), user played", RECORDING_PAUSED, userPlayed, RECORDING, []],
  ["recording, user played", RECORDING, userPlayed, RECORDING, []],
  ["searching, result (match)", SEARCHING, matched, IDLE, [{ type: SongRecognitionEffectType.Search, query: "Artist Title" }]],
  ...Object.values(SongRecognitionResultKind).map(
    (kind): Case => [
      `searching, result (${kind})`,
      SEARCHING,
      resultOf(kind),
      { phase: SongRecognitionPhase.Message, message: kind, pausedByUs: false },
      [TIMER]
    ]
  ),
  ["message, message expired", MESSAGE, expired, IDLE, []],
  ["recording, disabled", RECORDING, disabled, IDLE, [CANCEL]],
  ["recording (paused by us), disabled", RECORDING_PAUSED, disabled, IDLE, [CANCEL, RESUME]],
  ["searching, disabled", SEARCHING, disabled, IDLE, [{ type: SongRecognitionEffectType.AbortQuery }]],
  ["message, disabled", MESSAGE, disabled, IDLE, []],
  ["idle, disabled", IDLE, disabled, IDLE, []]
];

// Events that arrive late are dropped
const IGNORED_CASES: [string, SongRecognitionState, SongRecognitionEvent][] = [
  ["idle, recorded", IDLE, recorded],
  ["searching, recorded", SEARCHING, recorded],
  ["message, recorded", MESSAGE, recorded],
  ["idle, record failed", IDLE, recordFailed],
  ["searching, record failed", SEARCHING, recordFailed],
  ["message, record failed", MESSAGE, recordFailed],
  ["idle, result", IDLE, matched],
  ["recording, result", RECORDING_PAUSED, matched],
  ["message, result", MESSAGE, resultOf(SongRecognitionResultKind.NetworkError)],
  ["idle, message expired", IDLE, expired],
  ["recording, message expired", RECORDING_PAUSED, expired],
  ["searching, message expired", SEARCHING, expired],
  ["idle, user played", IDLE, userPlayed],
  ["searching, user played", SEARCHING, userPlayed],
  ["message, user played", MESSAGE, userPlayed]
];

const STATES = [IDLE, RECORDING, RECORDING_PAUSED, SEARCHING, MESSAGE];
const EVENTS: SongRecognitionEvent[] = [
  press(true, true, true),
  press(true, false, true),
  press(true, true, false),
  press(false, true, true),
  recorded,
  recordFailed,
  matched,
  resultOf(SongRecognitionResultKind.NoMatch),
  expired,
  disabled,
  userPlayed
];

describe("decideSongRecognition", () => {
  it("starts idle", () => {
    expect(INITIAL_SONG_RECOGNITION_STATE).toEqual(IDLE);
  });

  it.each(CASES)("%s", (_name, state, event, nextState, effects) => {
    expect(decideSongRecognition(state, event)).toEqual({ state: nextState, effects });
  });

  it.each(IGNORED_CASES)("drops %s", (_name, state, event) => {
    expect(decideSongRecognition(state, event)).toEqual({ state, effects: [] });
  });

  it("does not change the given state", () => {
    const state = { ...RECORDING_PAUSED };
    decideSongRecognition(state, recorded);
    expect(state).toEqual(RECORDING_PAUSED);
  });

  it("resumes when it paused and leaves recording by any way", () => {
    for (const event of [press(true, true, true), recorded, recordFailed, disabled]) {
      const { state, effects } = decideSongRecognition(RECORDING_PAUSED, event);
      expect(effects).toContainEqual(RESUME);
      expect(state.pausedByUs).toBe(false);
    }
  });

  it("does not resume when it did not pause and leaves recording by any way", () => {
    for (const event of [press(true, true, true), recorded, recordFailed, disabled]) {
      expect(decideSongRecognition(RECORDING, event).effects).not.toContainEqual(RESUME);
    }
  });

  it("does not resume after the user played while recording", () => {
    const afterPlay = decideSongRecognition(RECORDING_PAUSED, userPlayed).state;
    for (const event of [press(true, true, true), recorded, recordFailed, disabled]) {
      expect(decideSongRecognition(afterPlay, event).effects).not.toContainEqual(RESUME);
    }
  });

  it("pauses only when the source is the PC audio and it is playing", () => {
    for (const [pcAudio, playing] of [
      [false, false],
      [false, true],
      [true, false]
    ]) {
      const { state, effects } = decideSongRecognition(IDLE, press(true, pcAudio, playing));
      expect(effects).not.toContainEqual(PAUSE);
      expect(state.pausedByUs).toBe(false);
    }
  });

  it("does not query on a press while searching", () => {
    const { effects } = decideSongRecognition(SEARCHING, press(true, true, true));
    expect(effects.some(effect => effect.type === SongRecognitionEffectType.Query)).toBe(false);
  });

  it("is idle after disabled", () => {
    for (const state of STATES) {
      expect(decideSongRecognition(state, disabled).state).toEqual(IDLE);
    }
  });

  it("keeps pausedByUs false outside recording and the message only in the message phase", () => {
    for (const state of STATES) {
      for (const event of EVENTS) {
        const next = decideSongRecognition(state, event).state;
        if (next.phase !== SongRecognitionPhase.Recording) expect(next.pausedByUs).toBe(false);
        expect(next.message !== null).toBe(next.phase === SongRecognitionPhase.Message);
      }
    }
  });
});
