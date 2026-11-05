// Pure helpers of the Grooving service: what the page sends back is only trusted after these checks
// (the page shares its world with Google's scripts), plus small helpers for the settings and the LLM results
import {
  clipGroovingTrack,
  GroovingCandidate,
  GroovingConsent,
  GroovingConsentChoice,
  GroovingDirection,
  GroovingFailureReason,
  GroovingMood,
  groovingMoodLabel,
  GroovingMoodItem,
  GroovingMoodSection,
  GroovingRoundRecord,
  GroovingSources,
  GroovingTrack,
  GroovingTrackKind,
  GroovingUsage
} from "~shared/grooving";
import { groovingFamiliarCount, groovingListCandidates } from "~shared/grooving/answer";
import {
  buildGroovingContinuationCandidates,
  groovingAvoidedArtists,
  groovingContinuationEnough,
  GroovingReaction
} from "~shared/grooving/continuation";
import type { LikeStatus, PlayerState } from "~shared/playerstatestore/types";
import type { GroovingLlmResult } from "./llm";

// What the page can send back is only trusted after these checks (the page shares its world with Google's scripts)
const VIDEO_ID_PATTERN = /^[\w-]{1,32}$/;
const MAX_TRACKS = 500;
const MAX_MOODS = 300;
export const MAX_TEXT = 300;
export const MOOD_TEXT_MAX = 200;
// The seed song's videoId from the page, kept as a plain string; longer than any real one
export const SEED_VIDEO_ID_MAX = 64;

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
  if (!history || !liked || !related || !mood) return null;

  // Only a song mood has these. The page decides the seed's videoId when the mood had none
  const sources: GroovingSources = { history, liked, related, mood };
  if (value.seedMissing === true) sources.seedMissing = true;
  if (typeof value.seedVideoId === "string" && value.seedVideoId !== "") sources.seedVideoId = value.seedVideoId.slice(0, SEED_VIDEO_ID_MAX);
  return sources;
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

// What main remembers of the track playing. The values are copied out of the player state, because its videoDetails object
// is changed in place, and the position is the largest one seen while this videoId is on (the page sends a new track's 0
// before its details). parked is the track a preview interrupted
export type TrackWatch = {
  videoId: string;
  maxProgress: number;
  durationSeconds: number;
  likeStatus: LikeStatus;
  preview: boolean;
  parked: TrackWatch | null;
};

export type TrackObservation = {
  next: TrackWatch | null;
  // The track that ended, for the report; its reaction is decided from these values by groovingReaction
  reaction: { videoId: string; last: { progressSeconds: number; durationSeconds: number; likeStatus: LikeStatus } } | null;
  // The videoId that started
  started: string | null;
};

function watch(videoId: string, durationSeconds: number, likeStatus: LikeStatus, preview: boolean, parked: TrackWatch | null): TrackWatch {
  return { videoId, maxProgress: 0, durationSeconds, likeStatus, preview, parked };
}

// The store moves the queue to the next track before the details follow, and overwrites videoDetails.likeStatus in place
// with the like of that next track. While the queue selects another track, the like seen is not the watched one's
function selectsAnotherTrack(state: PlayerState, videoId: string): boolean {
  const queue = state.queue;
  if (queue === null || queue.selectedItemIndex < 0) return false;
  return queue.items[queue.selectedItemIndex]?.videoId !== videoId;
}

