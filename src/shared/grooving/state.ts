// Decides the next Grooving state and the effects main runs, from the current state and an event.
// One state holds the three parts of the state chart in docs/specs/grooving.md: the flow, the preview and the queue

import { GroovingAnswer, GroovingConsentChoice, GroovingDirection, GroovingFailureReason, GroovingStep, GroovingTrackKind } from "./index";
import { GroovingCandidate, GroovingConsent, GroovingList, GroovingMood, GroovingMoodItem, GroovingPair } from "./index";
import {
  GROOVING_MARK_TEXT,
  groovingMoodLabel,
  GroovingRoundRecord,
  GroovingRounds,
  GroovingSaveStatus,
  GroovingScreen,
  GroovingSourceRequest
} from "./index";
import { GroovingDisplayLanguage, GroovingScreenView, GroovingViewState, GroovingVisibility } from "./index";

export type GroovingSession = {
  mood: GroovingMood;
  direction: GroovingDirection;
  rounds: GroovingRounds;
  historyShared: boolean;
  candidates: GroovingCandidate[];
  filledFromMood: boolean;
  // The answered pairs
  history: GroovingRoundRecord[];
  // videoIds shown so far
  shown: string[];
};

export const GroovingQueue = {
  Original: "original",
  ThisRun: "this-run",
  EarlierRun: "earlier-run"
} as const;
export type GroovingQueue = (typeof GroovingQueue)[keyof typeof GroovingQueue];

export const GroovingPrefetchStatus = {
  Pending: "pending",
  Ready: "ready",
  Failed: "failed"
} as const;
export type GroovingPrefetchStatus = (typeof GroovingPrefetchStatus)[keyof typeof GroovingPrefetchStatus];

export type GroovingPrefetch =
  | { status: typeof GroovingPrefetchStatus.Pending; requestId: string }
  | { status: typeof GroovingPrefetchStatus.Ready; pair: GroovingPair }
  | { status: typeof GroovingPrefetchStatus.Failed };

export type GroovingState = {
  flow:
    | { kind: "closed" }
    | { kind: "need-key" }
    | { kind: "consent" }
    | { kind: "setup"; historyShared: boolean }
    // session.candidates is still empty
    | { kind: "collect"; session: GroovingSession }
    | { kind: "pair-wait"; session: GroovingSession; requestId: string; retry: boolean }
    | { kind: "choose"; session: GroovingSession; pair: GroovingPair; prefetch: { left: GroovingPrefetch | null; right: GroovingPrefetch | null } }
    | { kind: "list-wait"; session: GroovingSession; requestId: string; retry: boolean }
    | { kind: "failed"; session: GroovingSession | null; step: GroovingStep; reason: GroovingFailureReason }
    // saveFailed: the last save failed (only done after save-failed; always false otherwise)
    // queueFailed: replacing the queue with this run's list failed (true after queue-failed; false again when retry replaces it once more)
    // replacing: main asked the page to replace the queue and waits for its answer
    | {
        kind: "done" | "saving" | "saved";
        session: GroovingSession;
        list: GroovingList;
        saveFailed: boolean;
        queueFailed: boolean;
        replacing: boolean;
      };
  // The view part: gone (the screen is closed), shown or hidden
  visibility: GroovingVisibility;
  // Whether the notice of the previous run still has to be shown (waiting for the notice)
  notice: boolean;
  // The videoId being previewed (the preview part)
  previewing: string | null;
  // The queue part
  queue: GroovingQueue;
  // Makes request ids (`r<n>`). Never goes back, not even on close, leave or again, so a late answer of an earlier run never matches
  nextRequestId: number;
};

