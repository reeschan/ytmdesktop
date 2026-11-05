// Shared names and shapes for Grooving (main, the YTM preload and the YTM page)

export const GroovingProvider = {
  Gemini: "gemini",
  Anthropic: "anthropic",
  OpenAI: "openai"
} as const;
export type GroovingProvider = (typeof GroovingProvider)[keyof typeof GroovingProvider];

export const GROOVING_PROVIDER_LABELS: Record<GroovingProvider, string> = {
  gemini: "Gemini",
  anthropic: "Claude",
  openai: "ChatGPT"
};

export const GROOVING_DEFAULT_MODELS: Record<GroovingProvider, string> = {
  gemini: "gemini-3.5-flash-lite",
  anthropic: "claude-haiku-5-5",
  openai: "gpt-6-luna"
};

export const GROOVING_API_KEY_URLS: Record<GroovingProvider, string> = {
  gemini: "https://aistudio.google.com/apikey",
  anthropic: "https://platform.claude.com/settings/keys",
  openai: "https://platform.openai.com/api-keys"
};

export const GroovingConsentChoice = {
  ShareHistory: "share-history",
  NoHistory: "no-history"
} as const;
export type GroovingConsentChoice = (typeof GroovingConsentChoice)[keyof typeof GroovingConsentChoice];

// at: ISO 8601
export type GroovingConsent = { choice: GroovingConsentChoice; at: string };

export const GroovingDirection = {
  Familiar: "familiar",
  Discover: "discover",
  Mix: "mix"
} as const;
export type GroovingDirection = (typeof GroovingDirection)[keyof typeof GroovingDirection];

// What a direction does with the answers to the pairs.
// dropsUnchosen: the list leaves out the tracks the listener did not choose (the other track of a pair, both tracks of neither)
export type GroovingDirectionRule = { dropsUnchosen: boolean };
export const GROOVING_DIRECTION_RULES: Record<GroovingDirection, GroovingDirectionRule> = {
  [GroovingDirection.Familiar]: { dropsUnchosen: false },
  [GroovingDirection.Discover]: { dropsUnchosen: false },
  [GroovingDirection.Mix]: { dropsUnchosen: true }
};

export const GROOVING_ROUND_OPTIONS = [3, 5, 10] as const;
export type GroovingRounds = (typeof GROOVING_ROUND_OPTIONS)[number];

export const GROOVING_LIST_LENGTH = 25;
export const GROOVING_CANDIDATE_LIMIT = 80;
// How many continuation lists one run may add (see docs/specs/grooving-continue.md)
export const GROOVING_CONTINUATION_MAX_ROUNDS = 3;
// Below this many familiar candidates, fill up from the mood's playlists
export const GROOVING_FAMILIAR_MINIMUM = 30;
// In a mix, each side gets at least this share
export const GROOVING_MIX_MIN_SHARE = 0.2;
export const GROOVING_PREVIEW_SECONDS = 15;
export const GROOVING_PREVIEW_START_RATIO = 1 / 3;
export const GROOVING_LLM_TIMEOUT_MS = 30_000;
// Across runs, at most this many LLM calls in any 10 minutes, so the page's forged signals cannot spend the key without end
export const GROOVING_LLM_CALL_LIMIT = 120;
export const GROOVING_LLM_CALL_WINDOW_MS = 10 * 60_000;
export const GROOVING_SEARCH_QUERY_LIMIT = 3;
// How long main waits for the page's savePlaylist answer. Longer than the page's worst case
// (the replaceQueue settle wait 10 s + SAVE_WAIT 10 s + fetch 15 s = 35 s)
export const GROOVING_SAVE_TIMEOUT_MS = 40_000;

export type GroovingTrack = { videoId: string; title: string; artists: string[]; thumbnailUrl: string | null };

export const GROOVING_TRACK_ARTIST_LIMIT = 5;
export const GROOVING_TRACK_TEXT_MAX = 200;
// The tracks the page sends back go into the prompts, so main cuts them where it takes them in
export function clipGroovingTrack(track: GroovingTrack): GroovingTrack {
  return {
    ...track,
    title: track.title.slice(0, GROOVING_TRACK_TEXT_MAX),
    artists: track.artists.slice(0, GROOVING_TRACK_ARTIST_LIMIT).map(artist => artist.slice(0, GROOVING_TRACK_TEXT_MAX))
  };
}

