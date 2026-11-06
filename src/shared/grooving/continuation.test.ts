import { describe, expect, it } from "vitest";
import { LikeStatus } from "~shared/playerstatestore/types";
import {
  buildGroovingContinuationCandidates,
  groovingAvoidedArtists,
  groovingContinuationEnough,
  GroovingReaction,
  groovingReaction
} from "./continuation";
import { GROOVING_CANDIDATE_LIMIT, GROOVING_LIST_LENGTH, GroovingCandidate, GroovingDirection, GroovingTrack, GroovingTrackKind } from "./index";

const track = (videoId: string, ...artists: string[]): GroovingTrack => ({ videoId, title: `Title ${videoId}`, artists, thumbnailUrl: null });

const candidate = (videoId: string, kind: GroovingTrackKind, ...artists: string[]): GroovingCandidate => ({
  ...track(videoId, ...artists),
  kind
});

// n tracks with ids <prefix>-0.. by the given artist
const tracks = (prefix: string, n: number, artist: string): GroovingTrack[] => Array.from({ length: n }, (_, i) => track(`${prefix}-${i}`, artist));

// n candidates with ids <prefix>-0.. of the given kind and artist
const candidates = (prefix: string, n: number, kind: GroovingTrackKind, artist: string): GroovingCandidate[] =>
  Array.from({ length: n }, (_, i) => candidate(`${prefix}-${i}`, kind, artist));

const ids = (list: { videoId: string }[]): string[] => list.map(t => t.videoId);
const kinds = (list: { kind: GroovingTrackKind }[]): GroovingTrackKind[] => list.map(t => t.kind);

const last = (progressSeconds: number, durationSeconds: number, likeStatus: LikeStatus = LikeStatus.Indifferent) => ({
  progressSeconds,
  durationSeconds,
  likeStatus
});

type ContinuationInput = Parameters<typeof buildGroovingContinuationCandidates>[0];

const input = (partial: Partial<ContinuationInput> = {}): ContinuationInput => ({
  candidates: [],
  related: [],
  knownArtists: new Set<string>(),
  listedVideoIds: [],
  avoidedArtists: [],
  direction: GroovingDirection.Mix,
  ...partial
});

describe("groovingReaction", () => {
  it("gives Disliked for a dislike, even at the very start of the track", () => {
    expect(groovingReaction(last(0, 200, LikeStatus.Dislike))).toBe(GroovingReaction.Disliked);
    expect(groovingReaction(last(200, 200, LikeStatus.Dislike))).toBe(GroovingReaction.Disliked);
  });

  it("gives Liked for a like, even when the track was skipped", () => {
    expect(groovingReaction(last(0, 200, LikeStatus.Like))).toBe(GroovingReaction.Liked);
    expect(groovingReaction(last(200, 200, LikeStatus.Like))).toBe(GroovingReaction.Liked);
  });

  it("gives Skipped when the listener moved on before 30 seconds", () => {
    expect(groovingReaction(last(0, 600))).toBe(GroovingReaction.Skipped);
    expect(groovingReaction(last(29.9, 600))).toBe(GroovingReaction.Skipped);
  });

  it("gives PlayedThrough at 30 seconds and after", () => {
    expect(groovingReaction(last(30, 600))).toBe(GroovingReaction.PlayedThrough);
    expect(groovingReaction(last(600, 600))).toBe(GroovingReaction.PlayedThrough);
  });

  it("gives Skipped before a third of a short track", () => {
    expect(groovingReaction(last(19.9, 60))).toBe(GroovingReaction.Skipped);
  });

  it("gives PlayedThrough at a third of a short track", () => {
    expect(groovingReaction(last(20, 60))).toBe(GroovingReaction.PlayedThrough);
  });

  it("uses 30 seconds when the length is 0 or less", () => {
    expect(groovingReaction(last(29.9, 0))).toBe(GroovingReaction.Skipped);
    expect(groovingReaction(last(30, 0))).toBe(GroovingReaction.PlayedThrough);
    expect(groovingReaction(last(29.9, -1))).toBe(GroovingReaction.Skipped);
  });
});

