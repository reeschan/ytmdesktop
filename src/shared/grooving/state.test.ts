import { describe, expect, it } from "vitest";
import {
  GROOVING_MARK_TEXT,
  GroovingAnswer,
  GroovingCandidate,
  GroovingConsentChoice,
  GroovingContinuationPhase,
  GroovingDirection,
  GroovingFailureReason,
  GroovingLanguage,
  GroovingList,
  GroovingMood,
  GroovingMoodItem,
  GroovingMoodSection,
  GroovingPair,
  GroovingSaveAction,
  GroovingScreenView,
  GroovingSeedOptions,
  GroovingSeedSong,
  GroovingStep,
  GroovingTrackKind,
  GroovingVisibility
} from "~shared/grooving";
import { GroovingReaction } from "~shared/grooving/continuation";
import {
  decideGrooving,
  groovingRunInProgress,
  groovingStopsThrottling,
  GroovingContinuation,
  GroovingEffect,
  GroovingEvent,
  GroovingPrefetch,
  GroovingSession,
  GroovingState,
  initialGroovingState,
  toGroovingViewState
} from "~shared/grooving/state";

type Flow = GroovingState["flow"];

const track = (videoId: string, kind: GroovingTrackKind): GroovingCandidate => ({
  videoId,
  title: `Title ${videoId}`,
  artists: [`Artist ${videoId}`],
  thumbnailUrl: null,
  kind
});
const CANDIDATES: GroovingCandidate[] = [
  track("a", GroovingTrackKind.Familiar),
  track("b", GroovingTrackKind.New),
  track("c", GroovingTrackKind.Familiar),
  track("d", GroovingTrackKind.New),
  track("e", GroovingTrackKind.Familiar),
  track("f", GroovingTrackKind.New),
  track("g", GroovingTrackKind.Familiar),
  track("h", GroovingTrackKind.New)
];
const MOOD_ITEM: GroovingMoodItem = { name: "Chill", section: GroovingMoodSection.Moods, params: "chill-params" };
const MOOD: GroovingMood = { kind: "item", item: MOOD_ITEM };
const TEXT_MOOD: GroovingMood = { kind: "text", text: "rainy night" };
const PLAYING_SONG: GroovingSeedSong = { title: "Blue Hour", artist: "Alpha", videoId: "v-playing", thumbnail: "https://example.com/blue.jpg" };
const RECOGNIZED_SONG: GroovingSeedSong = { title: "Night Drive", artist: "Beta", videoId: null, thumbnail: null };
const SONG_MOOD: GroovingMood = { kind: "song", song: PLAYING_SONG };
const NO_SEED: GroovingSeedOptions = { playing: null, recognized: null, canRecognize: false };
const PAIR_1: GroovingPair = { left: "a", right: "b", reason: "tempo" };
const PAIR_2: GroovingPair = { left: "c", right: "d", reason: "genre" };
const PAIR_3: GroovingPair = { left: "e", right: "f", reason: "mood" };
const LIST: GroovingList = { videoIds: ["a", "b", "c"], moodDescription: "Lo-fi for a rainy night" };
// The listed tracks of LIST, in its order
const LISTED: GroovingCandidate[] = LIST.videoIds.flatMap(videoId => CANDIDATES.find(candidate => candidate.videoId === videoId) ?? []);
// count tracks, alternating familiar and new
const listedOf = (count: number): GroovingCandidate[] =>
  Array.from({ length: count }, (_, index) => track(`t${index + 1}`, index % 2 === 0 ? GroovingTrackKind.Familiar : GroovingTrackKind.New));
const continuationOf = (overrides: Partial<GroovingContinuation> = {}): GroovingContinuation => ({
  enabled: false,
  rounds: 0,
  phase: GroovingContinuationPhase.Idle,
  listed: LISTED,
  reactions: {},
  requestId: null,
  savedVideoIds: [],
  playlistId: null,
  playing: null,
  ...overrides
});
// A continuation part after the playlist was saved with every listed track
const savedContinuation = (): GroovingContinuation => continuationOf({ savedVideoIds: LIST.videoIds, playlistId: "p1" });
const EXTRA = {
  moods: [MOOD_ITEM],
  moodsFailed: false,
  providerLabel: "Gemini",
  model: "gemini-3.5-flash-lite",
  safeStorageAvailable: true,
  language: GroovingLanguage.English,
  usage: { inputTokens: 1200, outputTokens: 300, estimatedUsd: 0.001 }
};

const EMPTY_SESSION: GroovingSession = {
  mood: MOOD,
  direction: GroovingDirection.Mix,
  rounds: 3,
  historyShared: true,
  candidates: [],
  filledFromMood: false,
  history: [],
  shown: []
};
const sessionOf = (overrides: Partial<GroovingSession> = {}): GroovingSession => ({
  ...EMPTY_SESSION,
  candidates: CANDIDATES,
  ...overrides
});
const stateOf = (flow: Flow, overrides: Partial<Omit<GroovingState, "flow">> = {}): GroovingState => ({
  flow,
  visibility: GroovingVisibility.Shown,
  notice: false,
  previewing: null,
  queue: "original",
  seed: NO_SEED,
  nextRequestId: 10,
  ...overrides
});

const hiddenOf = (state: GroovingState): GroovingState => ({ ...state, visibility: GroovingVisibility.Hidden });

const continuationAt = (state: GroovingState): GroovingContinuation => {
  const flow = state.flow;
  if (flow.kind !== "done" && flow.kind !== "saving" && flow.kind !== "saved") throw new Error("the flow has no continuation part");
  return flow.continuation;
};

// A session that is showing PAIR_1 as its first round
const SHOWING = sessionOf({ shown: ["a", "b"] });
// A session that is showing PAIR_3 as its last round (rounds 3)
const SHOWING_LAST = sessionOf({
  history: [
    { pair: PAIR_1, answer: GroovingAnswer.Left },
    { pair: PAIR_2, answer: GroovingAnswer.Right }
  ],
  shown: ["a", "b", "c", "d", "e", "f"]
});
const ANSWERED_ALL = sessionOf({ history: [...SHOWING_LAST.history, { pair: PAIR_3, answer: GroovingAnswer.Neither }], shown: SHOWING_LAST.shown });

const pending = (requestId: string): GroovingPrefetch => ({ status: "pending", requestId });
const ready = (pair: GroovingPair): GroovingPrefetch => ({ status: "ready", pair });
const FAILED_PREFETCH: GroovingPrefetch = { status: "failed" };

const CLOSED = stateOf({ kind: "closed" }, { visibility: GroovingVisibility.Gone });
const NEED_KEY = stateOf({ kind: "need-key" });
const CONSENT = stateOf({ kind: "consent" });
const SETUP = stateOf({ kind: "setup", historyShared: true });
const SETUP_NOTICE = stateOf({ kind: "setup", historyShared: true }, { notice: true });
const SETUP_NO_HISTORY = stateOf({ kind: "setup", historyShared: false });
const COLLECT = stateOf({ kind: "collect", session: EMPTY_SESSION });
const PAIR_WAIT = stateOf({ kind: "pair-wait", session: sessionOf(), requestId: "r9", retry: false });
const PAIR_RETRY = stateOf({ kind: "pair-wait", session: sessionOf(), requestId: "r9", retry: true });
const chooseOf = (left: GroovingPrefetch | null, right: GroovingPrefetch | null, overrides: Partial<Omit<GroovingState, "flow">> = {}) =>
  stateOf({ kind: "choose", session: SHOWING, pair: PAIR_1, prefetch: { left, right } }, overrides);
const CHOOSE = chooseOf(pending("r7"), pending("r8"));
const CHOOSE_PREVIEWING = chooseOf(pending("r7"), pending("r8"), { previewing: "a" });
const CHOOSE_LAST = stateOf({ kind: "choose", session: SHOWING_LAST, pair: PAIR_3, prefetch: { left: null, right: null } });
const LIST_WAIT = stateOf({ kind: "list-wait", session: ANSWERED_ALL, requestId: "r9", retry: false });
const LIST_RETRY = stateOf({ kind: "list-wait", session: ANSWERED_ALL, requestId: "r9", retry: true });
const FAILED_COLLECT = stateOf({ kind: "failed", session: EMPTY_SESSION, step: GroovingStep.Collect, reason: GroovingFailureReason.YtmUnreadable });
const FAILED_PAIR = stateOf({ kind: "failed", session: SHOWING, step: GroovingStep.Pair, reason: GroovingFailureReason.Unusable });
const FAILED_LIST = stateOf({ kind: "failed", session: ANSWERED_ALL, step: GroovingStep.List, reason: GroovingFailureReason.Network });
const FAILED_NO_SESSION = stateOf({ kind: "failed", session: null, step: GroovingStep.Pair, reason: GroovingFailureReason.Network });
const DONE = stateOf(
  { kind: "done", session: ANSWERED_ALL, list: LIST, continuation: continuationOf(), saveFailed: false, queueFailed: false, replacing: false },
  { queue: "this-run" }
);
const DONE_SAVE_FAILED = stateOf(
  { kind: "done", session: ANSWERED_ALL, list: LIST, continuation: continuationOf(), saveFailed: true, queueFailed: false, replacing: false },
  { queue: "this-run" }
);
const SAVING = stateOf(
  {
    kind: "saving",
    session: ANSWERED_ALL,
    list: LIST,
    continuation: continuationOf(),
    saveFailed: false,
    queueFailed: false,
    replacing: false,
    sendingVideoIds: LIST.videoIds
  },
  { queue: "this-run" }
);
const SAVED = stateOf(
  { kind: "saved", session: ANSWERED_ALL, list: LIST, continuation: savedContinuation(), saveFailed: false, queueFailed: false, replacing: false },
  { queue: "this-run" }
);
// The continue part in each phase (the last 10 tracks, so the last ones are near the end)
const doneWith = (continuation: GroovingContinuation): GroovingState =>
  stateOf(
    { kind: "done", session: ANSWERED_ALL, list: LIST, continuation, saveFailed: false, queueFailed: false, replacing: false },
    { queue: "this-run" }
  );
const DONE_CONTINUING = doneWith(continuationOf({ enabled: true, listed: listedOf(10), playing: "t10" }));
const DONE_COLLECTING = doneWith(
  continuationOf({ enabled: true, listed: listedOf(10), playing: "t9", phase: GroovingContinuationPhase.Collecting, requestId: 5 })
);
const DONE_REQUESTING = doneWith(
  continuationOf({ enabled: true, listed: listedOf(10), playing: "t9", phase: GroovingContinuationPhase.Requesting, requestId: 5 })
);
const DONE_REQUESTING_RETRY = doneWith(
  continuationOf({ enabled: true, listed: listedOf(10), playing: "t9", phase: GroovingContinuationPhase.RequestingRetry, requestId: 5 })
);
const DONE_CONTINUATION_FAILED = doneWith(continuationOf({ listed: listedOf(10), phase: GroovingContinuationPhase.Failed }));
const DONE_CONTINUATION_SHORT = doneWith(continuationOf({ listed: listedOf(10), phase: GroovingContinuationPhase.Short }));
const DONE_CONTINUATION_FINISHED = doneWith(
  continuationOf({ enabled: true, rounds: 3, listed: listedOf(10), playing: "t10", phase: GroovingContinuationPhase.Finished })
);
// The same states after the page could not replace the queue
const queueFailedOf = (state: GroovingState): GroovingState =>
  stateOf({ ...(state.flow as Extract<Flow, { list: GroovingList }>), queueFailed: true }, { queue: "this-run" });
const DONE_QUEUE_FAILED = queueFailedOf(DONE);
const DONE_BOTH_FAILED = queueFailedOf(DONE_SAVE_FAILED);
const SAVING_QUEUE_FAILED = queueFailedOf(SAVING);
const SAVED_QUEUE_FAILED = queueFailedOf(SAVED);
const QUEUE_FAILED_STATES = [DONE_QUEUE_FAILED, DONE_BOTH_FAILED, SAVING_QUEUE_FAILED, SAVED_QUEUE_FAILED];
// The same states while waiting for the page's answer to replace the queue
const replacingOf = (state: GroovingState): GroovingState =>
  stateOf({ ...(state.flow as Extract<Flow, { list: GroovingList }>), replacing: true }, { queue: "this-run" });
const DONE_REPLACING = replacingOf(DONE);
const DONE_SAVE_FAILED_REPLACING = replacingOf(DONE_SAVE_FAILED);
const SAVING_REPLACING = replacingOf(SAVING);
const SAVED_REPLACING = replacingOf(SAVED);
const HIDDEN_SETUP = hiddenOf(SETUP);
const HIDDEN_SETUP_NOTICE = hiddenOf(SETUP_NOTICE);
const HIDDEN_COLLECT = hiddenOf(COLLECT);
const HIDDEN_PAIR_WAIT = hiddenOf(PAIR_WAIT);
const HIDDEN_CHOOSE = hiddenOf(CHOOSE);
const HIDDEN_LIST_WAIT = hiddenOf(LIST_WAIT);
const HIDDEN_FAILED_COLLECT = hiddenOf(FAILED_COLLECT);
const HIDDEN_DONE = hiddenOf(DONE);
const HIDDEN_SAVING = hiddenOf(SAVING);
const HIDDEN_SAVED = hiddenOf(SAVED);

const SAMPLE_STATES: GroovingState[] = [
  CLOSED,
  stateOf({ kind: "closed" }, { queue: "this-run", visibility: GroovingVisibility.Gone }),
  stateOf({ kind: "closed" }, { queue: "earlier-run", visibility: GroovingVisibility.Gone }),
  NEED_KEY,
  CONSENT,
  SETUP,
  SETUP_NOTICE,
  SETUP_NO_HISTORY,
  stateOf({ kind: "setup", historyShared: true }, { queue: "earlier-run" }),
  HIDDEN_SETUP,
  HIDDEN_SETUP_NOTICE,
  COLLECT,
  HIDDEN_COLLECT,
  PAIR_WAIT,
  PAIR_RETRY,
  HIDDEN_PAIR_WAIT,
  CHOOSE,
  CHOOSE_PREVIEWING,
  chooseOf(ready(PAIR_2), FAILED_PREFETCH, { previewing: "b" }),
  chooseOf(null, ready(PAIR_3)),
  HIDDEN_CHOOSE,
  CHOOSE_LAST,
  stateOf(CHOOSE_LAST.flow, { previewing: "e" }),
  LIST_WAIT,
  LIST_RETRY,
  stateOf(LIST_WAIT.flow, { queue: "earlier-run" }),
  HIDDEN_LIST_WAIT,
  FAILED_COLLECT,
  FAILED_PAIR,
  FAILED_LIST,
  FAILED_NO_SESSION,
  HIDDEN_FAILED_COLLECT,
  DONE,
  DONE_SAVE_FAILED,
  DONE_REPLACING,
  DONE_CONTINUING,
  DONE_COLLECTING,
  DONE_REQUESTING,
  DONE_REQUESTING_RETRY,
  DONE_CONTINUATION_FAILED,
  DONE_CONTINUATION_SHORT,
  DONE_CONTINUATION_FINISHED,
  SAVING,
  SAVING_REPLACING,
  SAVED,
  SAVED_REPLACING,
  HIDDEN_DONE,
  HIDDEN_SAVING,
  HIDDEN_SAVED
];