export type GroovingEvent =
  // Grooving pressed. hasKey: there is a key and safeStorage can be used
  | { type: "open"; hasKey: boolean; consent: GroovingConsent | null }
  | { type: "consent"; choice: GroovingConsentChoice | null }
  | { type: "close" }
  | { type: "leave" }
  // The app's settings were reset; consent was withdrawn
  | { type: "withdraw-consent" }
  // The page was loaded again
  | { type: "page-reloaded" }
  | { type: "start"; mood: GroovingMood; direction: GroovingDirection; rounds: GroovingRounds }
  | { type: "candidates-ready"; candidates: GroovingCandidate[]; filledFromMood: boolean }
  | { type: "collect-failed"; reason: GroovingFailureReason }
  // A pair main checked with answer.ts and can use
  | { type: "pair-arrived"; requestId: string; pair: GroovingPair }
  // The shape was wrong or the check failed
  | { type: "pair-unusable"; requestId: string }
  // The LLM could not be asked
  | { type: "pair-failed"; requestId: string; reason: GroovingFailureReason }
  | { type: "answer"; answer: GroovingAnswer }
  | { type: "list-arrived"; requestId: string; list: GroovingList }
  | { type: "list-unusable"; requestId: string }
  | { type: "list-failed"; requestId: string; reason: GroovingFailureReason }
  | { type: "retry" }
  | { type: "preview-start"; videoId: string }
  // 15 seconds passed or stop was pressed
  | { type: "preview-ended" }
  | { type: "save" }
  | { type: "saved" }
  | { type: "save-failed" }
  // The page could not replace the queue (main sends it after the answer to replace-queue)
  | { type: "queue-failed" }
  // The page replaced the queue
  | { type: "queue-replaced" }
  // The × of the notice of the previous run
  | { type: "dismiss-notice" }
  | { type: "again" };

export type GroovingEffect =
  | { type: "load-moods" }
  | { type: "store-consent"; choice: GroovingConsentChoice }
  | { type: "collect"; request: GroovingSourceRequest }
  // assumed: the answer to the current pair a prefetch takes for granted
  | { type: "request-pair"; requestId: string; session: GroovingSession; assumed: GroovingAnswer | null }
  | { type: "request-list"; requestId: string; session: GroovingSession }
  | { type: "preview-start"; videoId: string }
  | { type: "preview-end" }
  | { type: "replace-queue"; videoIds: string[] }
  | { type: "save-playlist"; title: string; videoIds: string[] };

export type GroovingDecision = { state: GroovingState; effects: GroovingEffect[] };

export type GroovingViewExtra = {
  moods: GroovingMoodItem[] | null;
  moodsFailed: boolean;
  providerLabel: string;
  model: string;
  safeStorageAvailable: boolean;
  // The words of the continue mark
  language: GroovingDisplayLanguage;
  usage: { inputTokens: number; outputTokens: number; estimatedUsd: number | null };
};

type Flow = GroovingState["flow"];

// Starts closed (the screen is gone). With notice, the last run ended when the app closed
export function initialGroovingState(options?: { notice?: boolean }): GroovingState {
  return {
    flow: { kind: "closed" },
    visibility: GroovingVisibility.Gone,
    notice: options?.notice ?? false,
    previewing: null,
    queue: GroovingQueue.Original,
    nextRequestId: 1
  };
}

const requestIdOf = (n: number): string => `r${n}`;

// Answering the pair being shown reaches the rounds
const isLastRound = (session: GroovingSession): boolean => session.history.length + 1 === session.rounds;

function moved(state: GroovingState, flow: Flow, effects: GroovingEffect[] = []): GroovingDecision {
  return { state: { ...state, flow }, effects };
}

// Closes the run: the screen goes away, no preview stays, and the queue is left as it is
function closed(state: GroovingState, effects: GroovingEffect[] = [], notice = state.notice): GroovingDecision {
  return {
    state: { ...state, flow: { kind: "closed" }, visibility: GroovingVisibility.Gone, notice, previewing: null },
    effects
  };
}

// Ends the preview if one is running
function previewEnd(state: GroovingState): GroovingEffect[] {
  return state.previewing === null ? [] : [{ type: "preview-end" }];
}