export const GroovingTrackKind = {
  Familiar: "familiar",
  New: "new"
} as const;
export type GroovingTrackKind = (typeof GroovingTrackKind)[keyof typeof GroovingTrackKind];

export type GroovingCandidate = GroovingTrack & { kind: GroovingTrackKind };

export const GroovingMoodSection = {
  Moods: "moods",
  Genres: "genres"
} as const;
export type GroovingMoodSection = (typeof GroovingMoodSection)[keyof typeof GroovingMoodSection];

// One item of "Moods & genres". params is the browse params for FEmusic_moods_and_genres_category
export type GroovingMoodItem = { name: string; section: GroovingMoodSection; params: string };
// A blend is 0-1 item of "Moods & activities" and 0-2 items of "Genres", 2-3 items in all. One item alone stays kind "item"
export type GroovingMood =
  | { kind: "item"; item: GroovingMoodItem }
  | { kind: "blend"; items: GroovingMoodItem[] } // moods items first, then genres in the order chosen
  | { kind: "text"; text: string };

export const GROOVING_BLEND_GENRE_LIMIT = 2;
export const GROOVING_BLEND_MOOD_LIMIT = 1;
export const GROOVING_MOOD_JOINER = " × ";

// The mood's name (for example on the choose screen). A blend joins the item names with GROOVING_MOOD_JOINER
export function groovingMoodLabel(mood: GroovingMood): string {
  switch (mood.kind) {
    case "item":
      return mood.item.name;
    case "blend":
      return mood.items.map(item => item.name).join(GROOVING_MOOD_JOINER);
    case "text":
      return mood.text;
  }
}

// The Language setting. Auto follows the HL of the YTM page
export const GroovingLanguage = {
  Auto: "auto",
  English: "en",
  Japanese: "ja"
} as const;
export type GroovingLanguage = (typeof GroovingLanguage)[keyof typeof GroovingLanguage];
export type GroovingDisplayLanguage = Exclude<GroovingLanguage, "auto">;

// Language names passed to the LLM
export const GROOVING_LANGUAGE_NAMES: Record<GroovingDisplayLanguage, string> = {
  en: "English",
  ja: "Japanese"
};

const GROOVING_DISPLAY_LANGUAGES: readonly GroovingDisplayLanguage[] = [GroovingLanguage.English, GroovingLanguage.Japanese];

// en / ja as set. Auto, a missing value or an unknown value: ja when pageLanguage (ytcfg HL) starts with "ja" (any case), else en
export function resolveGroovingLanguage(setting: unknown, pageLanguage: string | null): GroovingDisplayLanguage {
  if (isOneOf(GROOVING_DISPLAY_LANGUAGES, setting)) return setting;
  return pageLanguage?.toLowerCase().startsWith("ja") ? GroovingLanguage.Japanese : GroovingLanguage.English;
}

export const GroovingAnswer = {
  Left: "left",
  Right: "right",
  Neither: "neither"
} as const;
export type GroovingAnswer = (typeof GroovingAnswer)[keyof typeof GroovingAnswer];

// left / right are videoIds. reason is how the two differ (not shown on screen)
export type GroovingPair = { left: string; right: string; reason: string };
export type GroovingRoundRecord = { pair: GroovingPair; answer: GroovingAnswer };
export type GroovingList = { videoIds: string[]; moodDescription: string };

// month: YYYY-MM. Values saved before unpricedTokens was added do not have it
// unpricedTokens: input and output tokens of models not in the price table, in all
export type GroovingUsage = { month: string; inputTokens: number; outputTokens: number; estimatedUsd: number; unpricedTokens: number };

export const GroovingStep = {
  Collect: "collect",
  Pair: "pair",
  List: "list"
} as const;
export type GroovingStep = (typeof GroovingStep)[keyof typeof GroovingStep];

