import { describe, expect, it } from "vitest";
import { checkGroovingList, checkGroovingPair, groovingArtistLimit, groovingCandidatesEnough, groovingFamiliarCount } from "./answer";
import {
  GROOVING_LIST_LENGTH,
  GroovingAnswer,
  GroovingCandidate,
  GroovingDirection,
  GroovingList,
  GroovingPair,
  GroovingRoundRecord,
  GroovingTrackKind
} from "./index";

const candidate = (videoId: string, kind: GroovingTrackKind): GroovingCandidate => ({
  videoId,
  title: `Title ${videoId}`,
  artists: [`Artist ${videoId}`],
  thumbnailUrl: null,
  kind
});

const byArtist = (videoId: string, kind: GroovingTrackKind, artist: string): GroovingCandidate => ({
  ...candidate(videoId, kind),
  artists: [artist]
});

// 18 familiar tracks by 3 artists (6 each) and 40 new tracks by 40 other artists
const leaningFamiliar = Array.from({ length: 18 }, (_, i) => byArtist(`lf${i + 1}`, GroovingTrackKind.Familiar, `Leaning ${(i % 3) + 1}`));
const leaningNew = Array.from({ length: 40 }, (_, i) => byArtist(`ln${i + 1}`, GroovingTrackKind.New, `Other ${i + 1}`));

const familiarIds = Array.from({ length: 30 }, (_, i) => `f${i + 1}`);
const newIds = Array.from({ length: 30 }, (_, i) => `n${i + 1}`);
const candidates: GroovingCandidate[] = [
  ...familiarIds.map(id => candidate(id, GroovingTrackKind.Familiar)),
  ...newIds.map(id => candidate(id, GroovingTrackKind.New))
];

const pair = (left: string, right: string): GroovingPair => ({ left, right, reason: "calm against loud" });
const list = (videoIds: string[], moodDescription = "Rainy night lo-fi"): GroovingList => ({ videoIds, moodDescription });
const record = (left: string, right: string, answer: GroovingAnswer): GroovingRoundRecord => ({ pair: pair(left, right), answer });

const failsWith = (problem: string) => ({ ok: false, problem: expect.stringContaining(problem) });

describe("checkGroovingPair", () => {
  const input = (direction: GroovingDirection, shown: string[] = []) => ({ candidates, direction, shown });

  it.each([GroovingDirection.Familiar, GroovingDirection.Discover])("accepts two different unseen candidates (%s)", direction => {
    expect(checkGroovingPair(pair("f1", "f2"), input(direction, ["f3", "n1"]))).toEqual({ ok: true });
  });

  it("accepts a familiar and a new track in a mix, in either order", () => {
    expect(checkGroovingPair(pair("f1", "n1"), input(GroovingDirection.Mix))).toEqual({ ok: true });
    expect(checkGroovingPair(pair("n1", "f1"), input(GroovingDirection.Mix))).toEqual({ ok: true });
  });

  it("fails when the left track is not a candidate", () => {
    expect(checkGroovingPair(pair("made-up", "f2"), input(GroovingDirection.Familiar))).toEqual(failsWith("left is not a candidate"));
  });

  it("fails when the right track is not a candidate", () => {
    expect(checkGroovingPair(pair("f1", "made-up"), input(GroovingDirection.Familiar))).toEqual(failsWith("right is not a candidate"));
  });

  it("fails when both sides are the same track", () => {
    expect(checkGroovingPair(pair("f1", "f1"), input(GroovingDirection.Familiar))).toEqual(failsWith("same track"));
  });

  it("fails when the left track was shown before", () => {
    expect(checkGroovingPair(pair("f1", "f2"), input(GroovingDirection.Familiar, ["f1"]))).toEqual(failsWith("left was shown"));
  });

  it("fails when the right track was shown before", () => {
    expect(checkGroovingPair(pair("f1", "f2"), input(GroovingDirection.Familiar, ["f2"]))).toEqual(failsWith("right was shown"));
  });

  it("fails when both tracks of a mix are familiar", () => {
    expect(checkGroovingPair(pair("f1", "f2"), input(GroovingDirection.Mix))).toEqual(failsWith("familiar and one new"));
  });

  it("fails when both tracks of a mix are new", () => {
    expect(checkGroovingPair(pair("n1", "n2"), input(GroovingDirection.Mix))).toEqual(failsWith("familiar and one new"));
  });
});

