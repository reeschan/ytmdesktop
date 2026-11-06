import { describe, expect, it } from "vitest";
import { SongRecognitionResultKind } from "./index";
import { interpretShazamResponse, ShazamOutcome, ShazamOutcomeKind, SongRecognitionMatch, SongRecognitionResult } from "./response";

const http = (status: number, body: unknown): ShazamOutcome => ({ kind: ShazamOutcomeKind.Http, status, body });
const match = (query: string, title: string, artist: string): SongRecognitionResult => ({ kind: SongRecognitionMatch, query, title, artist });
const failure = (kind: SongRecognitionResultKind): SongRecognitionResult => ({ kind });

describe("interpretShazamResponse", () => {
  describe("a match", () => {
    it("gives the title and the artist apart, and the query as before", () => {
      expect(interpretShazamResponse(http(200, { track: { title: "Song", subtitle: "Artist" } }))).toEqual({
        kind: SongRecognitionMatch,
        query: "Song Artist",
        title: "Song",
        artist: "Artist"
      });
    });

    it("joins the title and the subtitle with a space", () => {
      expect(interpretShazamResponse(http(200, { track: { title: "Song", subtitle: "Artist" } }))).toEqual(match("Song Artist", "Song", "Artist"));
    });

    it("uses only the title when there is no subtitle", () => {
      expect(interpretShazamResponse(http(200, { track: { title: "Song" } }))).toEqual(match("Song", "Song", ""));
    });

    it("uses only the subtitle when there is no title", () => {
      expect(interpretShazamResponse(http(200, { track: { subtitle: "Artist" } }))).toEqual(match("Artist", "", "Artist"));
    });

    it("trims the spaces around the text", () => {
      expect(interpretShazamResponse(http(200, { track: { title: "  Song ", subtitle: " Artist  " } }))).toEqual(
        match("Song Artist", "Song", "Artist")
      );
    });

    it("skips a blank part", () => {
      expect(interpretShazamResponse(http(200, { track: { title: "Song", subtitle: "   " } }))).toEqual(match("Song", "Song", ""));
    });
  });

  describe("no match", () => {
    it("is no match when there is no track", () => {
      expect(interpretShazamResponse(http(200, {}))).toEqual(failure(SongRecognitionResultKind.NoMatch));
      expect(interpretShazamResponse(http(200, { matches: [] }))).toEqual(failure(SongRecognitionResultKind.NoMatch));
    });

    it("is no match when the track has neither a title nor a subtitle", () => {
      expect(interpretShazamResponse(http(200, { track: {} }))).toEqual(failure(SongRecognitionResultKind.NoMatch));
      expect(interpretShazamResponse(http(200, { track: { title: "", subtitle: " " } }))).toEqual(failure(SongRecognitionResultKind.NoMatch));
    });

    it.each([null, undefined, "text", 42, true, [], [1, 2], { track: null }, { track: "x" }, { track: 1 }, { track: { title: 1, subtitle: {} } }])(
      "does not throw and is no match for a body of another shape (%j)",
      body => {
        expect(interpretShazamResponse(http(200, body))).toEqual(failure(SongRecognitionResultKind.NoMatch));
      }
    );

    it("ignores a title that is not a string but keeps a subtitle that is", () => {
      expect(interpretShazamResponse(http(200, { track: { title: 1, subtitle: "Artist" } }))).toEqual(match("Artist", "", "Artist"));
    });
  });

  describe("the HTTP status", () => {
    it.each([401, 403])("is an invalid key for %i", status => {
      expect(interpretShazamResponse(http(status, { message: "denied" }))).toEqual(failure(SongRecognitionResultKind.InvalidKey));
    });

    it("is a limit for 429", () => {
      expect(interpretShazamResponse(http(429, null))).toEqual(failure(SongRecognitionResultKind.LimitReached));
    });

    it.each([400, 404, 500, 502, 503])("is a network error for %i", status => {
      expect(interpretShazamResponse(http(status, null))).toEqual(failure(SongRecognitionResultKind.NetworkError));
    });

    it("does not read the track of a failed status", () => {
      expect(interpretShazamResponse(http(500, { track: { title: "Song", subtitle: "Artist" } }))).toEqual(
        failure(SongRecognitionResultKind.NetworkError)
      );
    });
  });

  describe("a failure before a response", () => {
    it("is a network error for a network error", () => {
      expect(interpretShazamResponse({ kind: ShazamOutcomeKind.NetworkError })).toEqual(failure(SongRecognitionResultKind.NetworkError));
    });

    it("is a network error for a timeout", () => {
      expect(interpretShazamResponse({ kind: ShazamOutcomeKind.Timeout })).toEqual(failure(SongRecognitionResultKind.NetworkError));
    });
  });
});