export const GroovingFailureReason = {
  InvalidKey: "invalid-key", // 401, 403, Gemini's 400 (API_KEY_INVALID)
  ModelNotFound: "model-not-found", // 404 (the configured model does not exist)
  RateLimited: "rate-limited", // 429, or main's own cap on LLM calls (GROOVING_LLM_CALL_LIMIT)
  Rejected: "rejected", // A 4xx other than the 401, 403, 404, 429 and API_KEY_INVALID above (for example Anthropic's 400 "credit balance is too low")
  Network: "network", // An AI provider call failed: connection failure, the 30 s timeout, 5xx, no HTTP answer
  Unusable: "unusable", // Two unusable answers in a row
  YtmUnreadable: "ytm-unreadable", // A YTM response could not be read or fetched, or the page is gone or did not answer in time
  NotEnough: "not-enough" // Not enough candidates for a pair or a list
} as const;
export type GroovingFailureReason = (typeof GroovingFailureReason)[keyof typeof GroovingFailureReason];

// IPC channels between main and the YTM preload
export const GroovingIpc = {
  State: "grooving:state",
  Signal: "grooving:signal"
} as const;
export type GroovingIpc = (typeof GroovingIpc)[keyof typeof GroovingIpc];

// window.postMessage ops between the YTM preload and the page
export const GroovingMessageOp = {
  // preload -> page: { op, state: GroovingViewMessage }
  State: "ytmd-grooving-state",
  // page -> preload: { op, signal: GroovingSignal }
  Signal: "ytmd-grooving-signal",
  // page -> preload: the page is ready; the preload sends the last state again
  Ready: "ytmd-grooving-ready",
  // page -> preload: open the settings on the Integrations tab
  OpenSettings: "ytmd-grooving-open-settings"
} as const;
export type GroovingMessageOp = (typeof GroovingMessageOp)[keyof typeof GroovingMessageOp];

// Name of the page's ProtectedAPI, and of main -> page invokeMessage calls
export const GROOVING_PROTECTED_API = "Grooving";

export const GroovingPageCall = {
  GetMoods: "getMoods", // () -> GroovingPageResult<GroovingMoodItem[]>
  CollectSources: "collectSources", // (GroovingSourceRequest) -> GroovingPageResult<GroovingSources>
  Search: "search", // (queries: string[]) -> GroovingPageResult<GroovingTrack[]>
  Related: "related", // (videoId: string) -> GroovingPageResult<GroovingTrack[]>
  PreviewStart: "previewStart", // (videoId: string) -> GroovingPageResult<null>
  PreviewEnd: "previewEnd", // () -> GroovingPageResult<null>; back to the original track and position, removes the inserted track
  ReplaceQueue: "replaceQueue", // (videoIds: string[]) -> GroovingPageResult<null>
  AppendQueue: "appendQueue", // (videoIds: string[]) -> GroovingPageResult<null>
  SavePlaylist: "savePlaylist", // ({ title, videoIds }) -> GroovingPageResult<{ playlistId: string }>
  AddToPlaylist: "addToPlaylist" // ({ playlistId, videoIds }) -> GroovingPageResult<null>
} as const;
export type GroovingPageCall = (typeof GroovingPageCall)[keyof typeof GroovingPageCall];

// Page handlers return [GroovingPageResult] (one element), like getPlaylists in remote.ts. Main reads [0]
export type GroovingPageResult<T> = { ok: true; value: T } | { ok: false; error: string };

export type GroovingSourceRequest = { direction: GroovingDirection; historyShared: boolean; mood: GroovingMood };

// Raw tracks the page collected (no kind, not filtered yet). Empty when not needed
export type GroovingSources = {
  history: GroovingTrack[]; // FEmusic_history
  liked: GroovingTrack[]; // Liked songs, read from browse VLLM (playlistId LM); FEmusic_liked_videos is the library's songs
  related: GroovingTrack[]; // Related tracks of the top history tracks (familiar / mix, only when historyShared)
  mood: GroovingTrack[]; // Tracks of a few playlists of the mood item (when mood.kind is item; also fetched for familiar, to fill up), or of the genres' playlists for a blend
};

