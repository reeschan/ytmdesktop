import { describe, expect, it } from "vitest";
import {
  BackgroundVideoDecision,
  BackgroundVideoInput,
  BackgroundVideoMotion,
  BackgroundVideoPlayback,
  BackgroundVideoSource,
  decideBackgroundVideo,
  WindowVisibility,
  YtmBackground
} from "~shared/background-video";

type FileInput = Pick<BackgroundVideoInput, "enabled" | "fileFound" | "window">;
type FileDecision = Pick<BackgroundVideoDecision, "video" | "ytmBackground">;

const NOT_SHOWN: FileDecision = { video: BackgroundVideoPlayback.NotShown, ytmBackground: YtmBackground.Theme };

// Expectations for a video file with normal motion
const FILE_CASES: [FileInput, FileDecision][] = [
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

const ALL_FILE_INPUTS: FileInput[] = [false, true].flatMap(enabled =>
  [false, true].flatMap(fileFound => Object.values(WindowVisibility).map(window => ({ enabled, fileFound, window })))
);

const BOOLEANS = [false, true];

const ALL_INPUTS: BackgroundVideoInput[] = BOOLEANS.flatMap(enabled =>
  Object.values(BackgroundVideoSource).flatMap(source =>
    BOOLEANS.flatMap(videoAvailable =>
      BOOLEANS.flatMap(fileFound =>
        Object.values(WindowVisibility).flatMap(window =>
          BOOLEANS.map(reducedMotion => ({ enabled, source, videoAvailable, fileFound, window, reducedMotion }))
        )
      )
    )
  )
);

function hasPicture(input: BackgroundVideoInput): boolean {
  if (input.source === BackgroundVideoSource.Spectrum) return !input.reducedMotion;
  return input.source === BackgroundVideoSource.Playing ? input.videoAvailable : input.fileFound;
}

function isShown(decision: BackgroundVideoDecision): boolean {
  return decision.video !== BackgroundVideoPlayback.NotShown;
}

/**
 * Checks the rule against every combination of the inputs, naming the input that breaks it
 */
function expectForAll(rule: (input: BackgroundVideoInput, decision: BackgroundVideoDecision) => boolean) {
  for (const input of ALL_INPUTS) {
    const decision = decideBackgroundVideo(input);
    expect(rule(input, decision), `${JSON.stringify(input)} -> ${JSON.stringify(decision)}`).toBe(true);
  }
}

describe("decideBackgroundVideo", () => {
  it("covers every combination of the inputs", () => {
    expect(ALL_FILE_INPUTS).toHaveLength(12);
    expect(FILE_CASES.map(([input]) => input)).toEqual(expect.arrayContaining(ALL_FILE_INPUTS));
    expect(FILE_CASES).toHaveLength(12);
    expect(ALL_INPUTS).toHaveLength(144);
    expect(new Set(ALL_INPUTS.map(input => JSON.stringify(input))).size).toBe(144);
  });

  it.each(FILE_CASES)("returns the expected decision for a video file with normal motion for %o", (input, expected) => {
    const decision = decideBackgroundVideo({ ...input, source: BackgroundVideoSource.File, videoAvailable: false, reducedMotion: false });
    expect(decision).toEqual({ ...expected, motion: BackgroundVideoMotion.Continuous });
  });

  describe("rules for every combination of the inputs", () => {
    it("is not shown and keeps the theme background while disabled", () => {
      expectForAll((input, decision) => input.enabled || (!isShown(decision) && decision.ytmBackground === YtmBackground.Theme));
    });

    it("is not shown and keeps the theme background while the source has no picture", () => {
      expectForAll((input, decision) => hasPicture(input) || (!isShown(decision) && decision.ytmBackground === YtmBackground.Theme));
    });

    it("is not drawing while the window is hidden", () => {
      expectForAll((input, decision) => input.window !== WindowVisibility.Hidden || decision.video !== BackgroundVideoPlayback.Playing);
    });

    it("is not visible while fullscreen", () => {
      expectForAll(
        (input, decision) =>
          input.window !== WindowVisibility.Fullscreen ||
          ![BackgroundVideoPlayback.Playing, BackgroundVideoPlayback.Paused].some(playback => playback === decision.video)
      );
    });

    it("is not moving while motion is reduced", () => {
      expectForAll(
        (input, decision) =>
          !input.reducedMotion || decision.video !== BackgroundVideoPlayback.Playing || decision.motion !== BackgroundVideoMotion.Continuous
      );
    });

    it("is not left paused while the window is visible", () => {
      expectForAll((input, decision) => input.window !== WindowVisibility.Visible || decision.video !== BackgroundVideoPlayback.Paused);
    });

    it("is not left still while the window is visible with normal motion", () => {
      expectForAll(
        (input, decision) =>
          input.window !== WindowVisibility.Visible ||
          input.reducedMotion ||
          decision.video !== BackgroundVideoPlayback.Playing ||
          decision.motion !== BackgroundVideoMotion.Still
      );
    });

    it("is shown while enabled, the source has a picture and the window is visible", () => {
      expectForAll((input, decision) => !(input.enabled && hasPicture(input) && input.window === WindowVisibility.Visible) || isShown(decision));
    });
  });

  describe("source", () => {
    it.each([
      [true, false, BackgroundVideoPlayback.Playing, YtmBackground.Transparent, BackgroundVideoMotion.Continuous],
      [false, false, BackgroundVideoPlayback.NotShown, YtmBackground.Theme, BackgroundVideoMotion.Continuous],
      [true, true, BackgroundVideoPlayback.NotShown, YtmBackground.Theme, BackgroundVideoMotion.Still]
    ])("decides spectrum visibility for enabled=%s and reducedMotion=%s", (enabled, reducedMotion, video, ytmBackground, motion) => {
      expect(
        decideBackgroundVideo({
          enabled,
          reducedMotion,
          source: BackgroundVideoSource.Spectrum,
          videoAvailable: false,
          fileFound: false,
          window: WindowVisibility.Visible
        })
      ).toEqual({ video, ytmBackground, motion });
    });

    it("decides spectrum independently of picture availability for every window", () => {
      for (const input of ALL_INPUTS.filter(input => input.source === BackgroundVideoSource.Spectrum)) {
        const decision = decideBackgroundVideo(input);
        expect(isShown(decision), JSON.stringify(input)).toBe(input.enabled && !input.reducedMotion);
        expect(decideBackgroundVideo({ ...input, videoAvailable: !input.videoAvailable, fileFound: !input.fileFound })).toEqual(decision);
      }
    });

    it("decides from whether the playing video is available, whatever the file, when the source is the playing video", () => {
      for (const input of ALL_INPUTS.filter(input => input.source === BackgroundVideoSource.Playing)) {
        const decision = decideBackgroundVideo(input);
        const message = JSON.stringify(input);
        expect(isShown(decision), message).toBe(input.enabled && input.videoAvailable);
        expect(decideBackgroundVideo({ ...input, fileFound: !input.fileFound }), message).toEqual(decision);
      }
    });

    it("decides from whether the file is found, whatever the playing video, when the source is the video file", () => {
      for (const input of ALL_INPUTS.filter(input => input.source === BackgroundVideoSource.File)) {
        const decision = decideBackgroundVideo(input);
        const message = JSON.stringify(input);
        expect(isShown(decision), message).toBe(input.enabled && input.fileFound);
        expect(decideBackgroundVideo({ ...input, videoAvailable: !input.videoAvailable }), message).toEqual(decision);
      }
    });
  });

  it("is still while motion is reduced and continuous otherwise", () => {
    expectForAll((input, decision) => decision.motion === (input.reducedMotion ? BackgroundVideoMotion.Still : BackgroundVideoMotion.Continuous));
  });
});