const LOAD_MOODS: GroovingEffect = { type: "load-moods" };
const PREVIEW_END: GroovingEffect = { type: "preview-end" };
const SHARE: GroovingEvent = { type: "open", hasKey: true, consent: { choice: GroovingConsentChoice.ShareHistory, at: "2026-11-03T00:00:00Z" } };
const NO_HISTORY: GroovingEvent = { type: "open", hasKey: true, consent: { choice: GroovingConsentChoice.NoHistory, at: "2026-11-03T00:00:00Z" } };
const NO_CONSENT: GroovingEvent = { type: "open", hasKey: true, consent: null };
const NO_KEY: GroovingEvent = { type: "open", hasKey: false, consent: null };
const NO_KEY_SHARED: GroovingEvent = {
  type: "open",
  hasKey: false,
  consent: { choice: GroovingConsentChoice.ShareHistory, at: "2026-11-03T00:00:00Z" }
};
const CLOSE: GroovingEvent = { type: "close" };
const LEAVE: GroovingEvent = { type: "leave" };
const PAGE_RELOADED: GroovingEvent = { type: "page-reloaded" };
const QUEUE_REPLACED: GroovingEvent = { type: "queue-replaced" };
const DISMISS_NOTICE: GroovingEvent = { type: "dismiss-notice" };
const WITHDRAW_CONSENT: GroovingEvent = { type: "withdraw-consent" };
const start = (direction: GroovingDirection, mood: GroovingMood = MOOD, rounds: 3 | 5 | 10 = 3): GroovingEvent => ({
  type: "start",
  mood,
  direction,
  rounds
});
const answer = (value: GroovingAnswer): GroovingEvent => ({ type: "answer", answer: value });
const pairArrived = (requestId: string, pair: GroovingPair): GroovingEvent => ({ type: "pair-arrived", requestId, pair });
const pairUnusable = (requestId: string): GroovingEvent => ({ type: "pair-unusable", requestId });
const pairFailed = (requestId: string, reason: GroovingFailureReason = GroovingFailureReason.RateLimited): GroovingEvent => ({
  type: "pair-failed",
  requestId,
  reason
});
const listArrived = (requestId: string, list: GroovingList = LIST, continueEnabled = false): GroovingEvent => ({
  type: "list-arrived",
  requestId,
  list,
  continueEnabled
});
const listUnusable = (requestId: string): GroovingEvent => ({ type: "list-unusable", requestId });
const listFailed = (requestId: string): GroovingEvent => ({ type: "list-failed", requestId, reason: GroovingFailureReason.Network });
const candidatesReady: GroovingEvent = { type: "candidates-ready", candidates: CANDIDATES, filledFromMood: true };
const RETRY: GroovingEvent = { type: "retry" };
const previewStart = (videoId: string): GroovingEvent => ({ type: "preview-start", videoId });
const PREVIEW_ENDED: GroovingEvent = { type: "preview-ended" };
const continueToggle = (enabled: boolean): GroovingEvent => ({ type: "continue-toggle", enabled });
const trackStarted = (videoId: string): GroovingEvent => ({ type: "track-started", videoId });
const trackReaction = (videoId: string, reaction: GroovingReaction): GroovingEvent => ({ type: "track-reaction", videoId, reaction });
const continuationCandidates = (requestId: number, ok: boolean, reason: "short" | "failed" = "failed"): GroovingEvent =>
  ok ? { type: "continuation-candidates", requestId, ok: true } : { type: "continuation-candidates", requestId, ok: false, reason };
const continuationArrived = (requestId: number, tracks: GroovingCandidate[] = [track("n1", GroovingTrackKind.New)]): GroovingEvent => ({
  type: "continuation-arrived",
  requestId,
  tracks
});
const continuationUnusable = (requestId: number): GroovingEvent => ({ type: "continuation-unusable", requestId });
const continuationFailed = (requestId: number): GroovingEvent => ({ type: "continuation-failed", requestId });
const SAVED_EVENT: GroovingEvent = { type: "saved", playlistId: "p1" };
const requestPair = (requestId: string, session: GroovingSession, assumed: GroovingAnswer | null = null): GroovingEffect => ({
  type: "request-pair",
  requestId,
  session,
  assumed
});
const requestList = (requestId: string, session: GroovingSession): GroovingEffect => ({ type: "request-list", requestId, session });

// Every event, with the request ids the given state is waiting for and a stale one
function eventsFor(state: GroovingState): GroovingEvent[] {
  const ids = ["r999"];
  const flow = state.flow;
  if (flow.kind === "pair-wait" || flow.kind === "list-wait") ids.push(flow.requestId);
  if (flow.kind === "choose") {
    for (const prefetch of [flow.prefetch.left, flow.prefetch.right]) if (prefetch?.status === "pending") ids.push(prefetch.requestId);
  }
  const videoIds = flow.kind === "choose" ? [flow.pair.left, flow.pair.right, "zz"] : ["a", "zz"];
  const continuationIds: number[] = [];
  const startedIds = [...videoIds];
  if (flow.kind === "done" || flow.kind === "saving" || flow.kind === "saved") {
    if (flow.continuation.requestId !== null) continuationIds.push(flow.continuation.requestId);
    continuationIds.push(999);
    startedIds.push(...flow.continuation.listed.map(track => track.videoId));
  }
  return [
    SHARE,
    NO_HISTORY,
    NO_CONSENT,
    NO_KEY,
    { type: "consent", choice: GroovingConsentChoice.ShareHistory },
    { type: "consent", choice: GroovingConsentChoice.NoHistory },
    { type: "consent", choice: null },
    start(GroovingDirection.Familiar),
    start(GroovingDirection.Discover),
    start(GroovingDirection.Mix),
    candidatesReady,
    { type: "collect-failed", reason: GroovingFailureReason.NotEnough },
    ...ids.flatMap(id => [pairArrived(id, PAIR_2), pairUnusable(id), pairFailed(id), listArrived(id), listUnusable(id), listFailed(id)]),
    answer(GroovingAnswer.Left),
    answer(GroovingAnswer.Right),
    answer(GroovingAnswer.Neither),
    RETRY,
    ...videoIds.map(previewStart),
    PREVIEW_ENDED,
    { type: "save" },
    SAVED_EVENT,
    { type: "save-failed" },
    continueToggle(true),
    continueToggle(false),
    ...startedIds.map(trackStarted),
    ...startedIds.map(videoId => trackReaction(videoId, GroovingReaction.PlayedThrough)),
    ...continuationIds.flatMap(id => [
      continuationCandidates(id, true),
      continuationCandidates(id, false, "short"),
      continuationCandidates(id, false, "failed"),
      continuationArrived(id),
      continuationUnusable(id),
      continuationFailed(id)
    ]),
    { type: "playlist-added" },
    { type: "playlist-add-failed" },
    { type: "queue-failed" },
    QUEUE_REPLACED,
    { type: "again" },
    WITHDRAW_CONSENT,
    PAGE_RELOADED,
    DISMISS_NOTICE,
    CLOSE,
    LEAVE
  ];
}

type Case = [string, GroovingState, GroovingEvent, GroovingState, GroovingEffect[]];

