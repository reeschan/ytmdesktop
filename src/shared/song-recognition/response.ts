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

export type SongRecognitionResult =
  | { kind: typeof SongRecognitionMatch; query: string; title: string; artist: string }
  | { kind: SongRecognitionResultKind };

const STATUS_OK = 200;
const STATUS_UNAUTHORIZED = 401;
const STATUS_FORBIDDEN = 403;
const STATUS_TOO_MANY_REQUESTS = 429;

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// The title and the artist as they are in the track, each trimmed, or "" when there is neither
function readTrack(body: unknown): { title: string; artist: string } {
  if (typeof body !== "object" || body === null) return { title: "", artist: "" };
  const track = (body as { track?: unknown }).track;
  if (typeof track !== "object" || track === null) return { title: "", artist: "" };
  const { title, subtitle } = track as { title?: unknown; subtitle?: unknown };
  return { title: readText(title), artist: readText(subtitle) };
}

// The title and the artist joined with a space, or "" when there is neither
function readQuery(title: string, artist: string): string {
  return [title, artist].filter(text => text !== "").join(" ");
}

export function interpretShazamResponse(input: ShazamOutcome): SongRecognitionResult {
  if (input.kind !== ShazamOutcomeKind.Http) return { kind: SongRecognitionResultKind.NetworkError };

  switch (input.status) {
    case STATUS_OK: {
      const { title, artist } = readTrack(input.body);
      const query = readQuery(title, artist);
      return query === "" ? { kind: SongRecognitionResultKind.NoMatch } : { kind: SongRecognitionMatch, query, title, artist };
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
