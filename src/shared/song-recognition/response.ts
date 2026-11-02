import { SongRecognitionResultKind } from "./index";

export const ShazamOutcomeKind = {
  Http: "http",
  NetworkError: "network-error",
  Timeout: "timeout"
} as const;
export type ShazamOutcomeKind = (typeof ShazamOutcomeKind)[keyof typeof ShazamOutcomeKind];

// What came back from the request; the body is not trusted
export type ShazamOutcome =
  | { kind: typeof ShazamOutcomeKind.Http; status: number; body: unknown }
  | { kind: typeof ShazamOutcomeKind.NetworkError }
  | { kind: typeof ShazamOutcomeKind.Timeout };

export const SongRecognitionMatch = "match";

export type SongRecognitionResult = { kind: typeof SongRecognitionMatch; query: string } | { kind: SongRecognitionResultKind };

const STATUS_OK = 200;
const STATUS_UNAUTHORIZED = 401;
const STATUS_FORBIDDEN = 403;
const STATUS_TOO_MANY_REQUESTS = 429;

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// The title and the subtitle joined with a space, or "" when there is neither
function readQuery(body: unknown): string {
  if (typeof body !== "object" || body === null) return "";
  const track = (body as { track?: unknown }).track;
  if (typeof track !== "object" || track === null) return "";
  const { title, subtitle } = track as { title?: unknown; subtitle?: unknown };
  return [readText(title), readText(subtitle)].filter(text => text !== "").join(" ");
}

export function interpretShazamResponse(input: ShazamOutcome): SongRecognitionResult {
  if (input.kind !== ShazamOutcomeKind.Http) return { kind: SongRecognitionResultKind.NetworkError };

  switch (input.status) {
    case STATUS_OK: {
      const query = readQuery(input.body);
      return query === "" ? { kind: SongRecognitionResultKind.NoMatch } : { kind: SongRecognitionMatch, query };
    }
    case STATUS_UNAUTHORIZED:
    case STATUS_FORBIDDEN:
      return { kind: SongRecognitionResultKind.InvalidKey };
    case STATUS_TOO_MANY_REQUESTS:
      return { kind: SongRecognitionResultKind.LimitReached };
    default:
      return { kind: SongRecognitionResultKind.NetworkError };
  }
}