const CASES: Case[] = [
  // open
  ["closed, open (no key)", CLOSED, NO_KEY, NEED_KEY, []],
  ["closed, open (no key, answered)", CLOSED, NO_KEY_SHARED, NEED_KEY, []],
  ["closed, open (not answered)", CLOSED, NO_CONSENT, CONSENT, []],
  ["closed, open (share history)", CLOSED, SHARE, SETUP, [LOAD_MOODS]],
  ["closed, open (no history)", CLOSED, NO_HISTORY, SETUP_NO_HISTORY, [LOAD_MOODS]],
  [
    "closed (this run's list), open",
    stateOf({ kind: "closed" }, { queue: "this-run" }),
    SHARE,
    stateOf({ kind: "setup", historyShared: true }, { queue: "earlier-run" }),
    [LOAD_MOODS]
  ],
  [
    "closed (this run's list), open (no key)",
    stateOf({ kind: "closed" }, { queue: "this-run" }),
    NO_KEY,
    stateOf({ kind: "need-key" }, { queue: "earlier-run" }),
    []
  ],
  [
    "closed (earlier run's list), open",
    stateOf({ kind: "closed" }, { queue: "earlier-run" }),
    NO_CONSENT,
    stateOf({ kind: "consent" }, { queue: "earlier-run" }),
    []
  ],
  // consent
  ["consent, not now", CONSENT, { type: "consent", choice: null }, CLOSED, []],
  [
    "consent, share history",
    CONSENT,
    { type: "consent", choice: GroovingConsentChoice.ShareHistory },
    SETUP,
    [{ type: "store-consent", choice: GroovingConsentChoice.ShareHistory }, LOAD_MOODS]
  ],
  [
    "consent, no history",
    CONSENT,
    { type: "consent", choice: GroovingConsentChoice.NoHistory },
    SETUP_NO_HISTORY,
    [{ type: "store-consent", choice: GroovingConsentChoice.NoHistory }, LOAD_MOODS]
  ],
  // start
  [
    "setup, start",
    SETUP,
    start(GroovingDirection.Mix),
    COLLECT,
    [{ type: "collect", request: { direction: GroovingDirection.Mix, historyShared: true, mood: MOOD } }]
  ],
  [
    "setup (no history), start discover with words",
    SETUP_NO_HISTORY,
    start(GroovingDirection.Discover, TEXT_MOOD, 5),
    stateOf({
      kind: "collect",
      session: { ...EMPTY_SESSION, mood: TEXT_MOOD, direction: GroovingDirection.Discover, rounds: 5, historyShared: false }
    }),
    [{ type: "collect", request: { direction: GroovingDirection.Discover, historyShared: false, mood: TEXT_MOOD } }]
  ],
  // collect
  [
    "collect, candidates ready",
    COLLECT,
    candidatesReady,
    stateOf({ kind: "pair-wait", session: sessionOf({ filledFromMood: true }), requestId: "r10", retry: false }, { nextRequestId: 11 }),
    [requestPair("r10", sessionOf({ filledFromMood: true }))]
  ],
  ["collect, collect failed", COLLECT, { type: "collect-failed", reason: GroovingFailureReason.YtmUnreadable }, FAILED_COLLECT, []],
  // pair-arrived
  [
    "pair wait, pair arrived",
    PAIR_WAIT,
    pairArrived("r9", PAIR_1),
    stateOf({ kind: "choose", session: SHOWING, pair: PAIR_1, prefetch: { left: pending("r10"), right: pending("r11") } }, { nextRequestId: 12 }),
    [requestPair("r10", SHOWING, GroovingAnswer.Left), requestPair("r11", SHOWING, GroovingAnswer.Right)]
  ],
  [
    "pair retry, pair arrived",
    PAIR_RETRY,
    pairArrived("r9", PAIR_1),
    stateOf({ kind: "choose", session: SHOWING, pair: PAIR_1, prefetch: { left: pending("r10"), right: pending("r11") } }, { nextRequestId: 12 }),
    [requestPair("r10", SHOWING, GroovingAnswer.Left), requestPair("r11", SHOWING, GroovingAnswer.Right)]
  ],
  [
    "pair wait, last pair arrived (no prefetch)",
    stateOf({ kind: "pair-wait", session: { ...SHOWING_LAST, shown: ["a", "b", "c", "d"] }, requestId: "r9", retry: false }),
    pairArrived("r9", PAIR_3),
    CHOOSE_LAST,
    []
  ],
  ["choose, left prefetch arrived", CHOOSE, pairArrived("r7", PAIR_2), chooseOf(ready(PAIR_2), pending("r8")), []],
  ["choose, right prefetch arrived", CHOOSE, pairArrived("r8", PAIR_3), chooseOf(pending("r7"), ready(PAIR_3)), []],
  // pair-unusable / pair-failed
  [
    "pair wait, pair unusable",
    PAIR_WAIT,
    pairUnusable("r9"),
    stateOf({ kind: "pair-wait", session: sessionOf(), requestId: "r10", retry: true }, { nextRequestId: 11 }),
    [requestPair("r10", sessionOf())]
  ],
  [
    "pair retry, pair unusable again",
    PAIR_RETRY,
    pairUnusable("r9"),
    stateOf({ kind: "failed", session: sessionOf(), step: GroovingStep.Pair, reason: GroovingFailureReason.Unusable }),
    []
  ],
  ["choose, left prefetch unusable", CHOOSE, pairUnusable("r7"), chooseOf(FAILED_PREFETCH, pending("r8")), []],
  [
    "pair wait, pair failed",
    PAIR_WAIT,
    pairFailed("r9"),
    stateOf({ kind: "failed", session: sessionOf(), step: GroovingStep.Pair, reason: GroovingFailureReason.RateLimited }),
    []
  ],
  [
    "pair retry, pair failed",
    PAIR_RETRY,
    pairFailed("r9", GroovingFailureReason.InvalidKey),
    stateOf({ kind: "failed", session: sessionOf(), step: GroovingStep.Pair, reason: GroovingFailureReason.InvalidKey }),
    []
  ],
  ["choose, right prefetch failed", CHOOSE, pairFailed("r8"), chooseOf(pending("r7"), FAILED_PREFETCH), []],
  // answer
  [
    "choose the last pair, answer",
    CHOOSE_LAST,
    answer(GroovingAnswer.Neither),
    stateOf({ kind: "list-wait", session: ANSWERED_ALL, requestId: "r10", retry: false }, { nextRequestId: 11 }),
    [requestList("r10", ANSWERED_ALL)]
  ],
  [
    "choose the last pair while previewing, answer",
    stateOf(CHOOSE_LAST.flow, { previewing: "e" }),
    answer(GroovingAnswer.Neither),
    stateOf({ kind: "list-wait", session: ANSWERED_ALL, requestId: "r10", retry: false }, { nextRequestId: 11 }),
    [PREVIEW_END, requestList("r10", ANSWERED_ALL)]
  ],
  [
    "choose, neither",
    chooseOf(ready(PAIR_2), ready(PAIR_3)),
    answer(GroovingAnswer.Neither),
    stateOf(
      { kind: "pair-wait", session: { ...SHOWING, history: [{ pair: PAIR_1, answer: GroovingAnswer.Neither }] }, requestId: "r10", retry: false },
      { nextRequestId: 11 }
    ),
    [requestPair("r10", { ...SHOWING, history: [{ pair: PAIR_1, answer: GroovingAnswer.Neither }] })]
  ],
  [
    "choose, left with its prefetch ready",
    chooseOf(ready(PAIR_2), pending("r8")),
    answer(GroovingAnswer.Left),
    stateOf(
      {
        kind: "choose",
        session: { ...SHOWING, history: [{ pair: PAIR_1, answer: GroovingAnswer.Left }], shown: ["a", "b", "c", "d"] },
        pair: PAIR_2,
        prefetch: { left: pending("r10"), right: pending("r11") }
      },
      { nextRequestId: 12 }
    ),
    [
      requestPair("r10", { ...SHOWING, history: [{ pair: PAIR_1, answer: GroovingAnswer.Left }], shown: ["a", "b", "c", "d"] }, GroovingAnswer.Left),
      requestPair("r11", { ...SHOWING, history: [{ pair: PAIR_1, answer: GroovingAnswer.Left }], shown: ["a", "b", "c", "d"] }, GroovingAnswer.Right)
    ]
  ],
  [
    "choose (second round), right with its prefetch ready, the next pair is the last",
    stateOf({
      kind: "choose",
      session: sessionOf({ history: [{ pair: PAIR_1, answer: GroovingAnswer.Left }], shown: ["a", "b", "c", "d"] }),
      pair: PAIR_2,
      prefetch: { left: FAILED_PREFETCH, right: ready(PAIR_3) }
    }),
    answer(GroovingAnswer.Right),
    stateOf({ kind: "choose", session: SHOWING_LAST, pair: PAIR_3, prefetch: { left: null, right: null } }),
    []
  ],
  [
    "choose, right with its prefetch pending",
    CHOOSE,
    answer(GroovingAnswer.Right),
    stateOf({ kind: "pair-wait", session: { ...SHOWING, history: [{ pair: PAIR_1, answer: GroovingAnswer.Right }] }, requestId: "r8", retry: false }),
    []
  ],
  [
    "choose, left with its prefetch failed",
    chooseOf(FAILED_PREFETCH, ready(PAIR_3)),
    answer(GroovingAnswer.Left),
    stateOf(
      { kind: "pair-wait", session: { ...SHOWING, history: [{ pair: PAIR_1, answer: GroovingAnswer.Left }] }, requestId: "r10", retry: false },
      { nextRequestId: 11 }
    ),
    [requestPair("r10", { ...SHOWING, history: [{ pair: PAIR_1, answer: GroovingAnswer.Left }] })]
  ],
  [
    "choose, right with no prefetch",
    chooseOf(ready(PAIR_2), null),
    answer(GroovingAnswer.Right),
    stateOf(
      { kind: "pair-wait", session: { ...SHOWING, history: [{ pair: PAIR_1, answer: GroovingAnswer.Right }] }, requestId: "r10", retry: false },
      { nextRequestId: 11 }
    ),
    [requestPair("r10", { ...SHOWING, history: [{ pair: PAIR_1, answer: GroovingAnswer.Right }] })]
  ],
  [
    "choose while previewing, answer",
    CHOOSE_PREVIEWING,
    answer(GroovingAnswer.Left),
    stateOf({ kind: "pair-wait", session: { ...SHOWING, history: [{ pair: PAIR_1, answer: GroovingAnswer.Left }] }, requestId: "r7", retry: false }),
    [PREVIEW_END]
  ],
  // list
  ["list wait, list arrived", LIST_WAIT, listArrived("r9"), DONE_REPLACING, [{ type: "replace-queue", videoIds: LIST.videoIds }]],
  ["list retry, list arrived", LIST_RETRY, listArrived("r9"), DONE_REPLACING, [{ type: "replace-queue", videoIds: LIST.videoIds }]],
  [
    "list wait (earlier run's list), list arrived",
    stateOf(LIST_WAIT.flow, { queue: "earlier-run" }),
    listArrived("r9"),
    DONE_REPLACING,
    [{ type: "replace-queue", videoIds: LIST.videoIds }]
  ],
  [
    "list wait, list unusable",
    LIST_WAIT,
    listUnusable("r9"),
    stateOf({ kind: "list-wait", session: ANSWERED_ALL, requestId: "r10", retry: true }, { nextRequestId: 11 }),
    [requestList("r10", ANSWERED_ALL)]
  ],
  [
    "list retry, list unusable again",
    LIST_RETRY,
    listUnusable("r9"),
    stateOf({ kind: "failed", session: ANSWERED_ALL, step: GroovingStep.List, reason: GroovingFailureReason.Unusable }),
    []
  ],
  ["list wait, list failed", LIST_WAIT, listFailed("r9"), FAILED_LIST, []],
  ["list retry, list failed", LIST_RETRY, listFailed("r9"), FAILED_LIST, []],
  // retry
  [
    "collect failed, retry",
    FAILED_COLLECT,
    RETRY,
    COLLECT,
    [{ type: "collect", request: { direction: GroovingDirection.Mix, historyShared: true, mood: MOOD } }]
  ],
  [
    "pair failed, retry",
    FAILED_PAIR,
    RETRY,
    stateOf({ kind: "pair-wait", session: SHOWING, requestId: "r10", retry: false }, { nextRequestId: 11 }),
    [requestPair("r10", SHOWING)]
  ],
  [
    "list failed, retry",
    FAILED_LIST,
    RETRY,
    stateOf({ kind: "list-wait", session: ANSWERED_ALL, requestId: "r10", retry: false }, { nextRequestId: 11 }),
    [requestList("r10", ANSWERED_ALL)]
  ],
  ["failed without a session, retry", FAILED_NO_SESSION, RETRY, SETUP_NO_HISTORY, [LOAD_MOODS]],
  // preview
  ["choose, preview", CHOOSE, previewStart("a"), CHOOSE_PREVIEWING, [{ type: "preview-start", videoId: "a" }]],
  [
    "choose while previewing, preview the other",
    CHOOSE_PREVIEWING,
    previewStart("b"),
    chooseOf(pending("r7"), pending("r8"), { previewing: "b" }),
    [{ type: "preview-start", videoId: "b" }]
  ],
  ["choose while previewing, preview ended", CHOOSE_PREVIEWING, PREVIEW_ENDED, CHOOSE, [PREVIEW_END]],
  // save
  ["done, save", DONE, { type: "save" }, SAVING, [{ type: "save-playlist", title: LIST.moodDescription, videoIds: LIST.videoIds }]],
  ["saving, saved", SAVING, SAVED_EVENT, SAVED, []],
  ["saving, save failed", SAVING, { type: "save-failed" }, DONE_SAVE_FAILED, []],
  [
    "done (save failed), save",
    DONE_SAVE_FAILED,
    { type: "save" },
    SAVING,
    [{ type: "save-playlist", title: LIST.moodDescription, videoIds: LIST.videoIds }]
  ],
  // queue-failed
  ["done, queue failed", DONE, { type: "queue-failed" }, DONE_QUEUE_FAILED, []],
  ["done (save failed), queue failed", DONE_SAVE_FAILED, { type: "queue-failed" }, DONE_BOTH_FAILED, []],
  ["saving, queue failed", SAVING, { type: "queue-failed" }, SAVING_QUEUE_FAILED, []],
  ["saved, queue failed", SAVED, { type: "queue-failed" }, SAVED_QUEUE_FAILED, []],
  ["done (queue failed), queue failed again", DONE_QUEUE_FAILED, { type: "queue-failed" }, DONE_QUEUE_FAILED, []],
  ["done (replacing), queue failed", DONE_REPLACING, { type: "queue-failed" }, DONE_QUEUE_FAILED, []],
  ["done (save failed, replacing), queue failed", DONE_SAVE_FAILED_REPLACING, { type: "queue-failed" }, DONE_BOTH_FAILED, []],
  ["saving (replacing), queue failed", SAVING_REPLACING, { type: "queue-failed" }, SAVING_QUEUE_FAILED, []],
  ["saved (replacing), queue failed", SAVED_REPLACING, { type: "queue-failed" }, SAVED_QUEUE_FAILED, []],
  ["done (replacing), queue replaced", DONE_REPLACING, QUEUE_REPLACED, DONE, []],
  ["saving (replacing), queue replaced", SAVING_REPLACING, QUEUE_REPLACED, SAVING, []],
  ["saved (replacing), queue replaced", SAVED_REPLACING, QUEUE_REPLACED, SAVED, []],
  [
    "done (replacing), save",
    DONE_REPLACING,
    { type: "save" },
    SAVING_REPLACING,
    [{ type: "save-playlist", title: LIST.moodDescription, videoIds: LIST.videoIds }]
  ],
  ["done (queue failed), retry", DONE_QUEUE_FAILED, RETRY, DONE_REPLACING, [{ type: "replace-queue", videoIds: LIST.videoIds }]],
  ["done (save and queue failed), retry", DONE_BOTH_FAILED, RETRY, DONE_SAVE_FAILED_REPLACING, [{ type: "replace-queue", videoIds: LIST.videoIds }]],
  ["saving (queue failed), retry", SAVING_QUEUE_FAILED, RETRY, SAVING_REPLACING, [{ type: "replace-queue", videoIds: LIST.videoIds }]],
  ["saved (queue failed), retry", SAVED_QUEUE_FAILED, RETRY, SAVED_REPLACING, [{ type: "replace-queue", videoIds: LIST.videoIds }]],
  [
    "done (queue failed), save",
    DONE_QUEUE_FAILED,
    { type: "save" },
    SAVING_QUEUE_FAILED,
    [{ type: "save-playlist", title: LIST.moodDescription, videoIds: LIST.videoIds }]
  ],
  ["saving (queue failed), saved", SAVING_QUEUE_FAILED, SAVED_EVENT, SAVED_QUEUE_FAILED, []],
  ["saving (queue failed), save failed", SAVING_QUEUE_FAILED, { type: "save-failed" }, DONE_BOTH_FAILED, []],
  // again
  ["done, again", DONE, { type: "again" }, stateOf({ kind: "setup", historyShared: true }, { queue: "earlier-run" }), [LOAD_MOODS]],
  [
    "done (save failed), again",
    DONE_SAVE_FAILED,
    { type: "again" },
    stateOf({ kind: "setup", historyShared: true }, { queue: "earlier-run" }),
    [LOAD_MOODS]
  ],
  [
    "saved (no history), again",
    stateOf(
      {
        kind: "saved",
        session: { ...ANSWERED_ALL, historyShared: false },
        list: LIST,
        continuation: savedContinuation(),
        saveFailed: false,
        queueFailed: false,
        replacing: false
      },
      { queue: "this-run" }
    ),
    { type: "again" },
    stateOf({ kind: "setup", historyShared: false }, { queue: "earlier-run" }),
    [LOAD_MOODS]
  ],
  // page reloaded
  [
    "collect, page reloaded",
    COLLECT,
    PAGE_RELOADED,
    stateOf(
      { kind: "failed", session: EMPTY_SESSION, step: GroovingStep.Collect, reason: GroovingFailureReason.YtmUnreadable },
      { visibility: GroovingVisibility.Hidden }
    ),
    []
  ],
  [
    "saving, page reloaded",
    SAVING,
    PAGE_RELOADED,
    stateOf(
      { kind: "done", session: ANSWERED_ALL, list: LIST, continuation: continuationOf(), saveFailed: true, queueFailed: false, replacing: false },
      { queue: "this-run", visibility: GroovingVisibility.Hidden }
    ),
    []
  ],
  [
    "saving (replacing), page reloaded",
    SAVING_REPLACING,
    PAGE_RELOADED,
    stateOf(
      { kind: "done", session: ANSWERED_ALL, list: LIST, continuation: continuationOf(), saveFailed: true, queueFailed: true, replacing: false },
      { queue: "this-run", visibility: GroovingVisibility.Hidden }
    ),
    []
  ],
  [
    "done (replacing), page reloaded",
    DONE_REPLACING,
    PAGE_RELOADED,
    stateOf(
      { kind: "done", session: ANSWERED_ALL, list: LIST, continuation: continuationOf(), saveFailed: false, queueFailed: true, replacing: false },
      { queue: "this-run", visibility: GroovingVisibility.Hidden }
    ),
    []
  ],
  [
    "saved (replacing), page reloaded",
    SAVED_REPLACING,
    PAGE_RELOADED,
    stateOf(
      { kind: "saved", session: ANSWERED_ALL, list: LIST, continuation: savedContinuation(), saveFailed: false, queueFailed: true, replacing: false },
      { queue: "this-run", visibility: GroovingVisibility.Hidden }
    ),
    []
  ],
  ["done (not replacing), page reloaded", DONE, PAGE_RELOADED, HIDDEN_DONE, []],
  [
    "choose while previewing, page reloaded",
    CHOOSE_PREVIEWING,
    PAGE_RELOADED,
    { ...CHOOSE, visibility: GroovingVisibility.Hidden, previewing: null },
    []
  ],
  ["pair wait, page reloaded", PAIR_WAIT, PAGE_RELOADED, HIDDEN_PAIR_WAIT, []],
  ["list wait, page reloaded", LIST_WAIT, PAGE_RELOADED, HIDDEN_LIST_WAIT, []],
  ["setup, page reloaded", SETUP, PAGE_RELOADED, HIDDEN_SETUP, []],
  ["failed, page reloaded", FAILED_COLLECT, PAGE_RELOADED, HIDDEN_FAILED_COLLECT, []],
  ["need key, page reloaded", NEED_KEY, PAGE_RELOADED, stateOf({ kind: "closed" }, { visibility: GroovingVisibility.Gone }), []],
  ["consent, page reloaded", CONSENT, PAGE_RELOADED, stateOf({ kind: "closed" }, { visibility: GroovingVisibility.Gone }), []],
  ["hidden setup (notice), page reloaded", HIDDEN_SETUP_NOTICE, PAGE_RELOADED, HIDDEN_SETUP_NOTICE, []],
  // notice
  ["setup (notice), dismiss notice", SETUP_NOTICE, DISMISS_NOTICE, SETUP, []],
  [
    "setup (notice), start",
    SETUP_NOTICE,
    start(GroovingDirection.Mix),
    COLLECT,
    [{ type: "collect", request: { direction: GroovingDirection.Mix, historyShared: true, mood: MOOD } }]
  ],
  ["setup (notice), close", SETUP_NOTICE, CLOSE, CLOSED, []],
  // The notice waits for the setup screen, so the key guidance and the consent keep it
  [
    "need key (notice), close",
    stateOf({ kind: "need-key" }, { notice: true }),
    CLOSE,
    stateOf({ kind: "closed" }, { visibility: GroovingVisibility.Gone, notice: true }),
    []
  ],
  [
    "consent (notice), close",
    stateOf({ kind: "consent" }, { notice: true }),
    CLOSE,
    stateOf({ kind: "closed" }, { visibility: GroovingVisibility.Gone, notice: true }),
    []
  ],
  // withdraw consent closes from shown and from hidden
  ["setup, withdraw consent", SETUP, WITHDRAW_CONSENT, stateOf({ kind: "closed" }, { visibility: GroovingVisibility.Gone }), []],
  ["hidden collect, withdraw consent", HIDDEN_COLLECT, WITHDRAW_CONSENT, stateOf({ kind: "closed" }, { visibility: GroovingVisibility.Gone }), []],
  [
    "choose while previewing, withdraw consent",
    CHOOSE_PREVIEWING,
    WITHDRAW_CONSENT,
    stateOf({ kind: "closed" }, { visibility: GroovingVisibility.Gone }),
    [PREVIEW_END]
  ],
  // close only closes what is shown, from every state but closed
  ...SAMPLE_STATES.filter(state => state.flow.kind !== "closed" && state.visibility === GroovingVisibility.Shown).map((state): Case => [
    `${state.flow.kind}${state.previewing ? " while previewing" : ""}, close`,
    state,
    CLOSE,
    { ...state, flow: { kind: "closed" }, visibility: GroovingVisibility.Gone, notice: false, previewing: null },
    state.previewing ? [PREVIEW_END] : []
  ]),
  // leave hides past consent, and closes the key guidance and the consent
  ...SAMPLE_STATES.filter(state => state.flow.kind !== "closed" && state.visibility === GroovingVisibility.Shown).map((state): Case => {
    const closes = state.flow.kind === "need-key" || state.flow.kind === "consent";
    return [
      `${state.flow.kind}${state.previewing ? " while previewing" : ""}, leave`,
      state,
      LEAVE,
      closes
        ? { ...state, flow: { kind: "closed" }, visibility: GroovingVisibility.Gone, previewing: null }
        : { ...state, visibility: GroovingVisibility.Hidden, previewing: null },
      state.previewing ? [PREVIEW_END] : []
    ];
  })
];

