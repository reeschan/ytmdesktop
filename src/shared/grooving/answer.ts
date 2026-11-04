// Checks of the LLM's answers (pairs and lists), the familiar share of a mix, the per-artist track limit of a list
// (3 tracks per first artist, eased when the candidates lean on a few artists) and whether the candidates are enough. Pure, no dependencies
import {
  GROOVING_LIST_LENGTH,
  GROOVING_MIX_MIN_SHARE,
  GroovingAnswer,
  GroovingCandidate,
  GroovingDirection,
  GroovingList,
  GroovingPair,
  GroovingRoundRecord,
  GroovingRounds,
  GroovingTrackKind
} from "./index";

// problem is a short English sentence for the log
export type GroovingCheck = { ok: true } | { ok: false; problem: string };

const OK: GroovingCheck = { ok: true };
const fail = (problem: string): GroovingCheck => ({ ok: false, problem });

function byVideoId(candidates: GroovingCandidate[]): Map<string, GroovingCandidate> {
  const map = new Map<string, GroovingCandidate>();
  for (const candidate of candidates) {
    if (!map.has(candidate.videoId)) map.set(candidate.videoId, candidate);
  }
  return map;
}

// How many tracks of one artist a list may have, unless the candidates force more (see groovingArtistLimit)
export const GROOVING_ARTIST_TRACK_LIMIT = 3;

// The first artist's name, trimmed and lower-cased; "" when the track has no artist name
function artistKey(track: GroovingCandidate): string {
  const first = track.artists.at(0);
  return first === undefined ? "" : first.trim().toLowerCase();
}

// The smallest limit c (from 3 up to 25) such that, with every artist's candidates cut to c tracks, there are still
// familiarCount familiar tracks, 25 - familiarCount new tracks and 25 tracks in all. Tracks without an artist name are
// never cut. 25 when no such c exists. familiarCount 0 asks for new tracks only (for example Discover)
export function groovingArtistLimit(candidates: GroovingCandidate[], familiarCount: number): number {
  const artists = new Map<string, { familiar: number; fresh: number }>();
  let unnamedFamiliar = 0;
  let unnamedFresh = 0;
  for (const track of byVideoId(candidates).values()) {
    const familiar = track.kind === GroovingTrackKind.Familiar;
    const key = artistKey(track);
    if (key === "") {
      if (familiar) unnamedFamiliar++;
      else unnamedFresh++;
      continue;
    }
    const counts = artists.get(key) ?? { familiar: 0, fresh: 0 };
    if (familiar) counts.familiar++;
    else counts.fresh++;
    artists.set(key, counts);
  }

  for (let limit = GROOVING_ARTIST_TRACK_LIMIT; limit <= GROOVING_LIST_LENGTH; limit++) {
    let familiar = unnamedFamiliar;
    let fresh = unnamedFresh;
    let all = unnamedFamiliar + unnamedFresh;
    for (const counts of artists.values()) {
      familiar += Math.min(counts.familiar, limit);
      fresh += Math.min(counts.fresh, limit);
      all += Math.min(counts.familiar + counts.fresh, limit);
    }
    if (familiar >= familiarCount && fresh >= GROOVING_LIST_LENGTH - familiarCount && all >= GROOVING_LIST_LENGTH) return limit;
  }
  return GROOVING_LIST_LENGTH;
}

// Enough candidates for the pairs and the list: 25 tracks, and for a mix at least `rounds` familiar and `rounds` new
// tracks (every mix pair uses one of each, and a shown track cannot come back). Familiar and discover look at the count only
export function groovingCandidatesEnough(candidates: GroovingCandidate[], direction: GroovingDirection, rounds: GroovingRounds): boolean {
  const known = byVideoId(candidates);
  if (known.size < GROOVING_LIST_LENGTH) return false;
  if (direction !== GroovingDirection.Mix) return true;
  let familiar = 0;
  for (const track of known.values()) {
    if (track.kind === GroovingTrackKind.Familiar) familiar++;
  }
  return familiar >= rounds && known.size - familiar >= rounds;
}

// Both tracks are candidates, they differ, neither was shown, and a mix has one familiar and one new track
export function checkGroovingPair(
  pair: GroovingPair,
  input: { candidates: GroovingCandidate[]; direction: GroovingDirection; shown: string[] }
): GroovingCheck {
  const known = byVideoId(input.candidates);
  const left = known.get(pair.left);
  const right = known.get(pair.right);
  if (!left) return fail("left is not a candidate");
  if (!right) return fail("right is not a candidate");
  if (pair.left === pair.right) return fail("left and right are the same track");
  if (input.shown.includes(pair.left)) return fail("left was shown before");
  if (input.shown.includes(pair.right)) return fail("right was shown before");
  if (input.direction === GroovingDirection.Mix && left.kind === right.kind) {
    return fail("a mix pair needs one familiar and one new track");
  }
  return OK;
}