// page -> main: what the user did
export type GroovingSignal =
  | { type: "open"; pageLanguage: string | null } // Pressed Grooving in the sidebar. pageLanguage is the page's HL (null when unreadable)
  | { type: "close" } // The close button
  | { type: "leave" } // A YTM navigation to a pathname other than /watch
  | { type: "consent"; choice: GroovingConsentChoice | null } // null is Not now
  | { type: "start"; mood: GroovingMood; direction: GroovingDirection; rounds: GroovingRounds }
  | { type: "answer"; answer: GroovingAnswer }
  | { type: "previewStart"; videoId: string }
  | { type: "previewStop" }
  | { type: "retry" }
  | { type: "save" }
  | { type: "again" }
  | { type: "continueToggle"; enabled: boolean } // The continue toggle on the done screen
  | { type: "dismissNotice" }; // The × of the notice of the previous run

export const GroovingScreen = {
  Closed: "closed",
  KeyMissing: "key-missing",
  Consent: "consent",
  Setup: "setup",
  Working: "working",
  Choose: "choose",
  Done: "done",
  Failed: "failed"
} as const;
export type GroovingScreen = (typeof GroovingScreen)[keyof typeof GroovingScreen];

// The view part of the state chart: whether the screen is gone, shown or hidden
export const GroovingVisibility = {
  Gone: "gone",
  Shown: "shown",
  Hidden: "hidden"
} as const;
export type GroovingVisibility = (typeof GroovingVisibility)[keyof typeof GroovingVisibility];

// The words of the continue mark, per display language. While choosing a pair the mark is `${round} / ${rounds}` instead
export const GROOVING_MARK_TEXT: Record<GroovingDisplayLanguage, { preparing: string; ready: string; error: string }> = {
  en: { preparing: "Preparing", ready: "Ready", error: "Error" },
  ja: { preparing: "用意中", ready: "できあがり", error: "エラー" }
};

// The save state the done screen shows
export const GroovingSaveStatus = {
  NotSaved: "no",
  Saving: "saving",
  Saved: "saved",
  Failed: "failed"
} as const;
export type GroovingSaveStatus = (typeof GroovingSaveStatus)[keyof typeof GroovingSaveStatus];

// What the save button does: save the list, add the newly listed tracks to the saved playlist, or nothing
export const GroovingSaveAction = {
  Save: "save",
  Add: "add",
  Saved: "saved"
} as const;
export type GroovingSaveAction = (typeof GroovingSaveAction)[keyof typeof GroovingSaveAction];

// Where the continuation part of a done / saving / saved run is (see docs/specs/grooving-continue.md)
export const GroovingContinuationPhase = {
  Idle: "idle",
  Collecting: "collecting",
  Requesting: "requesting",
  RequestingRetry: "requesting-retry",
  Failed: "failed",
  Short: "short",
  Finished: "finished"
} as const;
export type GroovingContinuationPhase = (typeof GroovingContinuationPhase)[keyof typeof GroovingContinuationPhase];

// main -> page: what the screen shows. Never holds the key, prompts or raw LLM answers
export type GroovingScreenView =
  | { screen: typeof GroovingScreen.Closed }
  | { screen: typeof GroovingScreen.KeyMissing; safeStorageAvailable: boolean }
  | { screen: typeof GroovingScreen.Consent; providerLabel: string }
  | {
      screen: typeof GroovingScreen.Setup;
      moods: GroovingMoodItem[] | null;
      moodsFailed: boolean;
      historyShared: boolean;
      providerLabel: string;
      model: string;
      // Whether the last run ended when the app closed
      notice: boolean;
    }
  | { screen: typeof GroovingScreen.Working; step: GroovingStep; round: number | null; rounds: number | null; filledFromMood: boolean }
  | {
      screen: typeof GroovingScreen.Choose;
      round: number;
      rounds: number;
      moodLabel: string;
      direction: GroovingDirection;
      left: GroovingCandidate;
      right: GroovingCandidate;
      previewing: string | null;
      filledFromMood: boolean;
    }
  | {
      screen: typeof GroovingScreen.Done;
      moodLabel: string;
      moodDescription: string;
      // The Grooving list and the continuation lists, in the order they play
      listed: GroovingCandidate[];
      familiarCount: number;
      newCount: number;
      usage: { inputTokens: number; outputTokens: number; estimatedUsd: number | null; model: string };
      saved: GroovingSaveStatus;
      saveAction: GroovingSaveAction;
      continuation: { enabled: boolean; rounds: number; maxRounds: number; phase: GroovingContinuationPhase };
      queueFailed: boolean;
    }
  | { screen: typeof GroovingScreen.Failed; step: GroovingStep; reason: GroovingFailureReason; round: number | null; rounds: number | null };