// Events that do not fit the state are dropped
const IGNORED_CASES: [string, GroovingState, GroovingEvent][] = [
  ["setup, open", SETUP, SHARE],
  ["choose, open", CHOOSE, SHARE],
  ["closed, consent", CLOSED, { type: "consent", choice: GroovingConsentChoice.ShareHistory }],
  ["setup, consent", SETUP, { type: "consent", choice: null }],
  ["closed, start", CLOSED, start(GroovingDirection.Discover)],
  ["collect, start", COLLECT, start(GroovingDirection.Discover)],
  ["pair wait, candidates ready", PAIR_WAIT, candidatesReady],
  ["pair wait, collect failed", PAIR_WAIT, { type: "collect-failed", reason: GroovingFailureReason.Network }],
  ["list wait, pair arrived", LIST_WAIT, pairArrived("r9", PAIR_1)],
  ["closed, pair arrived", CLOSED, pairArrived("r9", PAIR_1)],
  ["pair wait, list arrived", PAIR_WAIT, listArrived("r9")],
  ["choose, pair unusable (stale)", CHOOSE, pairUnusable("r1")],
  ["choose, pair failed (stale)", CHOOSE, pairFailed("r1")],
  ["pair wait, pair unusable (stale)", PAIR_WAIT, pairUnusable("r1")],
  ["pair wait, pair failed (stale)", PAIR_WAIT, pairFailed("r1")],
  ["list wait, list unusable (stale)", LIST_WAIT, listUnusable("r1")],
  ["list wait, list failed (stale)", LIST_WAIT, listFailed("r1")],
  ["choose, prefetch arrived twice", chooseOf(ready(PAIR_2), pending("r8")), pairArrived("r7", PAIR_3)],
  ["setup, answer", SETUP, answer(GroovingAnswer.Left)],
  ["pair wait, answer", PAIR_WAIT, answer(GroovingAnswer.Neither)],
  ["done, answer", DONE, answer(GroovingAnswer.Left)],
  ["setup, retry", SETUP, RETRY],
  ["pair wait, retry", PAIR_WAIT, RETRY],
  ["done, retry", DONE, RETRY],
  ["pair wait, preview", PAIR_WAIT, previewStart("a")],
  ["done, preview", DONE, previewStart("a")],
  ["choose, preview a track not in the pair", CHOOSE, previewStart("c")],
  ["choose while previewing, preview the same track", CHOOSE_PREVIEWING, previewStart("a")],
  ["choose, preview ended", CHOOSE, PREVIEW_ENDED],
  ["closed, preview ended", CLOSED, PREVIEW_ENDED],
  ["saving, save", SAVING, { type: "save" }],
  ["saved, save", SAVED, { type: "save" }],
  ["done, saved", DONE, SAVED_EVENT],
  ["done, save failed", DONE, { type: "save-failed" }],
  ["setup, again", SETUP, { type: "again" }],
  ["saving, again", SAVING, { type: "again" }],
  ["choose, again", CHOOSE, { type: "again" }],
  ["closed, close", CLOSED, CLOSE],
  ["closed, leave", CLOSED, LEAVE],
  ["hidden setup, close", HIDDEN_SETUP, CLOSE],
  ["hidden collect, leave", HIDDEN_COLLECT, LEAVE],
  ["hidden setup, start", HIDDEN_SETUP, start(GroovingDirection.Discover)],
  ["hidden setup, consent", HIDDEN_SETUP, { type: "consent", choice: GroovingConsentChoice.ShareHistory }],
  ["hidden choose, answer", HIDDEN_CHOOSE, answer(GroovingAnswer.Left)],
  ["hidden failed, retry", HIDDEN_FAILED_COLLECT, RETRY],
  ["hidden choose, preview", HIDDEN_CHOOSE, previewStart("a")],
  ["hidden done, save", HIDDEN_DONE, { type: "save" }],
  ["hidden done, continue toggle", HIDDEN_DONE, continueToggle(true)],
  ["done, the same continue toggle", DONE, continueToggle(false)],
  ["choose, track started", CHOOSE, trackStarted("a")],
  ["done, an answer for no request", DONE, continuationArrived(5)],
  ["done, playlist added", DONE, { type: "playlist-added" }],
  ["done, playlist add failed", DONE, { type: "playlist-add-failed" }],
  ["hidden done (queue failed), retry", hiddenOf(DONE_QUEUE_FAILED), RETRY],
  ["hidden done, again", HIDDEN_DONE, { type: "again" }],
  ["closed, page reloaded", CLOSED, PAGE_RELOADED],
  ["closed, withdraw consent", CLOSED, WITHDRAW_CONSENT],
  ["done (not replacing), queue replaced", DONE, QUEUE_REPLACED],
  ["saving (not replacing), queue replaced", SAVING, QUEUE_REPLACED],
  ["choose, queue replaced", CHOOSE, QUEUE_REPLACED],
  ["setup (no notice), dismiss notice", SETUP, DISMISS_NOTICE],
  ["hidden setup (notice), dismiss notice", HIDDEN_SETUP_NOTICE, DISMISS_NOTICE],
  ["closed, dismiss notice", CLOSED, DISMISS_NOTICE],
  ["closed, queue failed", CLOSED, { type: "queue-failed" }],
  ["choose, queue failed", CHOOSE, { type: "queue-failed" }],
  ["list wait, queue failed", LIST_WAIT, { type: "queue-failed" }],
  ["failed (list), queue failed", FAILED_LIST, { type: "queue-failed" }],
  ["saving, retry", SAVING, RETRY],
  ["saved, retry", SAVED, RETRY]
];

// Applies events in order and returns the last state and every effect
function run(state: GroovingState, events: GroovingEvent[]): { state: GroovingState; effects: GroovingEffect[] } {
  const effects: GroovingEffect[] = [];
  let current = state;
  for (const event of events) {
    const decision = decideGrooving(current, event);
    current = decision.state;
    effects.push(...decision.effects);
  }
  return { state: current, effects };
}

function requestIdsOf(effects: GroovingEffect[]): string[] {
  return effects.flatMap(effect => (effect.type === "request-pair" || effect.type === "request-list" ? [effect.requestId] : []));
}

// Events that move a Grooving forward, picked more often on the random walks
// (the ones that change the state and do not end in closed, need-key, consent or failed)
function forwardEventsOf(state: GroovingState, events: GroovingEvent[]): GroovingEvent[] {
  const forward = events.filter(event => {
    const next = decideGrooving(state, event).state;
    return next !== state && !["closed", "need-key", "consent", "failed"].includes(next.flow.kind);
  });
  return forward.length > 0 ? forward : events;
}

// A small deterministic random number generator, for the random walks
function randomOf(seed: number): (size: number) => number {
  let value = seed;
  return size => {
    // Park-Miller: the product stays below 2^53, so it is exact
    value = (value * 48271) % 2147483647;
    return Math.floor((value / 2147483647) * size);
  };
}

// Checks the %% never rules of the state chart on one transition
function expectRules(state: GroovingState, event: GroovingEvent, next: GroovingState, effects: GroovingEffect[]): void {
  // (a) Previewing only while choosing, and only a track of the pair
  if (next.flow.kind !== "choose") expect(next.previewing).toBeNull();
  else if (next.previewing !== null) expect([next.flow.pair.left, next.flow.pair.right]).toContain(next.previewing);
  // (b) The queue becomes this run's list only when the list arrives while making it
  if (next.queue === "this-run" && state.queue !== "this-run") {
    expect(event.type).toBe("list-arrived");
    expect(state.flow.kind).toBe("list-wait");
  }
  if (effects.some(effect => effect.type === "replace-queue")) expect(next.queue).toBe("this-run");
  // (c) No retry after a retry
  const flow = state.flow;
  if ((flow.kind === "pair-wait" || flow.kind === "list-wait") && flow.retry) {
    const unusable = flow.kind === "pair-wait" ? "pair-unusable" : "list-unusable";
    if (event.type === unusable && event.requestId === flow.requestId) {
      expect(next.flow).toEqual({
        kind: "failed",
        session: flow.session,
        step: flow.kind === "pair-wait" ? GroovingStep.Pair : GroovingStep.List,
        reason: GroovingFailureReason.Unusable
      });
      expect(effects).toEqual([]);
    }
  }
  // Request ids only grow
  expect(next.nextRequestId).toBeGreaterThanOrEqual(state.nextRequestId);
  // Only the done screen tells that saving failed, and only right after save-failed
  const nextFlow = next.flow;
  if (nextFlow.kind === "saving") expect(nextFlow.saveFailed).toBe(false);
  if (nextFlow.kind === "saved" && nextFlow.saveFailed) expect(["playlist-add-failed", "save-failed", "page-reloaded"]).toContain(event.type);
  // (queue-failed and retry keep a done whose save failed, in a new flow with only queueFailed changed)
  if (nextFlow.kind === "done" && nextFlow.saveFailed && !(state.flow.kind === "done" && state.flow.saveFailed)) {
    expect(["save-failed", "page-reloaded"]).toContain(event.type);
    expect(state.flow.kind).toBe("saving");
  }
  if (nextFlow.kind === "done" && event.type === "list-arrived" && state.flow.kind === "list-wait") expect(nextFlow.saveFailed).toBe(false);
  // queueFailed turns true only on queue-failed, or on a page reload that ends a waiting replacement, and the done made from a list starts without it
  const wasQueueFailed = "queueFailed" in flow && flow.queueFailed;
  if ("queueFailed" in nextFlow && nextFlow.queueFailed && !wasQueueFailed) expect(["queue-failed", "page-reloaded"]).toContain(event.type);
  if (nextFlow.kind === "done" && event.type === "list-arrived" && state.flow.kind === "list-wait") expect(nextFlow.queueFailed).toBe(false);
  // Retry after queue-failed replaces the queue with the same list again, and nothing else
  if (wasQueueFailed && event.type === "retry" && state.visibility === GroovingVisibility.Shown) {
    expect(effects).toEqual([{ type: "replace-queue", videoIds: (flow as Extract<Flow, { list: GroovingList }>).list.videoIds }]);
    expect(next.flow).toEqual({ ...flow, queueFailed: false, replacing: true });
  }
  // (d) A hidden screen never keeps a preview, and never covers the key guidance or the consent
  if (next.visibility === GroovingVisibility.Hidden) {
    expect(next.previewing).toBeNull();
    expect(next.flow.kind).not.toBe("need-key");
    expect(next.flow.kind).not.toBe("consent");
  }
  // (e) The view and the flow agree: closed is gone, anything else is shown or hidden
  if (next.flow.kind === "closed") expect(next.visibility).toBe(GroovingVisibility.Gone);
  else expect(next.visibility).not.toBe(GroovingVisibility.Gone);
  // (f) The notice goes away only when it is dismissed, started or closed
  if (state.notice && !next.notice) expect(["dismiss-notice", "start", "close"]).toContain(event.type);
  // (g) The continuation part never goes over 3 rounds and never lists a track twice
  if ("continuation" in nextFlow) {
    expect(nextFlow.continuation.rounds).toBeGreaterThanOrEqual(0);
    expect(nextFlow.continuation.rounds).toBeLessThanOrEqual(3);
    const listed = nextFlow.continuation.listed.map(track => track.videoId);
    expect(new Set(listed).size).toBe(listed.length);
  }
  // (h) Nothing goes to the queue of a run whose continuation is off, and an add never repeats a saved track
  for (const effect of effects) {
    if (effect.type === "append-queue" && "continuation" in nextFlow) expect(nextFlow.continuation.enabled).toBe(true);
    if (effect.type === "add-to-playlist" && "continuation" in flow) {
      for (const videoId of effect.videoIds) expect(flow.continuation.savedVideoIds).not.toContain(videoId);
    }
  }
}

