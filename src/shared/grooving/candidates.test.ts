import { describe, expect, it } from "vitest";
import { buildGroovingCandidates, knownArtists } from "./candidates";
import { GROOVING_CANDIDATE_LIMIT, GROOVING_FAMILIAR_MINIMUM, GroovingDirection, GroovingSources, GroovingTrack, GroovingTrackKind } from "./index";

const track = (videoId: string, ...artists: string[]): GroovingTrack => ({ videoId, title: `Title ${videoId}`, artists, thumbnailUrl: null });

// n tracks with ids <prefix>-0.. by the given artist
const tracks = (prefix: string, n: number, artist: string): GroovingTrack[] => Array.from({ length: n }, (_, i) => track(`${prefix}-${i}`, artist));

const sources = (partial: Partial<GroovingSources>): GroovingSources => ({ history: [], liked: [], related: [], mood: [], ...partial });

const ids = (list: { videoId: string }[]): string[] => list.map(t => t.videoId);
const kinds = (list: { kind: GroovingTrackKind }[]): GroovingTrackKind[] => list.map(t => t.kind);

describe("knownArtists", () => {
  it("collects the artists of the history and the liked tracks", () => {
    const known = knownArtists([track("h1", "Alpha"), track("h2", "Beta", "Gamma")], [track("l1", "Delta")]);
    expect([...known].sort()).toEqual(["alpha", "beta", "delta", "gamma"]);
  });

  it("ignores the case and the spaces around the name", () => {
    const known = knownArtists([track("h1", "  Alpha ")], [track("l1", "ALPHA"), track("l2", "beta\t")]);
    expect([...known].sort()).toEqual(["alpha", "beta"]);
  });

  it("is empty when there are no tracks", () => {
    expect(knownArtists([], []).size).toBe(0);
  });
});