// main -> page: the screen with the view and the continue mark
export type GroovingViewState = GroovingScreenView & { visibility: GroovingVisibility; mark: string | null };

// main -> page: what is actually sent. The view state with the display language added
export type GroovingViewMessage = GroovingViewState & { language: GroovingDisplayLanguage };

const GROOVING_SCREENS: readonly string[] = Object.values(GroovingScreen);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isOneOf<T extends string | number>(values: Record<string, T> | readonly T[], value: unknown): value is T {
  return (Object.values(values) as unknown[]).includes(value);
}

function isGroovingMoodItem(value: unknown): value is GroovingMoodItem {
  return isRecord(value) && typeof value.name === "string" && isOneOf(GroovingMoodSection, value.section) && typeof value.params === "string";
}

// 2-3 items, at most GROOVING_BLEND_MOOD_LIMIT moods and GROOVING_BLEND_GENRE_LIMIT genres, no repeated params. The order is not checked
function isGroovingBlendItems(value: unknown): value is GroovingMoodItem[] {
  if (!Array.isArray(value) || !value.every(isGroovingMoodItem)) return false;
  const moods = value.filter(item => item.section === GroovingMoodSection.Moods).length;
  const genres = value.length - moods;
  return (
    value.length >= 2 &&
    moods <= GROOVING_BLEND_MOOD_LIMIT &&
    genres <= GROOVING_BLEND_GENRE_LIMIT &&
    new Set(value.map(item => item.params)).size === value.length
  );
}

function isGroovingMood(value: unknown): value is GroovingMood {
  if (!isRecord(value)) return false;
  switch (value.kind) {
    case "text":
      return typeof value.text === "string";
    case "item":
      return isGroovingMoodItem(value.item);
    case "blend":
      return isGroovingBlendItems(value.items);
    default:
      return false;
  }
}

// Checks that it is an object with a known screen, a known visibility and a mark that is null or words
export function isGroovingViewState(value: unknown): value is GroovingViewState {
  return (
    isRecord(value) &&
    GROOVING_SCREENS.includes(value.screen as string) &&
    isOneOf(GroovingVisibility, value.visibility) &&
    (value.mark === null || typeof value.mark === "string")
  );
}

// A view state with a language of en or ja
export function isGroovingViewMessage(value: unknown): value is GroovingViewMessage {
  return isRecord(value) && isOneOf(GROOVING_DISPLAY_LANGUAGES, value.language) && isGroovingViewState(value);
}

// Checks the type and the types of the fields it needs
export function isGroovingSignal(value: unknown): value is GroovingSignal {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case "open":
      return value.pageLanguage === null || typeof value.pageLanguage === "string";
    case "close":
    case "leave":
    case "previewStop":
    case "retry":
    case "save":
    case "again":
    case "dismissNotice":
      return true;
    case "consent":
      return value.choice === null || isOneOf(GroovingConsentChoice, value.choice);
    case "start":
      return isGroovingMood(value.mood) && isOneOf(GroovingDirection, value.direction) && isOneOf(GROOVING_ROUND_OPTIONS, value.rounds);
    case "answer":
      return isOneOf(GroovingAnswer, value.answer);
    case "previewStart":
      return typeof value.videoId === "string";
    case "continueToggle":
      return typeof value.enabled === "boolean";
    default:
      return false;
  }
}