describe("decideGrooving", () => {
  it("starts closed, with the original queue, no preview and no notice", () => {
    expect(initialGroovingState()).toEqual({
      flow: { kind: "closed" },
      visibility: GroovingVisibility.Gone,
      notice: false,
      previewing: null,
      queue: "original",
      seed: { playing: null, recognized: null, canRecognize: false },
      nextRequestId: 1
    });
  });

  it("can start with the notice of the previous run", () => {
    expect(initialGroovingState({ notice: true })).toMatchObject({ notice: true, visibility: GroovingVisibility.Gone });
    expect(initialGroovingState({})).toMatchObject({ notice: false });
  });

  it.each(CASES)("%s", (_name, state, event, nextState, effects) => {
    expect(decideGrooving(state, event)).toEqual({ state: nextState, effects });
  });

  it.each(IGNORED_CASES)("drops %s", (_name, state, event) => {
    expect(decideGrooving(state, event)).toEqual({ state, effects: [] });
  });

  it("does not change the given state", () => {
    const state = structuredClone(chooseOf(ready(PAIR_2), pending("r8"), { previewing: "a" }));
    const copy = structuredClone(state);
    for (const event of eventsFor(state)) decideGrooving(state, event);
    expect(state).toEqual(copy);
  });

  describe("drops answers to requests it is not waiting for", () => {
    const stale = ["r1", "r8", "r10", "r999"];
    it.each(stale)("pair arrived %s while waiting for r9", requestId => {
      expect(decideGrooving(PAIR_WAIT, pairArrived(requestId, PAIR_1))).toEqual({ state: PAIR_WAIT, effects: [] });
      expect(decideGrooving(PAIR_RETRY, pairArrived(requestId, PAIR_1))).toEqual({ state: PAIR_RETRY, effects: [] });
    });
    it.each(["r1", "r9", "r999"])("pair arrived %s while choosing with r7 and r8 pending", requestId => {
      expect(decideGrooving(CHOOSE, pairArrived(requestId, PAIR_2))).toEqual({ state: CHOOSE, effects: [] });
    });
    it.each(stale)("list arrived %s while waiting for r9", requestId => {
      expect(decideGrooving(LIST_WAIT, listArrived(requestId))).toEqual({ state: LIST_WAIT, effects: [] });
      expect(decideGrooving(LIST_RETRY, listArrived(requestId))).toEqual({ state: LIST_RETRY, effects: [] });
    });
    it("drops the other side's prefetch after an answer waits for one side", () => {
      const waiting = decideGrooving(CHOOSE, answer(GroovingAnswer.Left)).state;
      expect(decideGrooving(waiting, pairArrived("r8", PAIR_3))).toEqual({ state: waiting, effects: [] });
    });
  });

  describe("without history sharing", () => {
    it.each([GroovingDirection.Familiar, GroovingDirection.Mix])("ignores start %s", direction => {
      expect(decideGrooving(SETUP_NO_HISTORY, start(direction))).toEqual({ state: SETUP_NO_HISTORY, effects: [] });
    });
    it("starts discover", () => {
      expect(decideGrooving(SETUP_NO_HISTORY, start(GroovingDirection.Discover)).state.flow.kind).toBe("collect");
    });
    it.each(Object.values(GroovingDirection))("starts %s with history sharing", direction => {
      expect(decideGrooving(SETUP, start(direction)).state.flow.kind).toBe("collect");
    });
  });

  describe("%% never rules", () => {
    it("(a) clears the preview on every transition to a state other than choose", () => {
      for (const state of SAMPLE_STATES) {
        for (const event of eventsFor(state)) {
          const next = decideGrooving(state, event).state;
          if (next.flow.kind !== "choose") expect(next.previewing).toBeNull();
        }
      }
    });

    it("(a) ends the preview when it leaves choose", () => {
      for (const state of SAMPLE_STATES.filter(sample => sample.flow.kind === "choose" && sample.previewing !== null)) {
        for (const event of eventsFor(state)) {
          const { state: next, effects } = decideGrooving(state, event);
          if (next.flow.kind !== "choose" || next.flow.pair !== (state.flow as { pair: GroovingPair }).pair) {
            expect(next.previewing).toBeNull();
            expect(effects[0]).toEqual(PREVIEW_END);
          }
        }
      }
    });

    it("(b) replaces the queue only when this run's list arrives", () => {
      for (const state of SAMPLE_STATES) {
        for (const event of eventsFor(state)) {
          const { state: next, effects } = decideGrooving(state, event);
          expectRules(state, event, next, effects);
        }
      }
    });

    it("keeps the rules from the states where replacing the queue failed", () => {
      for (const state of QUEUE_FAILED_STATES) {
        for (const event of eventsFor(state)) {
          const { state: next, effects } = decideGrooving(state, event);
          expectRules(state, event, next, effects);
          expect(next.previewing).toBeNull();
        }
      }
    });

    it("(b) keeps this run's queue when the page could not replace it, and replaces it again on retry", () => {
      const { state: failedQueue, effects: none } = decideGrooving(DONE, { type: "queue-failed" });
      expect(failedQueue.queue).toBe("this-run");
      expect(none).toEqual([]);
      const { state: retried, effects } = decideGrooving(failedQueue, RETRY);
      expect(retried.queue).toBe("this-run");
      expect(retried.flow).toEqual({ ...DONE.flow, replacing: true });
      expect(effects).toEqual([{ type: "replace-queue", videoIds: LIST.videoIds }]);
    });

    it("(b) keeps the earlier run's list after again until the next list arrives", () => {
      const steps: [GroovingEvent, GroovingState["queue"]][] = [
        [{ type: "again" }, "earlier-run"],
        [start(GroovingDirection.Mix), "earlier-run"],
        [candidatesReady, "earlier-run"],
        [pairArrived("r10", PAIR_1), "earlier-run"], // prefetch r11 and r12
        [answer(GroovingAnswer.Left), "earlier-run"], // waits for r11
        [pairArrived("r11", PAIR_2), "earlier-run"], // prefetch r13 and r14
        [answer(GroovingAnswer.Right), "earlier-run"], // waits for r14
        [pairArrived("r14", PAIR_3), "earlier-run"], // the last pair, no prefetch
        [answer(GroovingAnswer.Neither), "earlier-run"], // list r15
        [listUnusable("r15"), "earlier-run"], // list r16
        [listArrived("r16"), "this-run"]
      ];
      let state = DONE;
      for (const [event, queue] of steps) {
        const decision = decideGrooving(state, event);
        expectRules(state, event, decision.state, decision.effects);
        state = decision.state;
        expect(state.queue).toBe(queue);
      }
      expect(state.flow.kind).toBe("done");
    });

    it("(b) keeps the queue when it closes before the list arrives", () => {
      for (const state of [COLLECT, PAIR_WAIT, CHOOSE_PREVIEWING, LIST_WAIT, LIST_RETRY, FAILED_LIST]) {
        const { state: next, effects } = decideGrooving(state, CLOSE);
        expect(next.queue).toBe("original");
        expect(effects).not.toContainEqual({ type: "replace-queue", videoIds: LIST.videoIds });
      }
    });

    it("(c) fails instead of retrying again after a retry", () => {
      expect(decideGrooving(PAIR_RETRY, pairUnusable("r9"))).toEqual({
        state: stateOf({ kind: "failed", session: sessionOf(), step: GroovingStep.Pair, reason: GroovingFailureReason.Unusable }),
        effects: []
      });
      expect(decideGrooving(LIST_RETRY, listUnusable("r9"))).toEqual({
        state: stateOf({ kind: "failed", session: ANSWERED_ALL, step: GroovingStep.List, reason: GroovingFailureReason.Unusable }),
        effects: []
      });
      // The retried request is the one it waits for next
      const retried = decideGrooving(PAIR_WAIT, pairUnusable("r9")).state;
      expect(decideGrooving(retried, pairUnusable("r10")).state.flow.kind).toBe("failed");
      const listRetried = decideGrooving(LIST_WAIT, listUnusable("r9")).state;
      expect(decideGrooving(listRetried, listUnusable("r10")).state.flow.kind).toBe("failed");
    });

    it("(c) retries once more only after the user presses retry", () => {
      const failed = run(PAIR_WAIT, [pairUnusable("r9"), pairUnusable("r10")]).state;
      expect(failed.flow.kind).toBe("failed");
      const { state, effects } = decideGrooving(failed, RETRY);
      expect(state.flow).toEqual({ kind: "pair-wait", session: sessionOf(), requestId: "r11", retry: false });
      expect(effects).toEqual([requestPair("r11", sessionOf())]);
    });

    it("keeps the rules on random walks and reaches every state and every view", () => {
      const random = randomOf(20261103);
      const kinds = new Set<string>();
      const visibilities = new Set<string>();
      for (let walk = 0; walk < 400; walk++) {
        let state = initialGroovingState();
        const requestIds: string[] = [];
        for (let step = 0; step < 80; step++) {
          const events = eventsFor(state);
          const forward = forwardEventsOf(state, events);
          // Close and leave rarely and go forward half of the time, so that walks get far
          const roll = random(100);
          const event = roll < 2 ? CLOSE : roll < 4 ? LEAVE : roll < 52 ? forward[random(forward.length)] : events[random(events.length - 2)];
          const { state: next, effects } = decideGrooving(state, event);
          expectRules(state, event, next, effects);
          requestIds.push(...requestIdsOf(effects));
          kinds.add(next.flow.kind);
          visibilities.add(next.visibility);
          state = next;
        }
        // A request id is never used twice, across close, leave and again
        expect(new Set(requestIds).size).toBe(requestIds.length);
      }
      expect([...kinds].sort()).toEqual(
        ["choose", "closed", "collect", "consent", "done", "failed", "list-wait", "need-key", "pair-wait", "saved", "saving", "setup"].sort()
      );
      expect([...visibilities].sort()).toEqual([GroovingVisibility.Gone, GroovingVisibility.Hidden, GroovingVisibility.Shown].sort());
    });
  });

  it("does not reuse a request id after close", () => {
    const before = run(initialGroovingState(), [SHARE, start(GroovingDirection.Mix), candidatesReady, pairArrived("r1", PAIR_1)]);
    expect(requestIdsOf(before.effects)).toEqual(["r1", "r2", "r3"]);
    const after = run(before.state, [CLOSE, SHARE, start(GroovingDirection.Mix), candidatesReady]);
    const [first] = requestIdsOf(after.effects);
    expect(first).toBe("r4");
    expect(requestIdsOf(before.effects)).not.toContain(first);
    // A late answer to the closed run is dropped
    expect(decideGrooving(after.state, pairArrived("r1", PAIR_1))).toEqual({ state: after.state, effects: [] });
  });

  it("runs a whole Grooving", () => {
    const { state, effects } = run(initialGroovingState(), [
      SHARE,
      start(GroovingDirection.Mix),
      candidatesReady,
      pairArrived("r1", PAIR_1),
      pairArrived("r2", PAIR_2),
      previewStart("a"),
      answer(GroovingAnswer.Left),
      answer(GroovingAnswer.Right),
      pairArrived("r5", PAIR_3),
      answer(GroovingAnswer.Neither),
      listArrived("r6"),
      { type: "save" },
      SAVED_EVENT
    ]);
    expect(state.flow.kind).toBe("saved");
    expect(state.queue).toBe("this-run");
    expect(effects.map(effect => effect.type)).toEqual([
      "load-moods",
      "collect",
      "request-pair",
      "request-pair",
      "request-pair",
      "preview-start",
      "preview-end",
      "request-pair",
      "request-pair",
      "request-list",
      "replace-queue",
      "save-playlist"
    ]);
    const flow = state.flow as Extract<Flow, { list: GroovingList }>;
    expect(flow.session.history.map(record => record.answer)).toEqual([GroovingAnswer.Left, GroovingAnswer.Right, GroovingAnswer.Neither]);
    expect(flow.session.shown).toEqual(["a", "b", "c", "d", "e", "f"]);
  });
});