describe("checkGroovingList", () => {
  const input = (direction: GroovingDirection, familiarCount = 0) => ({ candidates, direction, familiarCount });
  const familiar25 = familiarIds.slice(0, GROOVING_LIST_LENGTH);
  const new25 = newIds.slice(0, GROOVING_LIST_LENGTH);
  const mix = (familiar: number) => [...familiarIds.slice(0, familiar), ...newIds.slice(0, GROOVING_LIST_LENGTH - familiar)];

  it("accepts 25 familiar tracks for familiar", () => {
    expect(checkGroovingList(list(familiar25), input(GroovingDirection.Familiar, 25))).toEqual({ ok: true });
  });

  it("accepts 25 new tracks for discover", () => {
    expect(checkGroovingList(list(new25), input(GroovingDirection.Discover, 0))).toEqual({ ok: true });
  });

  it("accepts a mix with exactly the familiar count", () => {
    expect(checkGroovingList(list(mix(13)), input(GroovingDirection.Mix, 13))).toEqual({ ok: true });
  });

  it.each([24, 26])("fails when the list has %i tracks", length => {
    const videoIds = [...familiarIds, ...newIds].slice(0, length);
    expect(checkGroovingList(list(videoIds), input(GroovingDirection.Mix, 13))).toEqual(failsWith("25 tracks"));
  });

  it("fails when a track appears twice", () => {
    const videoIds = [...familiar25.slice(0, 24), "f1"];
    expect(checkGroovingList(list(videoIds), input(GroovingDirection.Familiar, 25))).toEqual(failsWith("twice"));
  });

  it("fails when a track is not a candidate", () => {
    const videoIds = [...familiar25.slice(0, 24), "made-up"];
    expect(checkGroovingList(list(videoIds), input(GroovingDirection.Familiar, 25))).toEqual(failsWith("not a candidate"));
  });

  it.each(["", "   "])("fails when the mood description is empty (%j)", moodDescription => {
    expect(checkGroovingList(list(familiar25, moodDescription), input(GroovingDirection.Familiar, 25))).toEqual(failsWith("mood description"));
  });

  it("fails when a familiar list has a new track", () => {
    const videoIds = [...familiar25.slice(0, 24), "n1"];
    expect(checkGroovingList(list(videoIds), input(GroovingDirection.Familiar, 25))).toEqual(failsWith("24 familiar tracks, not 25"));
  });

  it("accepts new tracks in a familiar list when the familiar candidates ran short (18 familiar, 7 new)", () => {
    const short = [
      ...familiarIds.slice(0, 18).map(id => candidate(id, GroovingTrackKind.Familiar)),
      ...newIds.map(id => candidate(id, GroovingTrackKind.New))
    ];
    const videoIds = [...familiarIds.slice(0, 18), ...newIds.slice(0, 7)];
    expect(checkGroovingList(list(videoIds), { candidates: short, direction: GroovingDirection.Familiar, familiarCount: 18 })).toEqual({ ok: true });
  });

  it("fails when a familiar list has fewer familiar tracks than the familiar count", () => {
    expect(checkGroovingList(list(mix(17)), input(GroovingDirection.Familiar, 18))).toEqual(failsWith("17 familiar tracks, not 18"));
  });

  it("fails when a discover list has a familiar track", () => {
    const videoIds = [...new25.slice(0, 24), "f1"];
    expect(checkGroovingList(list(videoIds), input(GroovingDirection.Discover, 0))).toEqual(failsWith("not new"));
  });

  it.each([12, 14])("fails when a mix has %i familiar tracks instead of 13", familiar => {
    expect(checkGroovingList(list(mix(familiar)), input(GroovingDirection.Mix, 13))).toEqual(failsWith("familiar tracks"));
  });

  describe("artist limit", () => {
    // The 60 candidates (60 artists) and three more new tracks by the artist of n1
    const withSameArtist = [...candidates, ...["s1", "s2", "s3"].map(id => byArtist(id, GroovingTrackKind.New, "Artist n1"))];
    const discover = { candidates: withSameArtist, direction: GroovingDirection.Discover, familiarCount: 0 };

    it("fails when one artist has 4 tracks among 60 artists", () => {
      const videoIds = ["n1", "s1", "s2", "s3", ...newIds.slice(1, 22)];
      expect(checkGroovingList(list(videoIds), discover)).toEqual(failsWith('artist "artist n1" has 4 tracks, more than 3'));
    });

    it("accepts 3 tracks of one artist among 60 artists", () => {
      const videoIds = ["n1", "s1", "s2", ...newIds.slice(1, 23)];
      expect(checkGroovingList(list(videoIds), discover)).toEqual({ ok: true });
    });

    it("accepts 6 tracks of one artist when 18 familiar tracks come from 3 artists (familiarCount 18)", () => {
      const pool = [...leaningFamiliar, ...leaningNew];
      const videoIds = [...leaningFamiliar.map(track => track.videoId), ...leaningNew.slice(0, 7).map(track => track.videoId)];
      expect(checkGroovingList(list(videoIds), { candidates: pool, direction: GroovingDirection.Familiar, familiarCount: 18 })).toEqual({ ok: true });
    });

    it("fails when one artist has 7 tracks with the eased limit of 6", () => {
      // One more new track by the first familiar artist; the limit stays 6
      const pool = [...leaningFamiliar, ...leaningNew, byArtist("ax", GroovingTrackKind.New, "Leaning 1")];
      const videoIds = [...leaningFamiliar.map(track => track.videoId), "ax", ...leaningNew.slice(0, 6).map(track => track.videoId)];
      expect(checkGroovingList(list(videoIds), { candidates: pool, direction: GroovingDirection.Familiar, familiarCount: 18 })).toEqual(
        failsWith('artist "leaning 1" has 7 tracks, more than 6')
      );
    });

    it("does not count a name that only appears as the second artist", () => {
      const guests = ["g1", "g2", "g3", "g4"].map(id => ({ ...candidate(id, GroovingTrackKind.New), artists: [`Artist ${id}`, "Guest"] }));
      const videoIds = ["g1", "g2", "g3", "g4", ...newIds.slice(0, 21)];
      expect(checkGroovingList(list(videoIds), { ...discover, candidates: [...candidates, ...guests] })).toEqual({ ok: true });
    });

    it("does not count tracks without an artist name", () => {
      const unnamed = ["u1", "u2", "u3", "u4"].map(id => ({ ...candidate(id, GroovingTrackKind.New), artists: [] }));
      const videoIds = ["u1", "u2", "u3", "u4", ...newIds.slice(0, 21)];
      expect(checkGroovingList(list(videoIds), { ...discover, candidates: [...candidates, ...unnamed] })).toEqual({ ok: true });
    });
  });
});

