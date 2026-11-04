// Pure helpers of the Grooving service: what the page sends back is only trusted after these checks
// (the page shares its world with Google's scripts), plus small helpers for the settings and the LLM results
import {
  clipGroovingTrack,
  GroovingConsent,
  GroovingConsentChoice,
  GroovingFailureReason,
  GroovingMood,
  groovingMoodLabel,
  GroovingMoodItem,
  GroovingMoodSection,
  GroovingSources,
  GroovingTrack,
  GroovingUsage
} from "~shared/grooving";
import type { GroovingLlmResult } from "./llm";

// What the page can send back is only trusted after these checks (the page shares its world with Google's scripts)
const VIDEO_ID_PATTERN = /^[\w-]{1,32}$/;
const MAX_TRACKS = 500;
const MAX_MOODS = 300;
export const MAX_TEXT = 300;
export const MOOD_TEXT_MAX = 200;

// Why an LLM call gave nothing: an answer that was not usable (worth one more ask) or a failed call
export const GroovingLlmFailureKind = {
  Unusable: "unusable",
  Failed: "failed"
} as const;
export type GroovingLlmFailureKind = (typeof GroovingLlmFailureKind)[keyof typeof GroovingLlmFailureKind];

export type PageAnswer = { ok: true; value: unknown } | { ok: false; reason: GroovingFailureReason };
export type Usage = { inputTokens: number; outputTokens: number };

export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isText = (value: unknown): value is string => typeof value === "string" && value.length <= MAX_TEXT;

export function readTracks(value: unknown): GroovingTrack[] | null {
  if (!Array.isArray(value)) return null;

  const tracks: GroovingTrack[] = [];
  for (const item of value.slice(0, MAX_TRACKS) as unknown[]) {
    if (!isRecord(item) || typeof item.videoId !== "string" || !VIDEO_ID_PATTERN.test(item.videoId)) continue;
    if (!isText(item.title) || !Array.isArray(item.artists) || !item.artists.every(isText)) continue;

    const thumbnailUrl = typeof item.thumbnailUrl === "string" && item.thumbnailUrl.startsWith("https://") ? item.thumbnailUrl : null;
    tracks.push(clipGroovingTrack({ videoId: item.videoId, title: item.title, artists: item.artists as string[], thumbnailUrl }));
  }
  return tracks;
}

export function readSources(value: unknown): GroovingSources | null {
  if (!isRecord(value)) return null;

  const history = readTracks(value.history);
  const liked = readTracks(value.liked);
  const related = readTracks(value.related);
  const mood = readTracks(value.mood);
  return history && liked && related && mood ? { history, liked, related, mood } : null;
}

export function readMoods(value: unknown): GroovingMoodItem[] | null {
  if (!Array.isArray(value)) return null;

  const moods: GroovingMoodItem[] = [];
  for (const item of value.slice(0, MAX_MOODS) as unknown[]) {
    if (!isRecord(item) || !isText(item.name) || !isText(item.params)) continue;
    if (item.section !== GroovingMoodSection.Moods && item.section !== GroovingMoodSection.Genres) continue;
    moods.push({ name: item.name, section: item.section, params: item.params });
  }
  return moods;
}

export function isConsent(value: unknown): value is GroovingConsent {
  return (
    isRecord(value) &&
    (value.choice === GroovingConsentChoice.ShareHistory || value.choice === GroovingConsentChoice.NoHistory) &&
    typeof value.at === "string"
  );
}

export function isUsage(value: unknown): value is GroovingUsage {
  return (
    isRecord(value) &&
    typeof value.month === "string" &&
    Number.isFinite(value.inputTokens) &&
    Number.isFinite(value.outputTokens) &&
    Number.isFinite(value.estimatedUsd)
  );
}

export const moodLabelOf = (mood: GroovingMood): string => groovingMoodLabel(mood);

export function failedLlm(reason: GroovingFailureReason): GroovingLlmResult<never> {
  return { ok: false, kind: GroovingLlmFailureKind.Failed, reason, usage: { inputTokens: 0, outputTokens: 0 } };
}