describe("groovingAvoidedArtists", () => {
  it("collects the first artist of the skipped and the disliked tracks", () => {
    const listed = [track("t1", "Alpha", "Other"), track("t2", "Beta"), track("t3", "Gamma"), track("t4", "Delta")];
    const reactions = {
      t1: GroovingReaction.Skipped,
      t2: GroovingReaction.Disliked,
      t3: GroovingReaction.PlayedThrough,
      t4: GroovingReaction.Liked
    };
    expect(groovingAvoidedArtists(listed, reactions)).toEqual(["alpha", "beta"]);
  });

  it("uses only the first artist of a track", () => {
    expect(groovingAvoidedArtists([track("t1", "Alpha", "Beta")], { t1: GroovingReaction.Skipped })).toEqual(["alpha"]);
    expect(groovingAvoidedArtists([track("t1", "Beta", "Alpha")], { t1: GroovingReaction.Skipped })).toEqual(["beta"]);
  });

  it("compares the artists without case and surrounding spaces and returns each once", () => {
    const listed = [track("t1", "  Alpha "), track("t2", "ALPHA"), track("t3", "alpha\t")];
    const reactions = { t1: GroovingReaction.Skipped, t2: GroovingReaction.Disliked, t3: GroovingReaction.Skipped };
    expect(groovingAvoidedArtists(listed, reactions)).toEqual(["alpha"]);
  });

  it("ignores the tracks without a reaction and the tracks without an artist name", () => {
    expect(groovingAvoidedArtists([track("t1"), track("t2", "  ")], { t1: GroovingReaction.Skipped })).toEqual([]);
    expect(groovingAvoidedArtists([track("t1", "Alpha")], {})).toEqual([]);
  });
});

describe("buildGroovingContinuationCandidates", () => {
  it("puts the related tracks before the candidates of the run", () => {
    const result = buildGroovingContinuationCandidates(
      input({
        direction: GroovingDirection.Familiar,
        knownArtists: new Set(["alpha"]),
        related: [track("r-1", "Alpha"), track("r-2", "Stranger")],
        candidates: [candidate("c-1", GroovingTrackKind.New, "Stranger")]
      })
    );
    expect(ids(result)).toEqual(["r-1", "c-1"]);
  });

  it("marks the related tracks as familiar or new", () => {
    const result = buildGroovingContinuationCandidates(
      input({
        direction: GroovingDirection.Mix,
        knownArtists: new Set(["alpha"]),
        related: [track("r-1", "  ALPHA "), track("r-2", "Stranger"), track("r-3", "Beta", "alpha")]
      })
    );
    expect(result).toEqual([
      { ...track("r-1", "  ALPHA "), kind: GroovingTrackKind.Familiar },
      { ...track("r-2", "Stranger"), kind: GroovingTrackKind.New },
      { ...track("r-3", "Beta", "alpha"), kind: GroovingTrackKind.Familiar }
    ]);
  });

  it("keeps only the familiar related tracks for familiar", () => {
    const result = buildGroovingContinuationCandidates(
      input({
        direction: GroovingDirection.Familiar,
        knownArtists: new Set(["alpha"]),
        related: [track("r-1", "Alpha"), track("r-2", "Stranger")]
      })
    );
    expect(ids(result)).toEqual(["r-1"]);
  });

  it("keeps only the new related tracks for discover", () => {
    const result = buildGroovingContinuationCandidates(
      input({
        direction: GroovingDirection.Discover,
        knownArtists: new Set(["alpha"]),
        related: [track("r-1", "Alpha"), track("r-2", "Stranger")]
      })
    );
    expect(ids(result)).toEqual(["r-2"]);
  });

  it("alternates the familiar and the new related tracks for a mix", () => {
    const result = buildGroovingContinuationCandidates(
      input({
        direction: GroovingDirection.Mix,
        knownArtists: new Set(["alpha"]),
        related: [...tracks("f", 2, "Alpha"), ...tracks("n", 2, "Stranger")]
      })
    );
    expect(ids(result)).toEqual(["f-0", "n-0", "f-1", "n-1"]);
    expect(kinds(result)).toEqual([GroovingTrackKind.Familiar, GroovingTrackKind.New, GroovingTrackKind.Familiar, GroovingTrackKind.New]);
  });

  it("leaves out the tracks that are already in the list", () => {
    const result = buildGroovingContinuationCandidates(
      input({
        direction: GroovingDirection.Familiar,
        knownArtists: new Set(["alpha"]),
        related: [track("r-1", "Alpha"), track("r-2", "Alpha")],
        candidates: [candidate("c-1", GroovingTrackKind.Familiar, "Alpha"), candidate("c-2", GroovingTrackKind.Familiar, "Alpha")],
        listedVideoIds: ["r-1", "c-1"]
      })
    );
    expect(ids(result)).toEqual(["r-2", "c-2"]);
  });

  it("leaves out the tracks of the avoided artists, compared without case and surrounding spaces", () => {
    const result = buildGroovingContinuationCandidates(
      input({
        direction: GroovingDirection.Mix,
        candidates: [
          candidate("c-1", GroovingTrackKind.New, " Alpha "),
          candidate("c-2", GroovingTrackKind.New, "Stranger"),
          candidate("c-3", GroovingTrackKind.New, "Stranger", "ALPHA")
        ],
        avoidedArtists: ["ALPHA", " beta "]
      })
    );
    expect(ids(result)).toEqual(["c-2", "c-3"]);
  });

  it("leaves out the duplicates, keeping the first track", () => {
    const first = { ...track("dup", "Alpha"), title: "First" };
    const again = { ...track("dup", "Alpha"), title: "Again" };
    const result = buildGroovingContinuationCandidates(
      input({
        direction: GroovingDirection.Familiar,
        knownArtists: new Set(["alpha"]),
        related: [first],
        candidates: [
          candidate("dup", GroovingTrackKind.New, "Stranger"),
          { ...again, kind: GroovingTrackKind.New },
          candidate("c-1", GroovingTrackKind.Familiar, "Alpha")
        ]
      })
    );
    expect(result).toEqual([{ ...first, kind: GroovingTrackKind.Familiar }, candidate("c-1", GroovingTrackKind.Familiar, "Alpha")]);
  });

  it("cuts the candidates at 80, related tracks first", () => {
    const result = buildGroovingContinuationCandidates(
      input({
        direction: GroovingDirection.Familiar,
        knownArtists: new Set(["alpha"]),
        related: tracks("r", 60, "Alpha"),
        candidates: candidates("c", 60, GroovingTrackKind.Familiar, "Alpha")
      })
    );
    expect(result).toHaveLength(GROOVING_CANDIDATE_LIMIT);
    expect(ids(result)).toEqual([
      ...ids(tracks("r", 60, "x")),
      ...ids(candidates("c", GROOVING_CANDIDATE_LIMIT - 60, GroovingTrackKind.Familiar, "x"))
    ]);
  });

  it("returns nothing when there are no tracks", () => {
    expect(buildGroovingContinuationCandidates(input())).toEqual([]);
  });
});