describe("groovingArtistLimit", () => {
  const fresh = (count: number, artist: (i: number) => string) =>
    Array.from({ length: count }, (_, i) => byArtist(`x${i + 1}`, GroovingTrackKind.New, artist(i)));

  it("is 3 for 60 new tracks by 60 artists (familiarCount 0)", () => {
    expect(
      groovingArtistLimit(
        fresh(60, i => `Solo ${i}`),
        0
      )
    ).toBe(3);
  });

  it("is 6 when 18 familiar tracks come from 3 artists (familiarCount 18, the familiar side decides)", () => {
    expect(groovingArtistLimit([...leaningFamiliar, ...leaningNew], 18)).toBe(6);
  });

  it("is 5 for 25 new tracks by 5 artists (familiarCount 0)", () => {
    expect(
      groovingArtistLimit(
        fresh(25, i => `Five ${i % 5}`),
        0
      )
    ).toBe(5);
  });

  it("is 3 when no candidate has an artist", () => {
    const unnamed = Array.from({ length: 30 }, (_, i) => ({ ...candidate(`u${i + 1}`, GroovingTrackKind.New), artists: [] }));
    expect(groovingArtistLimit(unnamed, 0)).toBe(3);
  });

  it("is 25 (the most) when 30 tracks come from one artist", () => {
    expect(
      groovingArtistLimit(
        fresh(30, () => "Only One"),
        0
      )
    ).toBe(25);
  });

  it("counts artist names that differ only in case and surrounding spaces as one artist", () => {
    // 5 artists x 5 tracks, each artist spelled 5 ways
    const names = [1, 2, 3, 4, 5].flatMap(n => [`Band ${n}`, ` band ${n}`, `BAND ${n} `, `bAnD ${n}`, `  Band ${n}  `]);
    const tracks = names.map((name, i) => byArtist(`x${i + 1}`, GroovingTrackKind.New, name));
    expect(groovingArtistLimit(tracks, 0)).toBe(5);
  });

  it("does not use the second artist to group", () => {
    const tracks = fresh(60, i => `Solo ${i}`).map(track => ({ ...track, artists: [...track.artists, "Shared"] }));
    expect(groovingArtistLimit(tracks, 0)).toBe(3);
  });

  it("counts a candidate listed twice once", () => {
    const twice = [...fresh(25, i => `Five ${i % 5}`), ...fresh(5, i => `Five ${i % 5}`)];
    expect(groovingArtistLimit(twice, 0)).toBe(5);
  });
});