describe("続けて流す", () => {
  const nearEnd = (overrides: Partial<GroovingContinuation> = {}): GroovingState =>
    doneWith(continuationOf({ enabled: true, listed: listedOf(10), playing: "t10", ...overrides }));

  it("starts from the last choice of the toggle when the list arrives", () => {
    const { state, effects } = decideGrooving(LIST_WAIT, listArrived("r9", LIST, true));
    expect(continuationAt(state)).toEqual({
      enabled: true,
      rounds: 0,
      phase: GroovingContinuationPhase.Idle,
      listed: LISTED,
      reactions: {},
      requestId: null,
      savedVideoIds: [],
      playlistId: null,
      playing: null
    });
    expect(effects).toEqual([{ type: "replace-queue", videoIds: LIST.videoIds }]);
  });

  it("collects the candidates when 5 tracks or fewer are left", () => {
    const state = doneWith(continuationOf({ enabled: true, listed: listedOf(10) }));
    // t5 is the fifth of ten: five tracks are left after it
    const { state: next, effects } = decideGrooving(state, trackStarted("t5"));
    expect(continuationAt(next)).toMatchObject({ enabled: true, playing: "t5", phase: GroovingContinuationPhase.Collecting, requestId: 10 });
    expect(next.nextRequestId).toBe(11);
    expect(effects).toEqual([{ type: "collect-continuation", requestId: 10, relatedOf: null }]);
  });

  it("does not collect while 6 tracks are left", () => {
    const state = doneWith(continuationOf({ enabled: true, listed: listedOf(10) }));
    const { state: next, effects } = decideGrooving(state, trackStarted("t4"));
    expect(continuationAt(next)).toMatchObject({ enabled: true, playing: "t4", phase: GroovingContinuationPhase.Idle, requestId: null });
    expect(effects).toEqual([]);
  });

  it("does not collect while the toggle is off", () => {
    const state = doneWith(continuationOf({ enabled: false, listed: listedOf(10) }));
    const { state: next, effects } = decideGrooving(state, trackStarted("t10"));
    expect(continuationAt(next).phase).toBe(GroovingContinuationPhase.Idle);
    expect(effects).toEqual([]);
  });

  it("stops after 3 rounds", () => {
    let state = doneWith(continuationOf({ enabled: true, listed: listedOf(10), playing: "t10" }));
    for (let round = 1; round <= 3; round++) {
      const collecting = decideGrooving(state, trackStarted("t10"));
      const requestId = continuationAt(collecting.state).requestId;
      expect(requestId).not.toBeNull();
      const requesting = decideGrooving(collecting.state, continuationCandidates(requestId as number, true)).state;
      state = decideGrooving(requesting, continuationArrived(requestId as number, [track(`c${round}`, GroovingTrackKind.New)])).state;
      expect(continuationAt(state).rounds).toBe(round);
      expect(continuationAt(state).phase).toBe(round === 3 ? GroovingContinuationPhase.Finished : GroovingContinuationPhase.Idle);
    }
    expect(
      continuationAt(state)
        .listed.map(track => track.videoId)
        .slice(-3)
    ).toEqual(["c1", "c2", "c3"]);
    expect(decideGrooving(state, trackStarted("t10")).effects).toEqual([]);
  });

  it("appends the continuation list and counts the round", () => {
    const state = nearEnd({ phase: GroovingContinuationPhase.Requesting, requestId: 5 });
    const tracks = [track("n1", GroovingTrackKind.New), track("n2", GroovingTrackKind.Familiar)];
    const { state: next, effects } = decideGrooving(state, continuationArrived(5, tracks));
    expect(continuationAt(next)).toMatchObject({ rounds: 1, phase: GroovingContinuationPhase.Idle, requestId: null, enabled: true });
    expect(continuationAt(next).listed.map(listed => listed.videoId)).toEqual([...listedOf(10).map(listed => listed.videoId), "n1", "n2"]);
    expect(effects).toEqual([{ type: "append-queue", videoIds: ["n1", "n2"] }]);
  });

  it("turns off when another track starts", () => {
    const state = nearEnd({ phase: GroovingContinuationPhase.Requesting, requestId: 5 });
    const { state: next, effects } = decideGrooving(state, trackStarted("other"));
    expect(continuationAt(next)).toMatchObject({ enabled: false, phase: GroovingContinuationPhase.Idle, requestId: null });
    expect(effects).toEqual([]);
  });

  it("does not turn off for a preview track", () => {
    const flow = nearEnd({ phase: GroovingContinuationPhase.Requesting, requestId: 5 }).flow;
    const state = stateOf(flow, { previewing: "preview" });
    expect(decideGrooving(state, trackStarted("preview"))).toEqual({ state, effects: [] });
  });

  it("does not turn off for the earlier queue while it is being replaced", () => {
    const flow = doneWith(continuationOf({ enabled: true, listed: listedOf(10), playing: "t10" })).flow;
    const state = stateOf({ ...(flow as Extract<Flow, { continuation: GroovingContinuation }>), replacing: true }, { queue: "this-run" });
    expect(decideGrooving(state, trackStarted("earlier"))).toEqual({ state, effects: [] });
  });

  it("takes the related tracks from the last liked track, else the last played-through track", () => {
    const state = doneWith(
      continuationOf({
        enabled: true,
        listed: listedOf(10),
        reactions: {
          t2: GroovingReaction.Liked,
          t7: GroovingReaction.PlayedThrough,
          t9: GroovingReaction.PlayedThrough
        }
      })
    );
    const collecting = decideGrooving(state, trackStarted("t10"));
    expect(collecting.effects).toEqual([{ type: "collect-continuation", requestId: 10, relatedOf: "t2" }]);

    const played = doneWith(
      continuationOf({ enabled: true, listed: listedOf(10), reactions: { t7: GroovingReaction.PlayedThrough, t9: GroovingReaction.PlayedThrough } })
    );
    expect(decideGrooving(played, trackStarted("t10")).effects).toEqual([{ type: "collect-continuation", requestId: 10, relatedOf: "t9" }]);

    const none = doneWith(continuationOf({ enabled: true, listed: listedOf(10), reactions: { t7: GroovingReaction.Skipped } }));
    expect(decideGrooving(none, trackStarted("t10")).effects).toEqual([{ type: "collect-continuation", requestId: 10, relatedOf: null }]);
  });

  it("keeps the reactions of listed tracks and ignores the others", () => {
    const state = nearEnd();
    const withReaction = decideGrooving(state, trackReaction("t2", GroovingReaction.Disliked)).state;
    expect(continuationAt(withReaction).reactions).toEqual({ t2: GroovingReaction.Disliked });
    expect(decideGrooving(withReaction, trackReaction("other", GroovingReaction.Liked))).toEqual({ state: withReaction, effects: [] });
  });

  it("asks again once when the answer is unusable, then fails and turns off", () => {
    const state = nearEnd({ phase: GroovingContinuationPhase.Collecting, requestId: 5 });
    const asked = decideGrooving(state, continuationCandidates(5, true));
    expect(continuationAt(asked.state).phase).toBe(GroovingContinuationPhase.Requesting);
    expect(asked.effects).toEqual([{ type: "request-continuation", requestId: 5, retry: false }]);

    const retried = decideGrooving(asked.state, continuationUnusable(5));
    expect(continuationAt(retried.state).phase).toBe(GroovingContinuationPhase.RequestingRetry);
    expect(retried.effects).toEqual([{ type: "request-continuation", requestId: 5, retry: true }]);

    const failed = decideGrooving(retried.state, continuationUnusable(5));
    expect(continuationAt(failed.state)).toMatchObject({ enabled: false, phase: GroovingContinuationPhase.Failed, requestId: null });
    expect(failed.effects).toEqual([]);
  });

  it("turns off when the LLM cannot be asked", () => {
    const state = nearEnd({ phase: GroovingContinuationPhase.RequestingRetry, requestId: 5 });
    const { state: next, effects } = decideGrooving(state, continuationFailed(5));
    expect(continuationAt(next)).toMatchObject({ enabled: false, phase: GroovingContinuationPhase.Failed, requestId: null });
    expect(effects).toEqual([]);
  });

  it("turns off when the candidates are short, and when they cannot be collected", () => {
    const collecting = (): GroovingState => nearEnd({ phase: GroovingContinuationPhase.Collecting, requestId: 5 });
    const short = decideGrooving(collecting(), continuationCandidates(5, false, "short"));
    expect(continuationAt(short.state)).toMatchObject({ enabled: false, phase: GroovingContinuationPhase.Short, requestId: null });
    const failed = decideGrooving(collecting(), continuationCandidates(5, false, "failed"));
    expect(continuationAt(failed.state)).toMatchObject({ enabled: false, phase: GroovingContinuationPhase.Failed, requestId: null });
  });

  it("collects at once when turned on again near the end", () => {
    const state = nearEnd({ enabled: false, phase: GroovingContinuationPhase.Failed, playing: "t9" });
    const { state: next, effects } = decideGrooving(state, continueToggle(true));
    expect(continuationAt(next)).toMatchObject({ enabled: true, phase: GroovingContinuationPhase.Collecting, requestId: 10 });
    expect(effects).toEqual([{ type: "collect-continuation", requestId: 10, relatedOf: null }]);
  });

  it("only waits when turned on again with 6 tracks or more left", () => {
    const state = nearEnd({ enabled: false, phase: GroovingContinuationPhase.Short, playing: "t1" });
    const { state: next, effects } = decideGrooving(state, continueToggle(true));
    expect(continuationAt(next)).toMatchObject({ enabled: true, phase: GroovingContinuationPhase.Idle, requestId: null });
    expect(effects).toEqual([]);
  });

  it("drops an answer that arrives after the toggle went off", () => {
    const state = nearEnd({ phase: GroovingContinuationPhase.Requesting, requestId: 5 });
    const off = decideGrooving(state, continueToggle(false));
    expect(continuationAt(off.state)).toMatchObject({ enabled: false, phase: GroovingContinuationPhase.Idle, requestId: null });
    expect(decideGrooving(off.state, continuationArrived(5, [track("n1", GroovingTrackKind.New)]))).toEqual({ state: off.state, effects: [] });
    expect(decideGrooving(off.state, continuationCandidates(5, true))).toEqual({ state: off.state, effects: [] });
  });

  it("does not collect when turned on while a track outside the list plays", () => {
    let state = doneWith(continuationOf({ listed: listedOf(25) }));
    state = decideGrooving(state, trackStarted("t22")).state;
    state = decideGrooving(state, trackStarted("other")).state;
    const decision = decideGrooving(state, continueToggle(true));
    expect(decision.effects).toEqual([]);
    expect(continuationAt(decision.state)).toMatchObject({ enabled: true, phase: GroovingContinuationPhase.Idle, playing: null });
  });

  it("keeps the phase of a stopped continuation when a track outside the list starts", () => {
    for (const phase of [GroovingContinuationPhase.Failed, GroovingContinuationPhase.Short, GroovingContinuationPhase.Finished]) {
      const state = doneWith(continuationOf({ listed: listedOf(25), phase, rounds: phase === GroovingContinuationPhase.Finished ? 3 : 0 }));
      const next = decideGrooving(state, trackStarted("other")).state;
      expect(continuationAt(next).phase).toBe(phase);
      expect(continuationAt(next).playing).toBeNull();
    }
    const hidden = hiddenOf(doneWith(continuationOf({ listed: listedOf(25), phase: GroovingContinuationPhase.Failed })));
    const failed = decideGrooving(hidden, trackStarted("other")).state;
    expect(continuationAt(failed).phase).toBe(GroovingContinuationPhase.Failed);
    expect(toGroovingViewState(failed, EXTRA).mark).toBe(GROOVING_MARK_TEXT.en.error);
  });

  it("keeps going while the screen is hidden", () => {
    const state = hiddenOf(nearEnd({ phase: GroovingContinuationPhase.Collecting, requestId: 5 }));
    const asked = decideGrooving(state, continuationCandidates(5, true));
    expect(continuationAt(asked.state).phase).toBe(GroovingContinuationPhase.Requesting);
    expect(asked.effects).toEqual([{ type: "request-continuation", requestId: 5, retry: false }]);
    const asked2 = decideGrooving(
      { ...asked.state, visibility: GroovingVisibility.Hidden },
      continuationArrived(5, [track("n1", GroovingTrackKind.New)])
    );
    expect(continuationAt(asked2.state).rounds).toBe(1);
  });
});

describe("saving with 続けて流す", () => {
  const listed = listedOf(4);
  const savedWith = (overrides: Partial<GroovingContinuation> = {}): GroovingState =>
    stateOf(
      {
        kind: "saved",
        session: ANSWERED_ALL,
        list: LIST,
        continuation: continuationOf({ listed, savedVideoIds: ["t1", "t2"], playlistId: "p1", ...overrides }),
        saveFailed: false,
        queueFailed: false,
        replacing: false
      },
      { queue: "this-run" }
    );

  it("saves every listed track, continuation lists included", () => {
    const state = doneWith(continuationOf({ listed }));
    const { state: saving, effects } = decideGrooving(state, { type: "save" });
    expect(saving.flow.kind).toBe("saving");
    expect(effects).toEqual([{ type: "save-playlist", title: LIST.moodDescription, videoIds: ["t1", "t2", "t3", "t4"] }]);
  });

  it("remembers the playlist and the tracks it saved", () => {
    const saving = decideGrooving(doneWith(continuationOf({ listed })), { type: "save" }).state;
    const { state: saved, effects } = decideGrooving(saving, { type: "saved", playlistId: "p1" });
    expect(effects).toEqual([]);
    expect(saved.flow.kind).toBe("saved");
    expect(continuationAt(saved)).toMatchObject({ savedVideoIds: ["t1", "t2", "t3", "t4"], playlistId: "p1" });
  });

  it("adds only the tracks the playlist does not have, and never makes a second playlist", () => {
    const state = savedWith();
    const saving = decideGrooving(state, { type: "save" });
    expect(saving.state.flow.kind).toBe("saving");
    expect(saving.effects).toEqual([{ type: "add-to-playlist", playlistId: "p1", videoIds: ["t3", "t4"] }]);
    const saved = decideGrooving(saving.state, { type: "playlist-added" }).state;
    expect(saved.flow.kind).toBe("saved");
    expect(continuationAt(saved)).toMatchObject({ savedVideoIds: ["t1", "t2", "t3", "t4"], playlistId: "p1" });
    // Nothing is left to add: the button is done and save does nothing
    expect(decideGrooving(saved, { type: "save" })).toEqual({ state: saved, effects: [] });
  });

  it("goes back to saved when the add fails, not to done", () => {
    const adding = decideGrooving(savedWith(), { type: "save" }).state;
    const failed = decideGrooving(adding, { type: "playlist-add-failed" });
    expect(failed.state.flow.kind).toBe("saved");
    expect(failed.state.flow).toMatchObject({ saveFailed: true });
    expect(continuationAt(failed.state).playlistId).toBe("p1");
    expect(toGroovingViewState(failed.state, EXTRA)).toMatchObject({
      screen: "done",
      saved: "failed",
      saveAction: GroovingSaveAction.Add
    });
  });

  it("goes back to saved when the page reloads while adding, not to done", () => {
    const adding = decideGrooving(savedWith(), { type: "save" }).state;
    const reloaded = decideGrooving(adding, PAGE_RELOADED).state;
    expect(reloaded.flow.kind).toBe("saved");
    expect(reloaded.flow).toMatchObject({ saveFailed: true });
    expect(continuationAt(reloaded).playlistId).toBe("p1");
  });

  it("does not count tracks that arrive while saving as saved", () => {
    const arrived = (from: number): GroovingCandidate[] => Array.from({ length: 25 }, (_, index) => track(`n${from + index}`, GroovingTrackKind.New));
    // The first save: the continuation arrives while saving, after the playlist was sent the 25 listed tracks
    const state = doneWith(
      continuationOf({ enabled: true, listed: listedOf(25), playing: "t25", phase: GroovingContinuationPhase.Requesting, requestId: 5 })
    );
    const saving = decideGrooving(state, { type: "save" }).state;
    const expanded = decideGrooving(saving, continuationArrived(5, arrived(1))).state;
    expect(continuationAt(expanded).listed).toHaveLength(50);
    const saved = decideGrooving(expanded, { type: "saved", playlistId: "p1" }).state;
    expect(continuationAt(saved).savedVideoIds).toEqual(listedOf(25).map(listed => listed.videoId));
    expect(toGroovingViewState(saved, EXTRA)).toMatchObject({ screen: "done", saveAction: GroovingSaveAction.Add });

    // The add: more tracks arrive while the missing ones are being added
    const adding = savedWith({
      listed: [...listedOf(25), ...arrived(1)],
      savedVideoIds: listedOf(25).map(listed => listed.videoId),
      enabled: true,
      rounds: 1,
      phase: GroovingContinuationPhase.Requesting,
      requestId: 5
    });
    const addingState = decideGrooving(adding, { type: "save" });
    expect(addingState.effects).toEqual([{ type: "add-to-playlist", playlistId: "p1", videoIds: arrived(1).map(listed => listed.videoId) }]);
    const grown = decideGrooving(addingState.state, continuationArrived(5, arrived(26))).state;
    const added = decideGrooving(grown, { type: "playlist-added" }).state;
    expect(continuationAt(added).savedVideoIds).toEqual([...listedOf(25), ...arrived(1)].map(listed => listed.videoId));
    expect(toGroovingViewState(added, EXTRA)).toMatchObject({ screen: "done", saveAction: GroovingSaveAction.Add });
  });

  it("shows add while new tracks wait, and saved once they are in the playlist", () => {
    const state = savedWith();
    expect(toGroovingViewState(state, EXTRA)).toMatchObject({ saveAction: GroovingSaveAction.Add });
    const saved = decideGrooving(decideGrooving(state, { type: "save" }).state, { type: "playlist-added" }).state;
    expect(toGroovingViewState(saved, EXTRA)).toMatchObject({ saveAction: GroovingSaveAction.Saved, saved: "saved" });
  });
});