describe("buildGroovingCandidates", () => {
  describe("familiar", () => {
    it("keeps only the familiar tracks of the history, the liked and the related tracks", () => {
      const result = buildGroovingCandidates({
        direction: GroovingDirection.Familiar,
        historyShared: true,
        sources: sources({
          history: tracks("h", 10, "Alpha"),
          liked: tracks("l", 10, "Beta"),
          related: [...tracks("r", 10, "Alpha"), track("r-other", "Stranger")],
          mood: tracks("m", 5, "Alpha")
        })
      });
      expect(ids(result.candidates)).toEqual([...ids(tracks("h", 10, "x")), ...ids(tracks("l", 10, "x")), ...ids(tracks("r", 10, "x"))]);
      expect(kinds(result.candidates).every(k => k === GroovingTrackKind.Familiar)).toBe(true);
      expect(result.filledFromMood).toBe(false);
    });

    it("does not fill from the mood when there are 30 familiar tracks", () => {
      const result = buildGroovingCandidates({
        direction: GroovingDirection.Familiar,
        historyShared: true,
        sources: sources({ history: tracks("h", GROOVING_FAMILIAR_MINIMUM, "Alpha"), mood: tracks("m", 5, "Stranger") })
      });
      expect(result.candidates).toHaveLength(GROOVING_FAMILIAR_MINIMUM);
      expect(result.filledFromMood).toBe(false);
    });

    it("fills from the mood tracks that are not in the candidates when there are fewer than 30, keeping their kind", () => {
      const result = buildGroovingCandidates({
        direction: GroovingDirection.Familiar,
        historyShared: true,
        sources: sources({
          history: tracks("h", GROOVING_FAMILIAR_MINIMUM - 1, "Alpha"),
          mood: [track("h-0", "Alpha"), track("m-new", "Stranger"), track("m-known", "alpha")]
        })
      });
      expect(ids(result.candidates)).toEqual([...ids(tracks("h", GROOVING_FAMILIAR_MINIMUM - 1, "x")), "m-new", "m-known"]);
      expect(result.candidates.find(c => c.videoId === "m-new")?.kind).toBe(GroovingTrackKind.New);
      expect(result.candidates.find(c => c.videoId === "m-known")?.kind).toBe(GroovingTrackKind.Familiar);
      expect(result.filledFromMood).toBe(true);
    });

    it("counts the familiar tracks after removing the duplicates", () => {
      const history = tracks("h", GROOVING_FAMILIAR_MINIMUM - 1, "Alpha");
      const result = buildGroovingCandidates({
        direction: GroovingDirection.Familiar,
        historyShared: true,
        sources: sources({ history, liked: [history[0]], mood: [track("m-1", "Stranger")] })
      });
      expect(result.filledFromMood).toBe(true);
      expect(ids(result.candidates)).toEqual([...ids(history), "m-1"]);
    });
  });

  describe("discover", () => {
    it("keeps only the new tracks of the mood", () => {
      const result = buildGroovingCandidates({
        direction: GroovingDirection.Discover,
        historyShared: true,
        sources: sources({
          history: [track("h-1", "Alpha")],
          liked: [track("l-1", "Beta")],
          related: [track("r-1", "Stranger")],
          mood: [track("m-1", "Alpha"), track("m-2", "Stranger"), track("m-3", "Beta"), track("m-4", "Other")]
        })
      });
      expect(ids(result.candidates)).toEqual(["m-2", "m-4"]);
      expect(kinds(result.candidates).every(k => k === GroovingTrackKind.New)).toBe(true);
      expect(result.filledFromMood).toBe(false);
    });

    it("still uses the history to decide the artists when the history is not shared", () => {
      const result = buildGroovingCandidates({
        direction: GroovingDirection.Discover,
        historyShared: false,
        sources: sources({
          history: [track("h-1", "Alpha")],
          liked: [track("l-1", "Beta")],
          mood: [track("m-1", "Alpha"), track("m-2", "Stranger"), track("m-3", "Beta")]
        })
      });
      expect(ids(result.candidates)).toEqual(["m-2"]);
      expect(result.filledFromMood).toBe(false);
    });
  });

  describe("mix", () => {
    it("alternates the familiar and the new tracks", () => {
      const result = buildGroovingCandidates({
        direction: GroovingDirection.Mix,
        historyShared: true,
        sources: sources({ history: tracks("h", 3, "Alpha"), mood: [...tracks("m", 3, "Stranger"), track("m-known", "Alpha")] })
      });
      expect(ids(result.candidates)).toEqual(["h-0", "m-0", "h-1", "m-1", "h-2", "m-2"]);
      expect(kinds(result.candidates)).toEqual([
        GroovingTrackKind.Familiar,
        GroovingTrackKind.New,
        GroovingTrackKind.Familiar,
        GroovingTrackKind.New,
        GroovingTrackKind.Familiar,
        GroovingTrackKind.New
      ]);
      expect(result.filledFromMood).toBe(false);
    });

    it("fills with the remaining familiar tracks when the new tracks run short", () => {
      const result = buildGroovingCandidates({
        direction: GroovingDirection.Mix,
        historyShared: true,
        sources: sources({ history: tracks("h", 4, "Alpha"), mood: tracks("m", 1, "Stranger") })
      });
      expect(ids(result.candidates)).toEqual(["h-0", "m-0", "h-1", "h-2", "h-3"]);
    });

    it("fills with the remaining new tracks when the familiar tracks run short", () => {
      const result = buildGroovingCandidates({
        direction: GroovingDirection.Mix,
        historyShared: true,
        sources: sources({ history: tracks("h", 1, "Alpha"), mood: tracks("m", 3, "Stranger") })
      });
      expect(ids(result.candidates)).toEqual(["h-0", "m-0", "m-1", "m-2"]);
    });

    it("keeps half of each when both have more than enough", () => {
      const result = buildGroovingCandidates({
        direction: GroovingDirection.Mix,
        historyShared: true,
        sources: sources({ history: tracks("h", 60, "Alpha"), mood: tracks("m", 60, "Stranger") })
      });
      expect(result.candidates).toHaveLength(GROOVING_CANDIDATE_LIMIT);
      expect(result.candidates.filter(c => c.kind === GroovingTrackKind.Familiar)).toHaveLength(GROOVING_CANDIDATE_LIMIT / 2);
      expect(result.candidates.filter(c => c.kind === GroovingTrackKind.New)).toHaveLength(GROOVING_CANDIDATE_LIMIT / 2);
    });
  });

  describe("artists", () => {
    it("marks a track with several artists as familiar when one of them is known", () => {
      const result = buildGroovingCandidates({
        direction: GroovingDirection.Familiar,
        historyShared: true,
        sources: sources({ liked: [track("l-1", "Alpha")], related: [track("r-1", "Stranger", "Alpha"), track("r-2", "Stranger", "Other")] })
      });
      expect(result.candidates.find(c => c.videoId === "r-1")?.kind).toBe(GroovingTrackKind.Familiar);
      expect(ids(result.candidates).slice(0, 2)).toEqual(["l-1", "r-1"]);
    });

    it("does not mind the case and the spaces around the artist names", () => {
      const result = buildGroovingCandidates({
        direction: GroovingDirection.Discover,
        historyShared: true,
        sources: sources({ history: [track("h-1", " Alpha ")], mood: [track("m-1", "ALPHA"), track("m-2", "alpha  "), track("m-3", "Alphabet")] })
      });
      expect(ids(result.candidates)).toEqual(["m-3"]);
    });

    it("marks a track without artists as new", () => {
      const result = buildGroovingCandidates({
        direction: GroovingDirection.Discover,
        historyShared: true,
        sources: sources({ history: [track("h-1", "Alpha")], mood: [track("m-1")] })
      });
      expect(result.candidates).toEqual([{ ...track("m-1"), kind: GroovingTrackKind.New }]);
    });
  });

  describe("duplicates and the limit", () => {
    it("keeps only the first track of the same videoId", () => {
      const first = { ...track("dup", "Alpha"), title: "First" };
      const second = { ...track("dup", "Alpha"), title: "Second" };
      const result = buildGroovingCandidates({
        direction: GroovingDirection.Familiar,
        historyShared: true,
        sources: sources({ history: [first, ...tracks("h", GROOVING_FAMILIAR_MINIMUM, "Alpha")], liked: [second], related: [first] })
      });
      expect(result.candidates.filter(c => c.videoId === "dup")).toEqual([{ ...first, kind: GroovingTrackKind.Familiar }]);
      expect(result.candidates).toHaveLength(GROOVING_FAMILIAR_MINIMUM + 1);
    });

    it("keeps only the first track of the same videoId in the mood", () => {
      const result = buildGroovingCandidates({
        direction: GroovingDirection.Discover,
        historyShared: true,
        sources: sources({ mood: [track("m-1", "Stranger"), track("m-2", "Other"), { ...track("m-1", "Stranger"), title: "Again" }] })
      });
      expect(ids(result.candidates)).toEqual(["m-1", "m-2"]);
      expect(result.candidates[0].title).toBe("Title m-1");
    });

    it.each([GroovingDirection.Familiar, GroovingDirection.Discover, GroovingDirection.Mix])("cuts the candidates at 80 for %s", direction => {
      const result = buildGroovingCandidates({
        direction,
        historyShared: true,
        sources: sources({ history: tracks("h", 100, "Alpha"), mood: tracks("m", 100, "Stranger") })
      });
      expect(result.candidates).toHaveLength(GROOVING_CANDIDATE_LIMIT);
      expect(new Set(ids(result.candidates)).size).toBe(GROOVING_CANDIDATE_LIMIT);
    });

    it("keeps the first 80 in order", () => {
      const result = buildGroovingCandidates({
        direction: GroovingDirection.Discover,
        historyShared: true,
        sources: sources({ mood: tracks("m", 100, "Stranger") })
      });
      expect(ids(result.candidates)).toEqual(ids(tracks("m", GROOVING_CANDIDATE_LIMIT, "x")));
    });

    it("returns nothing when there are no tracks", () => {
      for (const direction of [GroovingDirection.Familiar, GroovingDirection.Discover, GroovingDirection.Mix]) {
        const result = buildGroovingCandidates({ direction, historyShared: true, sources: sources({}) });
        expect(result.candidates).toEqual([]);
      }
    });
  });
});