function failed(state: GroovingState, session: GroovingSession | null, step: GroovingStep, reason: GroovingFailureReason): GroovingDecision {
  return moved(state, { kind: "failed", session, step, reason });
}

function setup(state: GroovingState, historyShared: boolean, effects: GroovingEffect[] = []): GroovingDecision {
  return moved(state, { kind: "setup", historyShared }, [...effects, { type: "load-moods" }]);
}

function collect(state: GroovingState, session: GroovingSession): GroovingDecision {
  const request: GroovingSourceRequest = { direction: session.direction, historyShared: session.historyShared, mood: session.mood };
  return moved(state, { kind: "collect", session }, [{ type: "collect", request }]);
}

function waitPair(state: GroovingState, session: GroovingSession, retry: boolean, effects: GroovingEffect[] = []): GroovingDecision {
  const requestId = requestIdOf(state.nextRequestId);
  return {
    state: { ...state, flow: { kind: "pair-wait", session, requestId, retry }, nextRequestId: state.nextRequestId + 1 },
    effects: [...effects, { type: "request-pair", requestId, session, assumed: null }]
  };
}

function waitList(state: GroovingState, session: GroovingSession, retry: boolean, effects: GroovingEffect[] = []): GroovingDecision {
  const requestId = requestIdOf(state.nextRequestId);
  return {
    state: { ...state, flow: { kind: "list-wait", session, requestId, retry }, nextRequestId: state.nextRequestId + 1 },
    effects: [...effects, { type: "request-list", requestId, session }]
  };
}

// Shows a pair, and prefetches the next pair for both answers unless it is the last round
function showPair(state: GroovingState, session: GroovingSession, pair: GroovingPair, effects: GroovingEffect[] = []): GroovingDecision {
  const showing: GroovingSession = { ...session, shown: [...session.shown, pair.left, pair.right] };
  if (isLastRound(showing)) return moved(state, { kind: "choose", session: showing, pair, prefetch: { left: null, right: null } }, effects);
  const left = requestIdOf(state.nextRequestId);
  const right = requestIdOf(state.nextRequestId + 1);
  return {
    state: {
      ...state,
      flow: {
        kind: "choose",
        session: showing,
        pair,
        prefetch: {
          left: { status: GroovingPrefetchStatus.Pending, requestId: left },
          right: { status: GroovingPrefetchStatus.Pending, requestId: right }
        }
      },
      nextRequestId: state.nextRequestId + 2
    },
    effects: [
      ...effects,
      { type: "request-pair", requestId: left, session: showing, assumed: GroovingAnswer.Left },
      { type: "request-pair", requestId: right, session: showing, assumed: GroovingAnswer.Right }
    ]
  };
}

type PrefetchSide = Exclude<GroovingAnswer, typeof GroovingAnswer.Neither>;

// The side of the prefetch that waits for requestId, if any
function prefetchSide(flow: Extract<Flow, { kind: "choose" }>, requestId: string): PrefetchSide | null {
  for (const side of [GroovingAnswer.Left, GroovingAnswer.Right] as const) {
    const prefetch = flow.prefetch[side];
    if (prefetch?.status === GroovingPrefetchStatus.Pending && prefetch.requestId === requestId) return side;
  }
  return null;
}

function setPrefetch(
  state: GroovingState,
  flow: Extract<Flow, { kind: "choose" }>,
  side: PrefetchSide,
  prefetch: GroovingPrefetch
): GroovingDecision {
  return moved(state, { ...flow, prefetch: { ...flow.prefetch, [side]: prefetch } });
}