describe("leaving and opening again", () => {
  const shownPastConsent: [string, GroovingState][] = SAMPLE_STATES.filter(
    state =>
      state.visibility === GroovingVisibility.Shown && state.flow.kind !== "closed" && state.flow.kind !== "need-key" && state.flow.kind !== "consent"
  ).map(state => [state.flow.kind, state]);

  it.each(shownPastConsent)("hides %s on leave and shows it again on open", (_name, state) => {
    const hidden = decideGrooving(state, LEAVE);
    expect(hidden.state.flow).toEqual(state.flow);
    expect(hidden.state.visibility).toBe(GroovingVisibility.Hidden);
    expect(hidden.state.notice).toBe(state.notice);
    expect(hidden.effects).toEqual(state.previewing === null ? [] : [PREVIEW_END]);

    const shown = decideGrooving(hidden.state, SHARE);
    expect(shown.state.flow).toEqual(state.flow);
    expect(shown.state.visibility).toBe(GroovingVisibility.Shown);
    expect(shown.state.notice).toBe(state.notice);
    expect(shown.effects).toEqual([]);
  });

  it.each([
    ["need key", NEED_KEY],
    ["consent", CONSENT]
  ] as [string, GroovingState][])("closes the %s screen on leave", (_name, state) => {
    const { state: next, effects } = decideGrooving(state, LEAVE);
    expect(next.flow).toEqual({ kind: "closed" });
    expect(next.visibility).toBe(GroovingVisibility.Gone);
    expect(next.notice).toBe(state.notice);
    expect(effects).toEqual([]);
  });
});

describe("the notice of the previous run", () => {
  it("is false unless the start says otherwise", () => {
    expect(initialGroovingState().notice).toBe(false);
    expect(initialGroovingState({ notice: true }).notice).toBe(true);
  });

  it("shows on the setup screen", () => {
    const { state } = decideGrooving(initialGroovingState({ notice: true }), SHARE);
    expect(state.flow.kind).toBe("setup");
    expect(toGroovingViewState(state, EXTRA)).toMatchObject({ screen: "setup", notice: true });
  });

  it.each([
    ["dismiss-notice", DISMISS_NOTICE],
    ["start", start(GroovingDirection.Mix)],
    ["close", CLOSE]
  ] as [string, GroovingEvent][])("clears the notice on %s", (_name, event) => {
    const { state } = decideGrooving(SETUP_NOTICE, event);
    expect(state.notice).toBe(false);
  });

  it("keeps the flow and the view when it is dismissed", () => {
    const { state, effects } = decideGrooving(SETUP_NOTICE, DISMISS_NOTICE);
    expect(state.flow).toEqual(SETUP_NOTICE.flow);
    expect(state.visibility).toBe(GroovingVisibility.Shown);
    expect(effects).toEqual([]);
  });
});

describe("groovingStopsThrottling", () => {
  it.each([
    ["shown", SETUP, true],
    ["closed", CLOSED, false],
    ["hidden setup", HIDDEN_SETUP, false],
    ["hidden collect", HIDDEN_COLLECT, true],
    ["hidden pair wait", HIDDEN_PAIR_WAIT, true],
    ["hidden choose with a prefetch pending", HIDDEN_CHOOSE, true],
    ["hidden choose with no prefetch pending", hiddenOf(chooseOf(ready(PAIR_2), ready(PAIR_3))), false],
    ["hidden choose while previewing", hiddenOf(CHOOSE_PREVIEWING), true],
    ["hidden list wait", HIDDEN_LIST_WAIT, true],
    ["hidden failed", HIDDEN_FAILED_COLLECT, false],
    ["hidden done while replacing the queue", hiddenOf(DONE_REPLACING), true],
    ["hidden done", HIDDEN_DONE, false],
    ["hidden done collecting the continuation", hiddenOf(DONE_COLLECTING), true],
    ["hidden done requesting the continuation", hiddenOf(DONE_REQUESTING), true],
    ["hidden done retrying the continuation", hiddenOf(DONE_REQUESTING_RETRY), true],
    ["hidden done with the continuation failed", hiddenOf(DONE_CONTINUATION_FAILED), false],
    ["hidden done with the continuation finished", hiddenOf(DONE_CONTINUATION_FINISHED), false],
    ["hidden saving", HIDDEN_SAVING, true],
    ["hidden saved while replacing the queue", hiddenOf(SAVED_REPLACING), true],
    ["hidden saved", HIDDEN_SAVED, false],
    ["choosing while previewing", CHOOSE_PREVIEWING, true]
  ] as [string, GroovingState, boolean][])("%s", (_name, state, expected) => {
    expect(groovingStopsThrottling(state)).toBe(expected);
  });
});

describe("groovingRunInProgress", () => {
  it.each([
    ["collect", COLLECT],
    ["pair wait", PAIR_WAIT],
    ["pair retry", PAIR_RETRY],
    ["choose", CHOOSE],
    ["list wait", LIST_WAIT],
    ["list retry", LIST_RETRY],
    ["failed collect", FAILED_COLLECT],
    ["failed pair", FAILED_PAIR],
    ["failed list", FAILED_LIST],
    ["failed without a session", FAILED_NO_SESSION],
    ["done", DONE],
    ["saving", SAVING]
  ] as [string, GroovingState][])("%s is in progress", (_name, state) => {
    expect(groovingRunInProgress(state)).toBe(true);
  });

  it.each([
    ["closed", CLOSED],
    ["need key", NEED_KEY],
    ["consent", CONSENT],
    ["setup", SETUP],
    ["saved", SAVED]
  ] as [string, GroovingState][])("%s is not in progress", (_name, state) => {
    expect(groovingRunInProgress(state)).toBe(false);
  });

  it("does not depend on the view", () => {
    expect(groovingRunInProgress(HIDDEN_COLLECT)).toBe(true);
    expect(groovingRunInProgress(hiddenOf(SETUP))).toBe(false);
  });
});