describe("buildGroovingCandidates with a seed song", () => {
  const seedTrack = (videoId: string, title: string, ...artists: string[]): GroovingTrack => ({ videoId, title, artists, thumbnailUrl: null });
  const seed = { videoId: "seed-1", title: "Blue Hour", artist: "Alpha" };

  it("leaves out the track with the seed's videoId", () => {
    const result = buildGroovingCandidates({
      direction: GroovingDirection.Discover,
      historyShared: true,
      seed,
      sources: sources({ history: [track("h-1", "Alpha")], mood: [track("seed-1", "Stranger"), track("m-1", "Stranger")] })
    });
    expect(ids(result.candidates)).toEqual(["m-1"]);
  });

  it("leaves out the track with the seed's title and first artist, without case and surrounding spaces", () => {
    const result = buildGroovingCandidates({
      direction: GroovingDirection.Discover,
      historyShared: true,
      seed,
      sources: sources({
        mood: [
          seedTrack("m-1", "blue hour", " ALPHA "),
          seedTrack("m-2", "  Blue Hour  ", "alpha", "Guest"),
          seedTrack("m-3", "Blue Hour", "Guest", "Alpha"),
          seedTrack("m-4", "Blue Hour Remix", "Alpha"),
          seedTrack("m-5", "Blue Hour")
        ]
      })
    });
    expect(ids(result.candidates)).toEqual(["m-3", "m-4", "m-5"]);
  });

  it("matches by title and artist when the seed has no videoId", () => {
    const result = buildGroovingCandidates({
      direction: GroovingDirection.Discover,
      historyShared: true,
      seed: { videoId: null, title: "Blue Hour", artist: "Alpha" },
      sources: sources({ mood: [seedTrack("m-1", "Blue Hour", "Alpha"), seedTrack("m-2", "Other", "Alpha")] })
    });
    expect(ids(result.candidates)).toEqual(["m-2"]);
  });

  it.each([GroovingDirection.Familiar, GroovingDirection.Mix])("leaves out the seed from the familiar tracks too (%s)", direction => {
    const result = buildGroovingCandidates({
      direction,
      historyShared: true,
      seed,
      sources: sources({
        history: [seedTrack("seed-1", "Blue Hour", "Alpha"), seedTrack("h-dup", "Blue Hour", "alpha"), seedTrack("h-2", "Another", "Alpha")],
        liked: [track("l-1", "Alpha")],
        related: [track("seed-1", "Alpha")],
        mood: [track("m-1", "Stranger")]
      })
    });
    expect(ids(result.candidates)).not.toContain("seed-1");
    expect(ids(result.candidates)).not.toContain("h-dup");
    expect(ids(result.candidates)).toContain("h-2");
    expect(ids(result.candidates)).toContain("l-1");
  });

  it("keeps the other tracks of the seed's artist as familiar when the history knows the artist", () => {
    // The page sends the seed's related tracks as mood, with an empty related list
    const result = buildGroovingCandidates({
      direction: GroovingDirection.Familiar,
      historyShared: true,
      seed,
      sources: sources({ history: [seedTrack("h-1", "Another", "Alpha")], mood: [seedTrack("r-1", "Related", "Alpha")] })
    });
    expect(result.candidates.map(c => [c.videoId, c.kind])).toEqual([
      ["r-1", GroovingTrackKind.Familiar],
      ["h-1", GroovingTrackKind.Familiar]
    ]);
  });

  it("puts the familiar tracks of the seed's related tracks before the history, so the limit does not cut them", () => {
    const result = buildGroovingCandidates({
      direction: GroovingDirection.Familiar,
      historyShared: true,
      seed,
      sources: sources({
        history: tracks("h", 100, "Alpha"),
        mood: [seedTrack("r-1", "Related", "Alpha"), seedTrack("r-2", "New", "Stranger")]
      })
    });
    expect(result.candidates).toHaveLength(GROOVING_CANDIDATE_LIMIT);
    expect(ids(result.candidates).slice(0, 3)).toEqual(["r-1", "h-0", "h-1"]);
    expect(result.candidates.find(c => c.videoId === "r-1")?.kind).toBe(GroovingTrackKind.Familiar);
    expect(ids(result.candidates)).not.toContain("r-2");
    expect(result.filledFromMood).toBe(false);
  });

  it("includes the familiar and the new tracks of the seed's related tracks in mix", () => {
    const result = buildGroovingCandidates({
      direction: GroovingDirection.Mix,
      historyShared: true,
      seed,
      sources: sources({
        history: tracks("h", 40, "Alpha"),
        mood: [seedTrack("r-1", "Related", "Alpha"), seedTrack("r-2", "New", "Stranger")]
      })
    });
    expect(ids(result.candidates).slice(0, 3)).toEqual(["r-1", "r-2", "h-0"]);
  });

  it("keeps the direction's narrowing as it is", () => {
    const input = {
      historyShared: true,
      seed,
      sources: sources({
        history: tracks("h", 3, "Alpha"),
        mood: [...tracks("m", 3, "Stranger"), track("m-known", "Alpha"), track("seed-1", "Stranger")]
      })
    };
    const familiar = buildGroovingCandidates({ ...input, direction: GroovingDirection.Familiar }).candidates;
    const discover = buildGroovingCandidates({ ...input, direction: GroovingDirection.Discover }).candidates;
    const mix = buildGroovingCandidates({ ...input, direction: GroovingDirection.Mix }).candidates;
    expect(ids(familiar)).toEqual(["m-known", "h-0", "h-1", "h-2", "m-0", "m-1", "m-2"]);
    expect(ids(discover)).toEqual(["m-0", "m-1", "m-2"]);
    expect(ids(mix)).toEqual(["m-known", "m-0", "h-0", "m-1", "h-1", "m-2", "h-2"]);
    for (const list of [familiar, discover, mix]) expect(ids(list)).not.toContain("seed-1");
  });

  it("changes nothing without a seed", () => {
    const input = {
      direction: GroovingDirection.Mix,
      historyShared: true,
      sources: sources({ history: tracks("h", 3, "Alpha"), mood: tracks("m", 3, "Stranger") })
    };
    expect(buildGroovingCandidates({ ...input, seed: null })).toEqual(buildGroovingCandidates(input));
  });

  it("does not drop tracks with an empty seed title", () => {
    const result = buildGroovingCandidates({
      direction: GroovingDirection.Discover,
      historyShared: true,
      seed: { videoId: null, title: "  ", artist: "" },
      sources: sources({ mood: [seedTrack("m-1", "", "")] })
    });
    expect(ids(result.candidates)).toEqual(["m-1"]);
  });
});