function answerPair(state: GroovingState, flow: Extract<Flow, { kind: "choose" }>, answer: GroovingAnswer): GroovingDecision {
  const effects: GroovingEffect[] = state.previewing === null ? [] : [{ type: "preview-end" }];
  const base: GroovingState = { ...state, previewing: null };
  const session: GroovingSession = { ...flow.session, history: [...flow.session.history, { pair: flow.pair, answer }] };
  if (isLastRound(flow.session)) return waitList(base, session, false, effects);
  if (answer === GroovingAnswer.Neither) return waitPair(base, session, false, effects);
  const prefetch = answer === GroovingAnswer.Left ? flow.prefetch.left : flow.prefetch.right;
  if (prefetch?.status === GroovingPrefetchStatus.Ready) return showPair(base, session, prefetch.pair, effects);
  if (prefetch?.status === GroovingPrefetchStatus.Pending)
    return moved(base, { kind: "pair-wait", session, requestId: prefetch.requestId, retry: false }, effects);
  return waitPair(base, session, false, effects);
}

export function decideGrooving(state: GroovingState, event: GroovingEvent): GroovingDecision {
  const ignored: GroovingDecision = { state, effects: [] };
  const flow = state.flow;
  // The user can act only on a screen that is shown (the state chart's [shown])
  const shown = state.visibility === GroovingVisibility.Shown;

  switch (event.type) {
    case "open": {
      if (flow.kind !== "closed") {
        // Opening again brings a hidden run back, as it is
        if (shown) return ignored;
        return { state: { ...state, visibility: GroovingVisibility.Shown }, effects: [] };
      }
      const opened: GroovingState = {
        ...state,
        visibility: GroovingVisibility.Shown,
        queue: state.queue === GroovingQueue.ThisRun ? GroovingQueue.EarlierRun : state.queue
      };
      if (!event.hasKey) return moved(opened, { kind: "need-key" });
      if (event.consent === null) return moved(opened, { kind: "consent" });
      return setup(opened, event.consent.choice === GroovingConsentChoice.ShareHistory);
    }
    case "consent": {
      if (!shown || flow.kind !== "consent") return ignored;
      if (event.choice === null) return closed(state);
      return setup(state, event.choice === GroovingConsentChoice.ShareHistory, [{ type: "store-consent", choice: event.choice }]);
    }
    case "close": {
      if (!shown || flow.kind === "closed") return ignored;
      // The notice waits for the setup screen, so the key guidance and the consent keep it
      if (flow.kind === "need-key" || flow.kind === "consent") return closed(state, previewEnd(state));
      return closed(state, previewEnd(state), false);
    }
    case "leave": {
      if (!shown || flow.kind === "closed") return ignored;
      // Past consent the run goes on while the screen is hidden; the key guidance and the consent close
      if (flow.kind === "need-key" || flow.kind === "consent") return closed(state, previewEnd(state));
      return { state: { ...state, visibility: GroovingVisibility.Hidden, previewing: null }, effects: previewEnd(state) };
    }
    case "withdraw-consent": {
      if (flow.kind === "closed") return ignored;
      return closed(state, previewEnd(state));
    }
    case "page-reloaded": {
      if (flow.kind === "closed") return ignored;
      if (flow.kind === "need-key" || flow.kind === "consent") return closed(state);
      const hidden: GroovingState = { ...state, visibility: GroovingVisibility.Hidden, previewing: null };
      switch (flow.kind) {
        case "collect":
          return {
            state: {
              ...hidden,
              flow: { kind: "failed", session: flow.session, step: GroovingStep.Collect, reason: GroovingFailureReason.YtmUnreadable }
            },
            effects: []
          };
        case "saving":
          return {
            state: {
              ...hidden,
              flow: {
                kind: "done",
                session: flow.session,
                list: flow.list,
                saveFailed: true,
                queueFailed: flow.queueFailed || flow.replacing,
                replacing: false
              }
            },
            effects: []
          };
        case "done":
        case "saved":
          return { state: { ...hidden, flow: flow.replacing ? { ...flow, replacing: false, queueFailed: true } : flow }, effects: [] };
        default:
          return { state: hidden, effects: [] };
      }
    }
    case "dismiss-notice": {
      if (!shown || flow.kind !== "setup" || !state.notice) return ignored;
      return { state: { ...state, notice: false }, effects: [] };
    }
    case "start": {
      if (!shown || flow.kind !== "setup") return ignored;
      if (!flow.historyShared && event.direction !== GroovingDirection.Discover) return ignored;
      return collect(
        { ...state, notice: false },
        {
          mood: event.mood,
          direction: event.direction,
          rounds: event.rounds,
          historyShared: flow.historyShared,
          candidates: [],
          filledFromMood: false,
          history: [],
          shown: []
        }
      );
    }
    case "candidates-ready": {
      if (flow.kind !== "collect") return ignored;
      return waitPair(state, { ...flow.session, candidates: event.candidates, filledFromMood: event.filledFromMood }, false);
    }
    case "collect-failed": {
      if (flow.kind !== "collect") return ignored;
      return failed(state, flow.session, GroovingStep.Collect, event.reason);
    }
    case "pair-arrived": {
      if (flow.kind === "pair-wait" && flow.requestId === event.requestId) return showPair(state, flow.session, event.pair);
      if (flow.kind !== "choose") return ignored;
      const side = prefetchSide(flow, event.requestId);
      return side === null ? ignored : setPrefetch(state, flow, side, { status: GroovingPrefetchStatus.Ready, pair: event.pair });
    }
    case "pair-unusable":
    case "pair-failed": {
      if (flow.kind === "pair-wait" && flow.requestId === event.requestId) {
        if (event.type === "pair-failed") return failed(state, flow.session, GroovingStep.Pair, event.reason);
        return flow.retry ? failed(state, flow.session, GroovingStep.Pair, GroovingFailureReason.Unusable) : waitPair(state, flow.session, true);
      }
      if (flow.kind !== "choose") return ignored;
      const side = prefetchSide(flow, event.requestId);
      return side === null ? ignored : setPrefetch(state, flow, side, { status: GroovingPrefetchStatus.Failed });
    }
    case "answer": {
      if (!shown || flow.kind !== "choose") return ignored;
      return answerPair(state, flow, event.answer);
    }
    case "list-arrived": {
      if (flow.kind !== "list-wait" || flow.requestId !== event.requestId) return ignored;
      return {
        state: {
          ...state,
          flow: { kind: "done", session: flow.session, list: event.list, saveFailed: false, queueFailed: false, replacing: true },
          queue: GroovingQueue.ThisRun
        },
        effects: [{ type: "replace-queue", videoIds: event.list.videoIds }]
      };
    }
    case "list-unusable":
    case "list-failed": {
      if (flow.kind !== "list-wait" || flow.requestId !== event.requestId) return ignored;
      if (event.type === "list-failed") return failed(state, flow.session, GroovingStep.List, event.reason);
      return flow.retry ? failed(state, flow.session, GroovingStep.List, GroovingFailureReason.Unusable) : waitList(state, flow.session, true);
    }
    case "queue-failed": {
      if (flow.kind !== "done" && flow.kind !== "saving" && flow.kind !== "saved") return ignored;
      return moved(state, { ...flow, queueFailed: true, replacing: false });
    }
    case "queue-replaced": {
      if (flow.kind !== "done" && flow.kind !== "saving" && flow.kind !== "saved") return ignored;
      if (!flow.replacing) return ignored;
      return moved(state, { ...flow, replacing: false });
    }
    case "retry": {
      if (!shown) return ignored;
      if (flow.kind === "done" || flow.kind === "saving" || flow.kind === "saved") {
        // Replaces the queue once more; the queue stays this run's list
        if (!flow.queueFailed) return ignored;
        return moved(state, { ...flow, queueFailed: false, replacing: true }, [{ type: "replace-queue", videoIds: flow.list.videoIds }]);
      }
      if (flow.kind !== "failed") return ignored;
      // Without a session there is nothing to retry; history sharing is not known, so only Discover is offered
      if (flow.session === null) return setup(state, false);
      switch (flow.step) {
        case GroovingStep.Collect:
          return collect(state, flow.session);
        case GroovingStep.Pair:
          return waitPair(state, flow.session, false);
        case GroovingStep.List:
          return waitList(state, flow.session, false);
      }
    }
    case "preview-start": {
      if (!shown || flow.kind !== "choose") return ignored;
      if (event.videoId !== flow.pair.left && event.videoId !== flow.pair.right) return ignored;
      if (state.previewing === event.videoId) return ignored;
      // While previewing the other track, switch to this one without going back first
      return { state: { ...state, previewing: event.videoId }, effects: [{ type: "preview-start", videoId: event.videoId }] };
    }
    case "preview-ended": {
      if (state.previewing === null) return ignored;
      return { state: { ...state, previewing: null }, effects: [{ type: "preview-end" }] };
    }
    case "save": {
      if (!shown || flow.kind !== "done") return ignored;
      return moved(
        state,
        { kind: "saving", session: flow.session, list: flow.list, saveFailed: false, queueFailed: flow.queueFailed, replacing: flow.replacing },
        [{ type: "save-playlist", title: flow.list.moodDescription, videoIds: flow.list.videoIds }]
      );
    }
    case "saved":
    case "save-failed": {
      if (flow.kind !== "saving") return ignored;
      const { session, list, queueFailed, replacing } = flow;
      if (event.type === "saved") return moved(state, { kind: "saved", session, list, saveFailed: false, queueFailed, replacing });
      return moved(state, { kind: "done", session, list, saveFailed: true, queueFailed, replacing });
    }
    case "again": {
      if (!shown || (flow.kind !== "done" && flow.kind !== "saved")) return ignored;
      return setup({ ...state, queue: GroovingQueue.EarlierRun }, flow.session.historyShared);
    }
  }
}