describe("groovingCandidatesEnough", () => {
  const pool = (familiar: number, fresh: number): GroovingCandidate[] => [
    ...Array.from({ length: familiar }, (_, i) => candidate(`f${i + 1}`, GroovingTrackKind.Familiar)),
    ...Array.from({ length: fresh }, (_, i) => candidate(`n${i + 1}`, GroovingTrackKind.New))
  ];

  it("is false for 24 candidates", () => {
    expect(groovingCandidatesEnough(pool(0, 24), GroovingDirection.Discover, 5)).toBe(false);
  });

  it("is true for 25 new candidates when discovering", () => {
    expect(groovingCandidatesEnough(pool(0, 25), GroovingDirection.Discover, 5)).toBe(true);
  });

  it("is false for a mix with 4 familiar and 30 new candidates in 5 rounds", () => {
    expect(groovingCandidatesEnough(pool(4, 30), GroovingDirection.Mix, 5)).toBe(false);
  });

  it("is true for a mix with 5 familiar and 20 new candidates in 5 rounds", () => {
    expect(groovingCandidatesEnough(pool(5, 20), GroovingDirection.Mix, 5)).toBe(true);
  });

  it("does not look at the kinds for familiar (18 familiar and 7 new)", () => {
    expect(groovingCandidatesEnough(pool(18, 7), GroovingDirection.Familiar, 10)).toBe(true);
  });

  it("counts a candidate listed twice once", () => {
    expect(groovingCandidatesEnough([...pool(0, 24), candidate("n1", GroovingTrackKind.New)], GroovingDirection.Discover, 5)).toBe(false);
  });
});