// 25 tracks, no duplicates, all candidates, a mood description, and the kinds the direction asks for:
// familiar and mix have exactly familiarCount familiar tracks (familiar may be filled up with new ones), discover is all new.
// Last, no first artist (trimmed, lower-cased; tracks without one are not counted) has more tracks than groovingArtistLimit
export function checkGroovingList(
  list: GroovingList,
  input: { candidates: GroovingCandidate[]; direction: GroovingDirection; familiarCount: number }
): GroovingCheck {
  if (list.videoIds.length !== GROOVING_LIST_LENGTH) {
    return fail(`the list has ${list.videoIds.length} tracks, not ${GROOVING_LIST_LENGTH} tracks`);
  }
  if (new Set(list.videoIds).size !== list.videoIds.length) return fail("a track appears twice in the list");
  if (list.moodDescription.trim() === "") return fail("the mood description is empty");

  const known = byVideoId(input.candidates);
  let familiar = 0;
  for (const videoId of list.videoIds) {
    const track = known.get(videoId);
    if (!track) return fail(`${videoId} is not a candidate`);
    if (input.direction === GroovingDirection.Discover && track.kind !== GroovingTrackKind.New) {
      return fail(`${videoId} is not new`);
    }
    if (track.kind === GroovingTrackKind.Familiar) familiar++;
  }
  if (input.direction !== GroovingDirection.Discover && familiar !== input.familiarCount) {
    return fail(`the ${input.direction} list has ${familiar} familiar tracks, not ${input.familiarCount}`);
  }

  const limit = groovingArtistLimit(input.candidates, input.familiarCount);
  const perArtist = new Map<string, number>();
  for (const videoId of list.videoIds) {
    // Every track is a candidate by now
    const track = known.get(videoId);
    const key = track ? artistKey(track) : "";
    if (key !== "") perArtist.set(key, (perArtist.get(key) ?? 0) + 1);
  }
  for (const [artist, count] of perArtist) {
    if (count > limit) return fail(`artist "${artist}" has ${count} tracks, more than ${limit}`);
  }
  return OK;
}

// How many familiar tracks the list gets: 25 for familiar, 0 for discover.
// A mix uses the share of familiar tracks among the chosen ones (neither left out), kept in [0.2, 0.8]; 0.5 with no choices.
// Then, in every direction, the count is kept within the candidates: no more familiar tracks than the familiar candidates,
// and no more new tracks (25 - count) than the new candidates. The short side is filled up with the other kind
export function groovingFamiliarCount(input: {
  direction: GroovingDirection;
  history: GroovingRoundRecord[];
  candidates: GroovingCandidate[];
}): number {
  const known = byVideoId(input.candidates);
  let familiarCandidates = 0;
  for (const track of known.values()) {
    if (track.kind === GroovingTrackKind.Familiar) familiarCandidates++;
  }
  const newCandidates = known.size - familiarCandidates;

  const wanted = directionFamiliarCount(input.direction, input.history, known);
  return Math.max(GROOVING_LIST_LENGTH - newCandidates, Math.min(familiarCandidates, wanted));
}

function directionFamiliarCount(direction: GroovingDirection, history: GroovingRoundRecord[], known: Map<string, GroovingCandidate>): number {
  if (direction === GroovingDirection.Familiar) return GROOVING_LIST_LENGTH;
  if (direction === GroovingDirection.Discover) return 0;

  let chosen = 0;
  let familiar = 0;
  for (const { pair, answer } of history) {
    if (answer === GroovingAnswer.Neither) continue;
    const track = known.get(answer === GroovingAnswer.Left ? pair.left : pair.right);
    // A chosen track that is not a candidate tells nothing about the share
    if (!track) continue;
    chosen++;
    if (track.kind === GroovingTrackKind.Familiar) familiar++;
  }
  const share = chosen === 0 ? 0.5 : familiar / chosen;
  const kept = Math.min(1 - GROOVING_MIX_MIN_SHARE, Math.max(GROOVING_MIX_MIN_SHARE, share));
  return Math.round(kept * GROOVING_LIST_LENGTH);
}
