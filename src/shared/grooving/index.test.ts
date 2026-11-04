import { describe, expect, it } from "vitest";
import {
  clipGroovingTrack,
  GroovingAnswer,
  GroovingConsentChoice,
  GroovingDirection,
  GroovingLanguage,
  GroovingMoodSection,
  groovingMoodLabel,
  isGroovingSignal,
  isGroovingViewMessage,
  isGroovingViewState,
  resolveGroovingLanguage
} from "./index";

const itemMood = { kind: "item", item: { name: "Energy", section: GroovingMoodSection.Moods, params: "abc" } };
const textMood = { kind: "text", text: "rainy night drive" };

const chill = { name: "Chill", section: GroovingMoodSection.Moods, params: "m1" };
const focus = { name: "Focus", section: GroovingMoodSection.Moods, params: "m2" };
const jpop = { name: "J-Pop", section: GroovingMoodSection.Genres, params: "g1" };
const jazz = { name: "Jazz", section: GroovingMoodSection.Genres, params: "g2" };
const rock = { name: "Rock", section: GroovingMoodSection.Genres, params: "g3" };
const blendMood = { kind: "blend", items: [chill, jpop, jazz] };

function startWith(mood: unknown) {
  return { type: "start", mood, direction: GroovingDirection.Familiar, rounds: 3 };
}

describe("isGroovingSignal", () => {
  it.each([
    ["open (with a page language)", { type: "open", pageLanguage: "ja" }],
    ["open (page language null)", { type: "open", pageLanguage: null }],
    ["start (blend of a mood and two genres)", startWith(blendMood)],
    ["start (blend of a mood and a genre)", startWith({ kind: "blend", items: [chill, jpop] })],
    ["start (blend of two genres)", startWith({ kind: "blend", items: [jpop, jazz] })],
    ["start (blend with genres first)", startWith({ kind: "blend", items: [jpop, chill] })],
    ["close", { type: "close" }],
    ["leave", { type: "leave" }],
    ["consent (share history)", { type: "consent", choice: GroovingConsentChoice.ShareHistory }],
    ["consent (no history)", { type: "consent", choice: GroovingConsentChoice.NoHistory }],
    ["consent (not now)", { type: "consent", choice: null }],
    ["start (item mood)", { type: "start", mood: itemMood, direction: GroovingDirection.Familiar, rounds: 3 }],
    ["start (text mood)", { type: "start", mood: textMood, direction: GroovingDirection.Discover, rounds: 5 }],
    ["start (mix, 10 rounds)", { type: "start", mood: itemMood, direction: GroovingDirection.Mix, rounds: 10 }],
    ["answer (left)", { type: "answer", answer: GroovingAnswer.Left }],
    ["answer (right)", { type: "answer", answer: GroovingAnswer.Right }],
    ["answer (neither)", { type: "answer", answer: GroovingAnswer.Neither }],
    ["previewStart", { type: "previewStart", videoId: "hcpa-L_6ssk" }],
    ["previewStop", { type: "previewStop" }],
    ["retry", { type: "retry" }],
    ["save", { type: "save" }],
    ["again", { type: "again" }],
    ["dismissNotice", { type: "dismissNotice" }]
  ])("accepts %s", (_, signal) => {
    expect(isGroovingSignal(signal)).toBe(true);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "open"],
    ["a number", 1],
    ["no type", {}],
    ["no type with fields", { choice: null }],
    ["an unknown type", { type: "jump" }],
    ["a non-string type", { type: 1 }],
    ["open without pageLanguage", { type: "open" }],
    ["open with a numeric pageLanguage", { type: "open", pageLanguage: 1 }],
    ["start with a blend of one item", startWith({ kind: "blend", items: [jpop] })],
    ["start with a blend of two moods", startWith({ kind: "blend", items: [chill, focus] })],
    ["start with a blend of three genres", startWith({ kind: "blend", items: [jpop, jazz, rock] })],
    ["start with a blend of repeated params", startWith({ kind: "blend", items: [chill, { ...jpop, params: chill.params }] })],
    ["start with a blend without items", startWith({ kind: "blend" })],
    ["start with a blend of a malformed item", startWith({ kind: "blend", items: [chill, { name: "J-Pop", section: "genres" }] })],
    ["consent without choice", { type: "consent" }],
    ["consent with an unknown choice", { type: "consent", choice: "maybe" }],
    ["start with 4 rounds", { type: "start", mood: itemMood, direction: GroovingDirection.Familiar, rounds: 4 }],
    ["start with rounds as a string", { type: "start", mood: itemMood, direction: GroovingDirection.Familiar, rounds: "3" }],
    ["start with an unknown direction", { type: "start", mood: itemMood, direction: "sideways", rounds: 3 }],
    ["start without mood", { type: "start", direction: GroovingDirection.Familiar, rounds: 3 }],
    ["start with an unknown mood kind", { type: "start", mood: { kind: "color", text: "blue" }, direction: GroovingDirection.Familiar, rounds: 3 }],
    ["start with a text mood without text", { type: "start", mood: { kind: "text" }, direction: GroovingDirection.Familiar, rounds: 3 }],
    [
      "start with an item mood without params",
      {
        type: "start",
        mood: { kind: "item", item: { name: "Energy", section: GroovingMoodSection.Moods } },
        direction: GroovingDirection.Familiar,
        rounds: 3
      }
    ],
    [
      "start with an item mood of an unknown section",
      {
        type: "start",
        mood: { kind: "item", item: { name: "Energy", section: "charts", params: "abc" } },
        direction: GroovingDirection.Familiar,
        rounds: 3
      }
    ],
    ["start with an item mood without item", { type: "start", mood: { kind: "item" }, direction: GroovingDirection.Familiar, rounds: 3 }],
    ["answer up", { type: "answer", answer: "up" }],
    ["answer without answer", { type: "answer" }],
    ["previewStart without videoId", { type: "previewStart" }],
    ["previewStart with a non-string videoId", { type: "previewStart", videoId: 1 }]
  ])("rejects %s", (_, value) => {
    expect(isGroovingSignal(value)).toBe(false);
  });
});