describe("toGroovingViewState", () => {
  it.each<[string, GroovingState, GroovingScreenView]>([
    ["closed", CLOSED, { screen: "closed" }],
    ["need key", NEED_KEY, { screen: "key-missing", safeStorageAvailable: true }],
    ["consent", CONSENT, { screen: "consent", providerLabel: "Gemini" }],
    [
      "setup",
      SETUP_NO_HISTORY,
      {
        screen: "setup",
        moods: [MOOD_ITEM],
        moodsFailed: false,
        historyShared: false,
        providerLabel: "Gemini",
        model: "gemini-3.5-flash-lite",
        notice: false,
        seed: NO_SEED
      }
    ],
    ["collect", COLLECT, { screen: "working", step: GroovingStep.Collect, round: null, rounds: null, filledFromMood: false, fromSong: false }],
    [
      "pair wait (second round)",
      stateOf({
        kind: "pair-wait",
        session: sessionOf({ history: [{ pair: PAIR_1, answer: GroovingAnswer.Left }], filledFromMood: true }),
        requestId: "r9",
        retry: true
      }),
      { screen: "working", step: GroovingStep.Pair, round: 2, rounds: 3, filledFromMood: true, fromSong: false }
    ],
    [
      "choose",
      CHOOSE_PREVIEWING,
      {
        screen: "choose",
        round: 1,
        rounds: 3,
        moodLabel: "Chill",
        direction: GroovingDirection.Mix,
        left: CANDIDATES[0],
        right: CANDIDATES[1],
        previewing: "a",
        filledFromMood: false,
        fromSong: false
      }
    ],
    [
      "choose (mood in words, last round)",
      stateOf({ kind: "choose", session: { ...SHOWING_LAST, mood: TEXT_MOOD }, pair: PAIR_3, prefetch: { left: null, right: null } }),
      {
        screen: "choose",
        round: 3,
        rounds: 3,
        moodLabel: "rainy night",
        direction: GroovingDirection.Mix,
        left: CANDIDATES[4],
        right: CANDIDATES[5],
        previewing: null,
        filledFromMood: false,
        fromSong: false
      }
    ],
    [
      "choose (a track not in the candidates)",
      stateOf({ kind: "choose", session: SHOWING, pair: { left: "a", right: "zz", reason: "" }, prefetch: { left: null, right: null } }),
      { screen: "working", step: GroovingStep.Pair, round: 1, rounds: 3, filledFromMood: false, fromSong: false }
    ],
    ["list wait", LIST_RETRY, { screen: "working", step: GroovingStep.List, round: null, rounds: null, filledFromMood: false, fromSong: false }],
    [
      "failed (collect)",
      FAILED_COLLECT,
      { screen: "failed", step: GroovingStep.Collect, reason: GroovingFailureReason.YtmUnreadable, round: null, rounds: null }
    ],
    ["failed (pair)", FAILED_PAIR, { screen: "failed", step: GroovingStep.Pair, reason: GroovingFailureReason.Unusable, round: 1, rounds: 3 }],
    ["failed (list)", FAILED_LIST, { screen: "failed", step: GroovingStep.List, reason: GroovingFailureReason.Network, round: null, rounds: null }],
    [
      "failed (no session)",
      FAILED_NO_SESSION,
      { screen: "failed", step: GroovingStep.Pair, reason: GroovingFailureReason.Network, round: null, rounds: null }
    ]
  ])("%s", (_name, state, view) => {
    expect(toGroovingViewState(state, EXTRA)).toEqual({
      ...view,
      visibility: view.screen === "closed" ? GroovingVisibility.Gone : GroovingVisibility.Shown,
      mark: null
    });
  });

  it.each<[string, GroovingState, "no" | "saving" | "saved" | "failed", GroovingSaveAction]>([
    ["done", DONE, "no", GroovingSaveAction.Save],
    ["done (save failed)", DONE_SAVE_FAILED, "failed", GroovingSaveAction.Save],
    ["saving", SAVING, "saving", GroovingSaveAction.Save],
    ["saved", SAVED, "saved", GroovingSaveAction.Saved]
  ])("%s", (_name, state, saved, saveAction) => {
    expect(toGroovingViewState(state, EXTRA)).toEqual({
      screen: "done",
      moodLabel: "Chill",
      moodDescription: LIST.moodDescription,
      listed: LISTED,
      familiarCount: 2,
      newCount: 1,
      usage: { inputTokens: 1200, outputTokens: 300, estimatedUsd: 0.001, model: "gemini-3.5-flash-lite" },
      saved,
      saveAction,
      continuation: { enabled: false, rounds: 0, maxRounds: 3, phase: GroovingContinuationPhase.Idle },
      queueFailed: false,
      visibility: GroovingVisibility.Shown,
      mark: null
    });
  });

  it("lists the continuation tracks after the Grooving list", () => {
    const continued = [...LISTED, track("x1", GroovingTrackKind.New)];
    const state = doneWith(continuationOf({ listed: continued, enabled: true, rounds: 2, playing: "x1" }));
    expect(toGroovingViewState(state, EXTRA)).toMatchObject({
      screen: "done",
      listed: continued,
      familiarCount: 2,
      newCount: 2,
      continuation: { enabled: true, rounds: 2, maxRounds: 3, phase: GroovingContinuationPhase.Idle }
    });
  });

  it("passes the phase of the continuation to the screen", () => {
    for (const phase of Object.values(GroovingContinuationPhase)) {
      const state = doneWith(continuationOf({ enabled: phase !== GroovingContinuationPhase.Failed, phase }));
      expect(toGroovingViewState(state, EXTRA)).toMatchObject({ screen: "done", continuation: { phase } });
    }
  });

  it("tells on the done screen that saving failed, until it saves again", () => {
    const failedSave = run(DONE, [{ type: "save" }, { type: "save-failed" }]).state;
    expect(failedSave.flow).toEqual({
      kind: "done",
      session: ANSWERED_ALL,
      list: LIST,
      continuation: continuationOf(),
      saveFailed: true,
      queueFailed: false,
      replacing: false
    });
    expect(toGroovingViewState(failedSave, EXTRA)).toMatchObject({ screen: "done", saved: "failed" });
    const { state: saving, effects } = decideGrooving(failedSave, { type: "save" });
    expect(saving.flow).toEqual({
      kind: "saving",
      session: ANSWERED_ALL,
      list: LIST,
      continuation: continuationOf(),
      saveFailed: false,
      queueFailed: false,
      replacing: false,
      sendingVideoIds: LIST.videoIds
    });
    expect(effects).toEqual([{ type: "save-playlist", title: LIST.moodDescription, videoIds: LIST.videoIds }]);
    expect(toGroovingViewState(saving, EXTRA)).toMatchObject({ screen: "done", saved: "saving" });
  });

  it("passes an unknown cost and the moods failure through", () => {
    const extra = { ...EXTRA, moods: null, moodsFailed: true, usage: { inputTokens: 5, outputTokens: 6, estimatedUsd: null } };
    expect(toGroovingViewState(SETUP, extra)).toMatchObject({ screen: "setup", moods: null, moodsFailed: true, historyShared: true });
    expect(toGroovingViewState(DONE, extra)).toMatchObject({
      usage: { inputTokens: 5, outputTokens: 6, estimatedUsd: null, model: "gemini-3.5-flash-lite" }
    });
  });

  it("names a blend of a mood and a genre on the choose screen", () => {
    const genre: GroovingMoodItem = { name: "J-Pop", section: GroovingMoodSection.Genres, params: "jpop-params" };
    const blend: GroovingMood = { kind: "blend", items: [MOOD_ITEM, genre] };
    const { state } = run(initialGroovingState(), [SHARE, start(GroovingDirection.Mix, blend), candidatesReady, pairArrived("r1", PAIR_1)]);
    expect(toGroovingViewState(state, EXTRA)).toMatchObject({ screen: "choose", moodLabel: "Chill × J-Pop" });
  });

  it("names a blend of a mood and a genre on the done screen", () => {
    const genre: GroovingMoodItem = { name: "J-Pop", section: GroovingMoodSection.Genres, params: "jpop-params" };
    const blend: GroovingMood = { kind: "blend", items: [MOOD_ITEM, genre] };
    const listWait = stateOf({ kind: "list-wait", session: { ...ANSWERED_ALL, mood: blend }, requestId: "r9", retry: false });
    const { state } = decideGrooving(listWait, listArrived("r9"));
    expect(toGroovingViewState(state, EXTRA)).toMatchObject({ screen: "done", moodLabel: "Chill × J-Pop", queueFailed: false });
    const words = stateOf({
      kind: "done",
      session: { ...ANSWERED_ALL, mood: TEXT_MOOD },
      list: LIST,
      continuation: continuationOf(),
      saveFailed: false,
      queueFailed: false,
      replacing: false
    });
    expect(toGroovingViewState(words, EXTRA)).toMatchObject({ screen: "done", moodLabel: "rainy night" });
  });

  it("tells on the done screen that the queue was not replaced, until retry replaces it", () => {
    const { state } = run(DONE, [{ type: "queue-failed" }]);
    expect(toGroovingViewState(state, EXTRA)).toMatchObject({ screen: "done", saved: "no", queueFailed: true });
    const saving = decideGrooving(state, { type: "save" }).state;
    expect(toGroovingViewState(saving, EXTRA)).toMatchObject({ screen: "done", saved: "saving", queueFailed: true });
    const failedSave = decideGrooving(saving, { type: "save-failed" }).state;
    expect(toGroovingViewState(failedSave, EXTRA)).toMatchObject({ screen: "done", saved: "failed", queueFailed: true });
    const { state: retried, effects } = decideGrooving(failedSave, RETRY);
    expect(effects).toEqual([{ type: "replace-queue", videoIds: LIST.videoIds }]);
    expect(toGroovingViewState(retried, EXTRA)).toMatchObject({ screen: "done", saved: "failed", queueFailed: false });
  });

  it.each([
    ["collect", HIDDEN_COLLECT, GROOVING_MARK_TEXT.en.preparing],
    ["pair wait", HIDDEN_PAIR_WAIT, GROOVING_MARK_TEXT.en.preparing],
    ["list wait", HIDDEN_LIST_WAIT, GROOVING_MARK_TEXT.en.preparing],
    ["choose", HIDDEN_CHOOSE, "1 / 3"],
    [
      "choose (second round)",
      hiddenOf(
        stateOf({
          kind: "choose",
          session: sessionOf({ history: [{ pair: PAIR_1, answer: GroovingAnswer.Left }] }),
          pair: PAIR_2,
          prefetch: { left: null, right: null }
        })
      ),
      "2 / 3"
    ],
    ["done", HIDDEN_DONE, GROOVING_MARK_TEXT.en.ready],
    ["done collecting the continuation", hiddenOf(DONE_COLLECTING), GROOVING_MARK_TEXT.en.preparing],
    ["done requesting the continuation", hiddenOf(DONE_REQUESTING), GROOVING_MARK_TEXT.en.preparing],
    ["done retrying the continuation", hiddenOf(DONE_REQUESTING_RETRY), GROOVING_MARK_TEXT.en.preparing],
    ["done with the continuation failed", hiddenOf(DONE_CONTINUATION_FAILED), GROOVING_MARK_TEXT.en.error],
    ["done with the continuation short", hiddenOf(DONE_CONTINUATION_SHORT), GROOVING_MARK_TEXT.en.ready],
    ["done with the continuation finished", hiddenOf(DONE_CONTINUATION_FINISHED), GROOVING_MARK_TEXT.en.ready],
    ["saving", HIDDEN_SAVING, GROOVING_MARK_TEXT.en.ready],
    ["saved", HIDDEN_SAVED, GROOVING_MARK_TEXT.en.ready],
    ["failed", HIDDEN_FAILED_COLLECT, GROOVING_MARK_TEXT.en.error],
    ["setup", HIDDEN_SETUP, null]
  ] as [string, GroovingState, string | null][])("marks %s while hidden", (_name, state, mark) => {
    expect(toGroovingViewState(state, EXTRA)).toMatchObject({ visibility: GroovingVisibility.Hidden, mark });
  });

  it("marks in the language of the page while hidden", () => {
    const ja = { ...EXTRA, language: GroovingLanguage.Japanese };
    expect(toGroovingViewState(HIDDEN_COLLECT, ja)).toMatchObject({ visibility: GroovingVisibility.Hidden, mark: GROOVING_MARK_TEXT.ja.preparing });
    expect(toGroovingViewState(HIDDEN_DONE, ja)).toMatchObject({ mark: GROOVING_MARK_TEXT.ja.ready });
    expect(toGroovingViewState(HIDDEN_FAILED_COLLECT, ja)).toMatchObject({ mark: GROOVING_MARK_TEXT.ja.error });
    expect(toGroovingViewState(HIDDEN_CHOOSE, ja)).toMatchObject({ visibility: GroovingVisibility.Hidden, mark: "1 / 3" });
    expect(toGroovingViewState(HIDDEN_SETUP, ja)).toMatchObject({ visibility: GroovingVisibility.Hidden, mark: null });
  });

  it("has no mark while shown or closed", () => {
    expect(toGroovingViewState(SETUP, EXTRA)).toMatchObject({ visibility: GroovingVisibility.Shown, mark: null });
    expect(toGroovingViewState(CHOOSE, EXTRA)).toMatchObject({ visibility: GroovingVisibility.Shown, mark: null });
    expect(toGroovingViewState(CLOSED, EXTRA)).toMatchObject({ visibility: GroovingVisibility.Gone, mark: null });
  });
});

describe("a song as the mood (From a song)", () => {
  const SEED_REQUEST = { direction: GroovingDirection.Mix, historyShared: true, mood: SONG_MOOD };

  it("starts collecting from the setup screen, with the song in the request", () => {
    const { state, effects } = decideGrooving(SETUP, start(GroovingDirection.Mix, SONG_MOOD));
    expect(state.flow).toEqual({ kind: "collect", session: { ...EMPTY_SESSION, mood: SONG_MOOD } });
    expect(effects).toEqual([{ type: "collect", request: SEED_REQUEST }]);
  });

  it("starts with a recognized song that has no videoId", () => {
    const mood: GroovingMood = { kind: "song", song: RECOGNIZED_SONG };
    const { effects } = decideGrooving(SETUP, start(GroovingDirection.Familiar, mood, 5));
    expect(effects).toEqual([{ type: "collect", request: { direction: GroovingDirection.Familiar, historyShared: true, mood } }]);
  });

  it("starts without history only in the discover direction, like any mood", () => {
    expect(decideGrooving(SETUP_NO_HISTORY, start(GroovingDirection.Mix, SONG_MOOD))).toEqual({ state: SETUP_NO_HISTORY, effects: [] });
    expect(decideGrooving(SETUP_NO_HISTORY, start(GroovingDirection.Discover, SONG_MOOD)).effects).toHaveLength(1);
  });

  it("fails with seed-not-found while collecting, and shows the reason", () => {
    const { state } = run(SETUP, [start(GroovingDirection.Mix, SONG_MOOD), { type: "collect-failed", reason: GroovingFailureReason.SeedNotFound }]);
    expect(state.flow).toEqual({
      kind: "failed",
      session: { ...EMPTY_SESSION, mood: SONG_MOOD },
      step: GroovingStep.Collect,
      reason: GroovingFailureReason.SeedNotFound
    });
    expect(toGroovingViewState(state, EXTRA)).toMatchObject({
      screen: "failed",
      step: GroovingStep.Collect,
      reason: "seed-not-found",
      round: null,
      rounds: null
    });
  });

  it("collects again with the same song on retry", () => {
    const failedState = run(SETUP, [
      start(GroovingDirection.Mix, SONG_MOOD),
      { type: "collect-failed", reason: GroovingFailureReason.SeedNotFound }
    ]).state;
    const { state, effects } = decideGrooving(failedState, RETRY);
    expect(state.flow).toEqual({ kind: "collect", session: { ...EMPTY_SESSION, mood: SONG_MOOD } });
    expect(effects).toEqual([{ type: "collect", request: SEED_REQUEST }]);
  });

  it("goes on to the pairs once the candidates are ready", () => {
    const { state, effects } = run(SETUP, [start(GroovingDirection.Mix, SONG_MOOD), candidatesReady]);
    expect(state.flow.kind).toBe("pair-wait");
    expect(effects.at(-1)).toMatchObject({ type: "request-pair", session: { mood: SONG_MOOD } });
  });

  it("shows fromSong with the artist fill while working and choosing", () => {
    const state = run(SETUP, [start(GroovingDirection.Mix, SONG_MOOD), candidatesReady]).state;
    expect(toGroovingViewState(state, EXTRA)).toMatchObject({ screen: "working", fromSong: true, filledFromMood: true });
    const choose = run(SETUP, [start(GroovingDirection.Mix, SONG_MOOD), candidatesReady, pairArrived("r10", PAIR_1)]).state;
    expect(toGroovingViewState(choose, EXTRA)).toMatchObject({ screen: "choose", fromSong: true, filledFromMood: true });
  });

  it("names the mood after the song on the choose screen and the done screen, in the display language", () => {
    const choose = run(SETUP, [start(GroovingDirection.Mix, SONG_MOOD), candidatesReady, pairArrived("r10", PAIR_1)]).state;
    expect(toGroovingViewState(choose, EXTRA)).toMatchObject({ screen: "choose", moodLabel: "From Blue Hour / Alpha" });
    expect(toGroovingViewState(choose, { ...EXTRA, language: GroovingLanguage.Japanese })).toMatchObject({ moodLabel: "Blue Hour / Alpha から" });
    const done = doneWith(continuationOf());
    const song = stateOf({ ...(done.flow as Extract<Flow, { list: GroovingList }>), session: { ...ANSWERED_ALL, mood: SONG_MOOD } });
    expect(toGroovingViewState(song, EXTRA)).toMatchObject({ screen: "done", moodLabel: "From Blue Hour / Alpha" });
    expect(toGroovingViewState(song, { ...EXTRA, language: GroovingLanguage.Japanese })).toMatchObject({ moodLabel: "Blue Hour / Alpha から" });
  });
});

describe("seed-options", () => {
  const options = (overrides: Partial<GroovingSeedOptions> = {}): GroovingEvent => ({
    type: "seed-options",
    playing: PLAYING_SONG,
    recognized: RECOGNIZED_SONG,
    canRecognize: true,
    ...overrides
  });

  it("shows on the setup screen", () => {
    const { state, effects } = decideGrooving(SETUP, options());
    expect(effects).toEqual([]);
    expect(state.flow).toEqual(SETUP.flow);
    expect(toGroovingViewState(state, EXTRA)).toMatchObject({
      screen: "setup",
      seed: { playing: PLAYING_SONG, recognized: RECOGNIZED_SONG, canRecognize: true }
    });
  });

  it("starts with nothing to offer", () => {
    expect(toGroovingViewState(SETUP, EXTRA)).toMatchObject({ seed: { playing: null, recognized: null, canRecognize: false } });
  });

  it("is replaced by the next one", () => {
    const { state } = run(SETUP, [options(), options({ playing: null, canRecognize: false })]);
    expect(toGroovingViewState(state, EXTRA)).toMatchObject({ seed: { playing: null, recognized: RECOGNIZED_SONG, canRecognize: false } });
  });

  it.each<[string, GroovingState]>([
    ["closed", CLOSED],
    ["need key", NEED_KEY],
    ["consent", CONSENT],
    ["hidden setup", HIDDEN_SETUP],
    ["collect", COLLECT],
    ["choose", CHOOSE],
    ["done", DONE],
    ["failed", FAILED_COLLECT]
  ])("is kept in %s without changing anything else", (_name, state) => {
    const { state: next, effects } = decideGrooving(state, options());
    expect(effects).toEqual([]);
    expect(next).toEqual({ ...state, seed: { playing: PLAYING_SONG, recognized: RECOGNIZED_SONG, canRecognize: true } });
  });

  it("is on the setup screen that opens afterwards", () => {
    const { state } = run(CLOSED, [options(), SHARE]);
    expect(state.flow).toEqual({ kind: "setup", historyShared: true });
    expect(toGroovingViewState(state, EXTRA)).toMatchObject({ screen: "setup", seed: { playing: PLAYING_SONG, canRecognize: true } });
  });

  it("is kept when the run ends and starts again", () => {
    const { state } = run(DONE, [options(), { type: "again" }]);
    expect(toGroovingViewState(state, EXTRA)).toMatchObject({ screen: "setup", seed: { recognized: RECOGNIZED_SONG } });
  });
});