describe("groovingContinuationEnough", () => {
  const ofKind = (n: number, kind: GroovingTrackKind, prefix: string): GroovingCandidate[] => candidates(prefix, n, kind, `Artist ${prefix}`);

  it("needs 25 tracks", () => {
    expect(groovingContinuationEnough(ofKind(GROOVING_LIST_LENGTH - 1, GroovingTrackKind.Familiar, "f"), GroovingDirection.Familiar, 0)).toBe(false);
    expect(groovingContinuationEnough(ofKind(GROOVING_LIST_LENGTH, GroovingTrackKind.Familiar, "f"), GroovingDirection.Familiar, 0)).toBe(true);
  });

  it("counts the duplicates once", () => {
    const list = ofKind(GROOVING_LIST_LENGTH, GroovingTrackKind.Familiar, "f");
    expect(groovingContinuationEnough([...list, list[0]], GroovingDirection.Familiar, 0)).toBe(true);
    expect(
      groovingContinuationEnough([...ofKind(GROOVING_LIST_LENGTH - 1, GroovingTrackKind.Familiar, "f"), list[0]], GroovingDirection.Familiar, 0)
    ).toBe(false);
  });

  it("does not mind the kinds for familiar and discover", () => {
    const list = ofKind(GROOVING_LIST_LENGTH, GroovingTrackKind.New, "n");
    expect(groovingContinuationEnough(list, GroovingDirection.Familiar, GROOVING_LIST_LENGTH)).toBe(true);
    expect(groovingContinuationEnough(list, GroovingDirection.Discover, 0)).toBe(true);
  });

  it("needs familiarCount familiar tracks in a mix", () => {
    const list = [...ofKind(10, GroovingTrackKind.Familiar, "f"), ...ofKind(15, GroovingTrackKind.New, "n")];
    expect(groovingContinuationEnough(list, GroovingDirection.Mix, 10)).toBe(true);
    expect(groovingContinuationEnough(list, GroovingDirection.Mix, 11)).toBe(false);
  });

  it("needs 25 - familiarCount new tracks in a mix", () => {
    const list = [...ofKind(15, GroovingTrackKind.Familiar, "f"), ...ofKind(10, GroovingTrackKind.New, "n")];
    expect(groovingContinuationEnough(list, GroovingDirection.Mix, 15)).toBe(true);
    expect(groovingContinuationEnough(list, GroovingDirection.Mix, 14)).toBe(false);
  });

  it("needs 25 tracks in a mix as well", () => {
    const list = [...ofKind(10, GroovingTrackKind.Familiar, "f"), ...ofKind(14, GroovingTrackKind.New, "n")];
    expect(groovingContinuationEnough(list, GroovingDirection.Mix, 10)).toBe(false);
  });
});
