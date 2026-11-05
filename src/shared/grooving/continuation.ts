// Decides the reaction to a track and builds the candidates for a continuation list (see docs/specs/grooving-continue.md).
// Pure, no dependencies other than the shared Grooving names

import { LikeStatus } from "~shared/playerstatestore/types";
import { alternate, mark, uniqueByVideoId } from "./candidates";
import { GROOVING_CANDIDATE_LIMIT, GROOVING_LIST_LENGTH, GroovingCandidate, GroovingDirection, GroovingTrack, GroovingTrackKind } from "./index";

export const GroovingReaction = {
  PlayedThrough: "played-through",
  Skipped: "skipped",
  Liked: "liked",
  Disliked: "disliked"
} as const;
export type GroovingReaction = (typeof GroovingReaction)[keyof typeof GroovingReaction];

// A track is skipped when the listener moved on before this many seconds, or before a third of the track when that is shorter
const GROOVING_SKIP_SECONDS = 30;

// A dislike comes first, then a like, then the skip, then the play through
export function groovingReaction(last: { progressSeconds: number; durationSeconds: number; likeStatus: LikeStatus }): GroovingReaction {
  if (last.likeStatus === LikeStatus.Dislike) return GroovingReaction.Disliked;
  if (last.likeStatus === LikeStatus.Like) return GroovingReaction.Liked;
  const skipBefore = last.durationSeconds > 0 ? Math.min(GROOVING_SKIP_SECONDS, last.durationSeconds / 3) : GROOVING_SKIP_SECONDS;
  return last.progressSeconds < skipBefore ? GroovingReaction.Skipped : GroovingReaction.PlayedThrough;
}

// The first artist's name, trimmed and lower-cased; "" when the track has no artist name
function artistKey(track: GroovingTrack): string {
  const first = track.artists.at(0);
  return first === undefined ? "" : first.trim().toLowerCase();
}

// The first artists of the skipped and the disliked tracks, once each, without case and surrounding spaces
export function groovingAvoidedArtists(listed: GroovingCandidate[] | GroovingTrack[], reactions: Record<string, GroovingReaction>): string[] {
  const avoided = new Set<string>();
  for (const track of listed) {
    const reaction = reactions[track.videoId];
    if (reaction !== GroovingReaction.Skipped && reaction !== GroovingReaction.Disliked) continue;
    const artist = artistKey(track);
    if (artist !== "") avoided.add(artist);
  }
  return [...avoided];
}

// Keeps the related tracks the direction asks for, the same way buildGroovingCandidates does: familiar, new, or a mix of both
function relatedForDirection(related: GroovingCandidate[], direction: GroovingDirection): GroovingCandidate[] {
  const familiar = related.filter(track => track.kind === GroovingTrackKind.Familiar);
  if (direction === GroovingDirection.Familiar) return familiar;
  const fresh = related.filter(track => track.kind === GroovingTrackKind.New);
  if (direction === GroovingDirection.Discover) return fresh;
  return alternate(familiar, fresh);
}

// The related tracks (marked and narrowed by the direction) first, then the candidates of the run. Leaves out the tracks
// already in the list, the tracks of the avoided artists and the duplicates, and cuts the rest at 80
export function buildGroovingContinuationCandidates(input: {
  candidates: GroovingCandidate[];
  related: GroovingTrack[];
  knownArtists: Set<string>;
  listedVideoIds: string[];
  avoidedArtists: string[];
  direction: GroovingDirection;
}): GroovingCandidate[] {
  const related = relatedForDirection(
    input.related.map(track => mark(track, input.knownArtists)),
    input.direction
  );
  const listed = new Set(input.listedVideoIds);
  const avoided = new Set(input.avoidedArtists.map(artist => artist.trim().toLowerCase()).filter(artist => artist !== ""));
  return uniqueByVideoId([...related, ...input.candidates])
    .filter(track => !listed.has(track.videoId) && !avoided.has(artistKey(track)))
    .slice(0, GROOVING_CANDIDATE_LIMIT);
}

// Enough candidates for a continuation list: 25 tracks, and for a mix also familiarCount familiar and
// 25 - familiarCount new tracks (no pairs, so no spare for the tracks an answer drops)
export function groovingContinuationEnough(candidates: GroovingCandidate[], direction: GroovingDirection, familiarCount: number): boolean {
  const known = new Set<string>();
  let familiar = 0;
  for (const track of candidates) {
    if (known.has(track.videoId)) continue;
    known.add(track.videoId);
    if (track.kind === GroovingTrackKind.Familiar) familiar++;
  }
  if (known.size < GROOVING_LIST_LENGTH) return false;
  if (direction !== GroovingDirection.Mix) return true;
  return familiar >= familiarCount && known.size - familiar >= GROOVING_LIST_LENGTH - familiarCount;
}