const candidateOf = (session: GroovingSession, videoId: string): GroovingCandidate | undefined =>
  session.candidates.find(candidate => candidate.videoId === videoId);

/**
 * Whether the page must keep running at full speed: the screen is shown, or a hidden run waits for something
 */
export function groovingStopsThrottling(state: GroovingState): boolean {
  if (state.visibility === GroovingVisibility.Shown) return true;
  if (state.visibility !== GroovingVisibility.Hidden) return false;
  const flow = state.flow;
  if (flow.kind === "collect" || flow.kind === "pair-wait" || flow.kind === "list-wait" || flow.kind === "saving") return true;
  if (flow.kind === "choose") {
    return [flow.prefetch.left, flow.prefetch.right].some(prefetch => prefetch?.status === GroovingPrefetchStatus.Pending);
  }
  if ((flow.kind === "done" || flow.kind === "saved") && flow.replacing) return true;
  return state.previewing !== null;
}

/**
 * Whether the run is under way, so that the next start tells that it ended when the app closed
 */
export function groovingRunInProgress(state: GroovingState): boolean {
  switch (state.flow.kind) {
    case "collect":
    case "pair-wait":
    case "choose":
    case "list-wait":
    case "failed":
    case "done":
    case "saving":
      return true;
    case "closed":
    case "need-key":
    case "consent":
    case "setup":
    case "saved":
      return false;
  }
}

