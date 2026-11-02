import { describe, expect, it } from "vitest";
import {
  BackgroundVideoDecision,
  BackgroundVideoInput,
  BackgroundVideoPlayback,
  decideBackgroundVideo,
  WindowVisibility,
  YtmBackground
} from "~shared/background-video";

const NOT_SHOWN: BackgroundVideoDecision = { video: BackgroundVideoPlayback.NotShown, ytmBackground: YtmBackground.Theme };

const CASES: [BackgroundVideoInput, BackgroundVideoDecision][] = [
  [{ enabled: false, fileFound: false, window: WindowVisibility.Visible }, NOT_SHOWN],
  [{ enabled: false, fileFound: false, window: WindowVisibility.Hidden }, NOT_SHOWN],
  [{ enabled: false, fileFound: false, window: WindowVisibility.Fullscreen }, NOT_SHOWN],
  [{ enabled: false, fileFound: true, window: WindowVisibility.Visible }, NOT_SHOWN],
  [{ enabled: false, fileFound: true, window: WindowVisibility.Hidden }, NOT_SHOWN],
  [{ enabled: false, fileFound: true, window: WindowVisibility.Fullscreen }, NOT_SHOWN],
  [{ enabled: true, fileFound: false, window: WindowVisibility.Visible }, NOT_SHOWN],
  [{ enabled: true, fileFound: false, window: WindowVisibility.Hidden }, NOT_SHOWN],
  [{ enabled: true, fileFound: false, window: WindowVisibility.Fullscreen }, NOT_SHOWN],
  [
    { enabled: true, fileFound: true, window: WindowVisibility.Visible },
    { video: BackgroundVideoPlayback.Playing, ytmBackground: YtmBackground.Transparent }
  ],
  [
    { enabled: true, fileFound: true, window: WindowVisibility.Hidden },
    { video: BackgroundVideoPlayback.Paused, ytmBackground: YtmBackground.Transparent }
  ],
  [
    { enabled: true, fileFound: true, window: WindowVisibility.Fullscreen },
    { video: BackgroundVideoPlayback.Hidden, ytmBackground: YtmBackground.Transparent }
  ]
];

const ALL_INPUTS: BackgroundVideoInput[] = [false, true].flatMap(enabled =>
  [false, true].flatMap(fileFound => Object.values(WindowVisibility).map(window => ({ enabled, fileFound, window })))
);

describe("decideBackgroundVideo", () => {
  it("covers every combination of the inputs", () => {
    expect(ALL_INPUTS).toHaveLength(12);
    expect(CASES.map(([input]) => input)).toEqual(expect.arrayContaining(ALL_INPUTS));
    expect(CASES).toHaveLength(12);
  });

  it.each(CASES)("returns the expected decision for %o", (input, expected) => {
    expect(decideBackgroundVideo(input)).toEqual(expected);
  });

  describe.each(ALL_INPUTS)("rules for %o", input => {
    const decision = decideBackgroundVideo(input);

    it("is not playing while the window is hidden", () => {
      if (input.window === WindowVisibility.Hidden) {
        expect(decision.video).not.toBe(BackgroundVideoPlayback.Playing);
      }
    });

    it("is not visible while fullscreen", () => {
      if (input.window === WindowVisibility.Fullscreen) {
        expect([BackgroundVideoPlayback.Playing, BackgroundVideoPlayback.Paused]).not.toContain(decision.video);
      }
    });

    it("is not shown and keeps the theme background while disabled", () => {
      if (!input.enabled) {
        expect(decision).toEqual(NOT_SHOWN);
      }
    });

    it("is not shown and keeps the theme background while the file is not found", () => {
      if (!input.fileFound) {
        expect(decision).toEqual(NOT_SHOWN);
      }
    });

    it("is playing while the window is visible, enabled and the file is found", () => {
      if (input.window === WindowVisibility.Visible && input.enabled && input.fileFound) {
        expect(decision.video).toBe(BackgroundVideoPlayback.Playing);
      }
    });
  });
});