// The next watch, the track that ended and the track that started, from one player state.
// A preview's own track is watched apart: it gets neither reaction nor start, and the parked track goes on after it
export function observeTrack(previous: TrackWatch | null, state: PlayerState, previewing: string | null): TrackObservation {
  const details = state.videoDetails;
  // An ad is not the track, and its position says nothing about the track
  if (state.adPlaying || details === null) return { next: previous, reaction: null, started: null };

  const videoId = details.id;
  const durationSeconds = details.durationSeconds;
  const likeStatus = details.likeStatus;
  const progress = Number.isFinite(state.videoProgress) && state.videoProgress >= 0 ? state.videoProgress : 0;

  if (previous === null) {
    // Done just began: this position can still be the earlier track's, so it is not counted
    return { next: watch(videoId, durationSeconds, likeStatus, previewing === videoId, null), reaction: null, started: null };
  }

  if (previous.videoId === videoId) {
    // Back from a preview: this position can still be the preview track's, so the parked position is kept
    if (previous.preview && previewing !== videoId && previous.parked !== null && previous.parked.videoId === videoId) {
      const like = selectsAnotherTrack(state, videoId) ? previous.parked.likeStatus : likeStatus;
      return { next: { ...previous.parked, durationSeconds, likeStatus: like }, reaction: null, started: null };
    }
    return {
      next: {
        ...previous,
        maxProgress: Math.max(previous.maxProgress, progress),
        durationSeconds,
        likeStatus: selectsAnotherTrack(state, videoId) ? previous.likeStatus : likeStatus
      },
      reaction: null,
      started: null
    };
  }

  const parked = previous.preview ? previous.parked : previous;
  if (previewing === videoId) {
    // A preview started: the track it interrupted is parked, as this is not a skip of it
    return { next: watch(videoId, durationSeconds, likeStatus, true, parked), reaction: null, started: null };
  }
  if (previous.preview && parked !== null && parked.videoId === videoId) {
    // The preview ended back on the track it interrupted: no reaction for the preview and no start again
    const like = selectsAnotherTrack(state, videoId) ? parked.likeStatus : likeStatus;
    return { next: { ...parked, durationSeconds, likeStatus: like }, reaction: null, started: null };
  }

  return {
    next: watch(videoId, durationSeconds, likeStatus, false, null),
    // A preview that ended on another track gives no reaction either
    reaction: previous.preview
      ? null
      : {
          videoId: previous.videoId,
          last: { progressSeconds: previous.maxProgress, durationSeconds: previous.durationSeconds, likeStatus: previous.likeStatus }
        },
    started: videoId
  };
}

// The artists of the familiar candidates, for when the run's known artists were not kept
export function knownArtistsOfCandidates(candidates: GroovingCandidate[]): Set<string> {
  const known = new Set<string>();
  for (const track of candidates) {
    if (track.kind !== GroovingTrackKind.Familiar) continue;
    for (const artist of track.artists) {
      const name = artist.trim().toLowerCase();
      if (name !== "") known.add(name);
    }
  }
  return known;
}

// The continuation's candidates and whether they are enough, from the run's candidates, the answers and the reactions.
// The run's candidates leave out the tracks the pairs dropped. The mix's familiar count comes from those run candidates,
// not the continuation's: the run's tracks are left out of those
export function continuationRequest(input: {
  candidates: GroovingCandidate[];
  direction: GroovingDirection;
  history: GroovingRoundRecord[];
  listed: GroovingCandidate[];
  reactions: Record<string, GroovingReaction>;
  knownArtists: Set<string>;
  related: GroovingTrack[];
}): { candidates: GroovingCandidate[]; familiarCount: number; enough: boolean; avoidedArtists: string[] } {
  const avoidedArtists = groovingAvoidedArtists(input.listed, input.reactions);
  const runCandidates = groovingListCandidates({ candidates: input.candidates, direction: input.direction, history: input.history });
  const candidates = buildGroovingContinuationCandidates({
    candidates: runCandidates,
    related: input.related,
    knownArtists: input.knownArtists,
    listedVideoIds: input.listed.map(track => track.videoId),
    avoidedArtists,
    direction: input.direction
  });
  // The mix's share needs the run's tracks, which the pairs chose; the other directions only have the continuation's
  const familiarCount = groovingFamiliarCount({
    direction: input.direction,
    history: input.history,
    candidates: input.direction === GroovingDirection.Mix ? runCandidates : candidates
  });
  return { candidates, familiarCount, enough: groovingContinuationEnough(candidates, input.direction, familiarCount), avoidedArtists };
}