function pairWorking(session: GroovingSession): GroovingScreenView {
  return {
    screen: GroovingScreen.Working,
    step: GroovingStep.Pair,
    round: session.history.length + 1,
    rounds: session.rounds,
    filledFromMood: session.filledFromMood
  };
}

export function toGroovingViewState(state: GroovingState, extra: GroovingViewExtra): GroovingViewState {
  const screen = screenViewOf(state, extra);
  const visibility = state.flow.kind === "closed" ? GroovingVisibility.Gone : state.visibility;
  return Object.assign({}, screen, { visibility, mark: groovingMarkOf(state, visibility, extra.language) });
}

// The continue mark, only while hidden: words, the round of the pair being chosen, or nothing before starting
function groovingMarkOf(state: GroovingState, visibility: GroovingVisibility, language: GroovingDisplayLanguage): string | null {
  if (visibility !== GroovingVisibility.Hidden) return null;
  const flow = state.flow;
  switch (flow.kind) {
    case "collect":
    case "pair-wait":
    case "list-wait":
      return GROOVING_MARK_TEXT[language].preparing;
    case "choose":
      return `${flow.session.history.length + 1} / ${flow.session.rounds}`;
    case "done":
    case "saving":
    case "saved":
      return GROOVING_MARK_TEXT[language].ready;
    case "failed":
      return GROOVING_MARK_TEXT[language].error;
    case "setup":
    case "closed":
    case "need-key":
    case "consent":
      return null;
  }
}