describe("isGroovingViewState", () => {
  it.each(["closed", "key-missing", "consent", "setup", "working", "choose", "done", "failed"])("accepts the %s screen", screen => {
    expect(isGroovingViewState({ screen, visibility: "shown", mark: null })).toBe(true);
  });

  it.each([
    ["a hidden screen with a mark", { screen: "working", visibility: "hidden", mark: "Preparing" }, true],
    ["a closed screen", { screen: "closed", visibility: "gone", mark: null }, true],
    ["a hidden setup screen without a mark", { screen: "setup", visibility: "hidden", mark: null }, true]
  ])("accepts %s", (_, value, expected) => {
    expect(isGroovingViewState(value)).toBe(expected);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "closed"],
    ["a number", 0],
    ["no screen", {}],
    ["an unknown screen", { screen: "playing", visibility: "shown", mark: null }],
    ["a non-string screen", { screen: 1, visibility: "shown", mark: null }],
    ["no visibility", { screen: "closed", mark: null }],
    ["an unknown visibility", { screen: "closed", visibility: "open", mark: null }],
    ["a non-string visibility", { screen: "closed", visibility: 1, mark: null }],
    ["no mark", { screen: "closed", visibility: "gone" }],
    ["a numeric mark", { screen: "closed", visibility: "gone", mark: 1 }]
  ])("rejects %s", (_, value) => {
    expect(isGroovingViewState(value)).toBe(false);
  });
});

describe("groovingMoodLabel", () => {
  it("uses the item name for an item mood", () => {
    expect(groovingMoodLabel({ kind: "item", item: chill })).toBe("Chill");
  });

  it("joins the item names with × for a blend", () => {
    expect(groovingMoodLabel({ kind: "blend", items: [chill, jpop, jazz] })).toBe("Chill × J-Pop × Jazz");
  });

  it("uses the text for a text mood", () => {
    expect(groovingMoodLabel({ kind: "text", text: "rainy night drive" })).toBe("rainy night drive");
  });
});