describe("groovingFamiliarCount", () => {
  const count = (direction: GroovingDirection, history: GroovingRoundRecord[]) => groovingFamiliarCount({ direction, history, candidates });
  const mixed = [record("f1", "n1", GroovingAnswer.Left), record("n2", "f2", GroovingAnswer.Left)];

  it("is 25 for familiar", () => {
    expect(count(GroovingDirection.Familiar, mixed)).toBe(25);
  });

  it("is 0 for discover", () => {
    expect(count(GroovingDirection.Discover, mixed)).toBe(0);
  });

  it("stops at 0.2 (5) when no chosen track was familiar", () => {
    const history = [record("f1", "n1", GroovingAnswer.Right), record("n2", "f2", GroovingAnswer.Left), record("f3", "n3", GroovingAnswer.Right)];
    expect(count(GroovingDirection.Mix, history)).toBe(5);
  });

  it("is 13 when half of the chosen tracks were familiar (12.5 rounds up)", () => {
    expect(count(GroovingDirection.Mix, mixed)).toBe(13);
  });

  it("stops at 0.8 (20) when every chosen track was familiar", () => {
    const history = [record("f1", "n1", GroovingAnswer.Left), record("n2", "f2", GroovingAnswer.Right), record("f3", "n3", GroovingAnswer.Left)];
    expect(count(GroovingDirection.Mix, history)).toBe(20);
  });

  it("uses the share between the bounds as it is", () => {
    // 2 of 3 familiar -> 25 * 2 / 3 = 16.67 -> 17
    const history = [record("f1", "n1", GroovingAnswer.Left), record("n2", "f2", GroovingAnswer.Right), record("f3", "n3", GroovingAnswer.Right)];
    expect(count(GroovingDirection.Mix, history)).toBe(17);
  });

  it("leaves out neither when counting the share", () => {
    const history = [...mixed, record("f3", "n3", GroovingAnswer.Neither), record("f4", "n4", GroovingAnswer.Neither)];
    expect(count(GroovingDirection.Mix, history)).toBe(13);
  });

  it("is 13 (0.5) when every answer was neither", () => {
    const history = [record("f1", "n1", GroovingAnswer.Neither), record("n2", "f2", GroovingAnswer.Neither)];
    expect(count(GroovingDirection.Mix, history)).toBe(13);
  });

  it("is 13 (0.5) when there are no answers", () => {
    expect(count(GroovingDirection.Mix, [])).toBe(13);
  });

  describe("kept within the candidates", () => {
    const pool = (familiar: number, fresh: number): GroovingCandidate[] => [
      ...familiarIds.slice(0, familiar).map(id => candidate(id, GroovingTrackKind.Familiar)),
      ...newIds.slice(0, fresh).map(id => candidate(id, GroovingTrackKind.New))
    ];
    const allFamiliar = [record("f1", "n1", GroovingAnswer.Left), record("n2", "f2", GroovingAnswer.Right), record("f3", "n3", GroovingAnswer.Left)];
    const noFamiliar = [record("f1", "n1", GroovingAnswer.Right), record("n2", "f2", GroovingAnswer.Left), record("f3", "n3", GroovingAnswer.Right)];

    it("is 18 for familiar when only 18 familiar tracks are candidates (the rest is new)", () => {
      expect(groovingFamiliarCount({ direction: GroovingDirection.Familiar, history: [], candidates: pool(18, 30) })).toBe(18);
    });

    it("is 12 for a mix at 0.8 (20) when only 12 familiar tracks are candidates", () => {
      expect(groovingFamiliarCount({ direction: GroovingDirection.Mix, history: allFamiliar, candidates: pool(12, 30) })).toBe(12);
    });

    it("is 10 (25 - 15) for a mix at 0.2 (5) when only 15 new tracks are candidates", () => {
      expect(groovingFamiliarCount({ direction: GroovingDirection.Mix, history: noFamiliar, candidates: pool(30, 15) })).toBe(10);
    });

    it("stays 0 for discover", () => {
      expect(groovingFamiliarCount({ direction: GroovingDirection.Discover, history: [], candidates: pool(18, 30) })).toBe(0);
    });

    it("counts a candidate listed twice once", () => {
      const twice = [...pool(12, 30), candidate("f1", GroovingTrackKind.Familiar)];
      expect(groovingFamiliarCount({ direction: GroovingDirection.Mix, history: allFamiliar, candidates: twice })).toBe(12);
    });
  });
});