function screenViewOf(state: GroovingState, extra: GroovingViewExtra): GroovingScreenView {
  const flow = state.flow;
  switch (flow.kind) {
    case "closed":
      return { screen: GroovingScreen.Closed };
    case "need-key":
      return { screen: GroovingScreen.KeyMissing, safeStorageAvailable: extra.safeStorageAvailable };
    case "consent":
      return { screen: GroovingScreen.Consent, providerLabel: extra.providerLabel };
    case "setup":
      return {
        screen: GroovingScreen.Setup,
        moods: extra.moods,
        moodsFailed: extra.moodsFailed,
        historyShared: flow.historyShared,
        providerLabel: extra.providerLabel,
        model: extra.model,
        notice: state.notice
      };
    case "collect":
      return { screen: GroovingScreen.Working, step: GroovingStep.Collect, round: null, rounds: null, filledFromMood: flow.session.filledFromMood };
    case "pair-wait":
      return pairWorking(flow.session);
    case "choose": {
      const left = candidateOf(flow.session, flow.pair.left);
      const right = candidateOf(flow.session, flow.pair.right);
      // main checks pairs against the candidates, so this does not happen; never show a track it cannot describe
      if (left === undefined || right === undefined) return pairWorking(flow.session);
      return {
        screen: GroovingScreen.Choose,
        round: flow.session.history.length + 1,
        rounds: flow.session.rounds,
        moodLabel: groovingMoodLabel(flow.session.mood),
        direction: flow.session.direction,
        left,
        right,
        previewing: state.previewing,
        filledFromMood: flow.session.filledFromMood
      };
    }
    case "list-wait":
      return { screen: GroovingScreen.Working, step: GroovingStep.List, round: null, rounds: null, filledFromMood: flow.session.filledFromMood };
    case "failed": {
      const session = flow.step === GroovingStep.Pair ? flow.session : null;
      return {
        screen: GroovingScreen.Failed,
        step: flow.step,
        reason: flow.reason,
        round: session === null ? null : session.history.length + 1,
        rounds: session === null ? null : session.rounds
      };
    }
    case "done":
    case "saving":
    case "saved": {
      const tracks = flow.list.videoIds.flatMap(videoId => candidateOf(flow.session, videoId) ?? []);
      const familiarCount = tracks.filter(track => track.kind === GroovingTrackKind.Familiar).length;
      return {
        screen: GroovingScreen.Done,
        moodLabel: groovingMoodLabel(flow.session.mood),
        moodDescription: flow.list.moodDescription,
        tracks,
        familiarCount,
        newCount: tracks.length - familiarCount,
        usage: { ...extra.usage, model: extra.model },
        saved:
          flow.kind === "saving"
            ? GroovingSaveStatus.Saving
            : flow.kind === "saved"
              ? GroovingSaveStatus.Saved
              : flow.saveFailed
                ? GroovingSaveStatus.Failed
                : GroovingSaveStatus.NotSaved,
        queueFailed: flow.queueFailed
      };
    }
  }
}