describe("resolveGroovingLanguage", () => {
  it.each([
    ["en, even on a Japanese page", GroovingLanguage.English, "ja", "en"],
    ["ja, even on an English page", GroovingLanguage.Japanese, "en", "ja"],
    ["auto on a ja page", GroovingLanguage.Auto, "ja", "ja"],
    ["auto on a ja-JP page", GroovingLanguage.Auto, "ja-JP", "ja"],
    ["auto on a JA page", GroovingLanguage.Auto, "JA", "ja"],
    ["auto on an en page", GroovingLanguage.Auto, "en", "en"],
    ["auto with no page language", GroovingLanguage.Auto, null, "en"],
    ["undefined on a ja page", undefined, "ja", "ja"],
    ["undefined with no page language", undefined, null, "en"],
    ["an unknown value on a ja page", "fr", "ja", "ja"],
    ["an unknown value on an en page", "fr", "en", "en"]
  ])("resolves %s", (_, setting, pageLanguage, expected) => {
    expect(resolveGroovingLanguage(setting, pageLanguage)).toBe(expected);
  });
});

describe("isGroovingViewMessage", () => {
  it.each(["en", "ja"])("accepts a view state with language %s", language => {
    expect(isGroovingViewMessage({ screen: "closed", visibility: "gone", mark: null, language })).toBe(true);
  });

  it.each([
    ["no language", { screen: "closed", visibility: "gone", mark: null }],
    ["language fr", { screen: "closed", visibility: "gone", mark: null, language: "fr" }],
    ["language auto", { screen: "closed", visibility: "gone", mark: null, language: "auto" }],
    ["an unknown screen", { screen: "playing", visibility: "shown", mark: null, language: "en" }],
    ["no visibility", { screen: "closed", mark: null, language: "en" }],
    ["null", null]
  ])("rejects %s", (_, value) => {
    expect(isGroovingViewMessage(value)).toBe(false);
  });
});

describe("clipGroovingTrack", () => {
  const track = { videoId: "abc_123-XY", title: "Song", artists: ["A"], thumbnailUrl: "https://example.com/t.jpg" };

  it("keeps the first 5 of 6 artists in order", () => {
    const clipped = clipGroovingTrack({ ...track, artists: ["A1", "A2", "A3", "A4", "A5", "A6"] });
    expect(clipped.artists).toEqual(["A1", "A2", "A3", "A4", "A5"]);
  });

  it("cuts a 250-character title and artist name to 200 characters", () => {
    const clipped = clipGroovingTrack({ ...track, title: "t".repeat(250), artists: ["a".repeat(250), "B"] });
    expect(clipped.title).toBe("t".repeat(200));
    expect(clipped.artists).toEqual(["a".repeat(200), "B"]);
  });

  it("leaves a track within the limits as it is", () => {
    const within = { ...track, title: "t".repeat(200), artists: ["a".repeat(200), "B", "C", "D", "E"] };
    expect(clipGroovingTrack(within)).toEqual(within);
  });

  it("keeps the videoId and the thumbnailUrl", () => {
    const clipped = clipGroovingTrack({ ...track, title: "t".repeat(250) });
    expect(clipped).toMatchObject({ videoId: "abc_123-XY", thumbnailUrl: "https://example.com/t.jpg" });
    expect(clipGroovingTrack({ ...track, thumbnailUrl: null }).thumbnailUrl).toBeNull();
  });

  it("does not change the input track", () => {
    const input = { ...track, title: "t".repeat(250), artists: ["a".repeat(250), "A2", "A3", "A4", "A5", "A6"] };
    const copy = structuredClone(input);
    clipGroovingTrack(input);
    expect(input).toEqual(copy);
  });
});
