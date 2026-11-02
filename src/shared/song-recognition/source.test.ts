import { describe, expect, it } from "vitest";
import { SongRecognitionInputDevice, SongRecognitionSourceKind, SongRecognitionSourceSetting } from "./index";
import { isPcAudioAvailable, resolveRecordSource } from "./source";

const DEVICES: SongRecognitionInputDevice[] = [
  { deviceId: "mic-1", label: "Microphone" },
  { deviceId: "mic-2", label: "Headset" }
];

const setting = (kind: SongRecognitionSourceKind, deviceId: string | null = null): SongRecognitionSourceSetting => ({ kind, deviceId, label: null });

describe("isPcAudioAvailable", () => {
  it.each([
    ["win32", true],
    ["darwin", false],
    ["linux", false],
    ["freebsd", false],
    ["", false]
  ])("is %s -> %s", (platform, expected) => {
    expect(isPcAudioAvailable(platform)).toBe(expected);
  });
});

describe("resolveRecordSource", () => {
  describe("PC audio", () => {
    it("records the PC audio on win32", () => {
      expect(resolveRecordSource(setting(SongRecognitionSourceKind.PcAudio), DEVICES, "win32")).toEqual({ kind: SongRecognitionSourceKind.PcAudio });
    });

    it.each(["darwin", "linux"])("falls back to the default mic on %s", platform => {
      expect(resolveRecordSource(setting(SongRecognitionSourceKind.PcAudio), DEVICES, platform)).toEqual({
        kind: SongRecognitionSourceKind.DefaultMic
      });
    });
  });

  describe("default mic", () => {
    it.each(["win32", "darwin", "linux"])("records the default mic on %s", platform => {
      expect(resolveRecordSource(setting(SongRecognitionSourceKind.DefaultMic), DEVICES, platform)).toEqual({
        kind: SongRecognitionSourceKind.DefaultMic
      });
    });
  });

  describe("a device", () => {
    it("records the device that is connected", () => {
      expect(resolveRecordSource(setting(SongRecognitionSourceKind.Device, "mic-2"), DEVICES, "win32")).toEqual({
        kind: SongRecognitionSourceKind.Device,
        deviceId: "mic-2"
      });
    });

    it("falls back to the default mic when the device is not connected", () => {
      expect(resolveRecordSource(setting(SongRecognitionSourceKind.Device, "gone"), DEVICES, "win32")).toEqual({
        kind: SongRecognitionSourceKind.DefaultMic
      });
    });

    it("falls back to the default mic when there are no devices", () => {
      expect(resolveRecordSource(setting(SongRecognitionSourceKind.Device, "mic-1"), [], "darwin")).toEqual({
        kind: SongRecognitionSourceKind.DefaultMic
      });
    });

    it("falls back to the default mic when the device id is null", () => {
      expect(resolveRecordSource(setting(SongRecognitionSourceKind.Device, null), DEVICES, "linux")).toEqual({
        kind: SongRecognitionSourceKind.DefaultMic
      });
    });
  });

  describe("a missing setting", () => {
    it.each([null, undefined])("records the PC audio for %s where it is available", value => {
      expect(resolveRecordSource(value, DEVICES, "win32")).toEqual({ kind: SongRecognitionSourceKind.PcAudio });
    });

    it.each([
      [null, "darwin"],
      [undefined, "darwin"],
      [null, "linux"],
      [undefined, "linux"]
    ])("records the default mic for %s on %s where the PC audio is not available", (value, platform) => {
      expect(resolveRecordSource(value, DEVICES, platform)).toEqual({ kind: SongRecognitionSourceKind.DefaultMic });
    });

    it("treats a kind that is not known as the default", () => {
      const unknown = { kind: "other", deviceId: "mic-1", label: null } as unknown as SongRecognitionSourceSetting;
      expect(resolveRecordSource(unknown, DEVICES, "win32")).toEqual({ kind: SongRecognitionSourceKind.PcAudio });
      expect(resolveRecordSource(unknown, DEVICES, "darwin")).toEqual({ kind: SongRecognitionSourceKind.DefaultMic });
      expect(resolveRecordSource(unknown, DEVICES, "linux")).toEqual({ kind: SongRecognitionSourceKind.DefaultMic });
    });

    it("treats a value of another shape as the default", () => {
      expect(resolveRecordSource("x" as unknown as SongRecognitionSourceSetting, DEVICES, "win32")).toEqual({
        kind: SongRecognitionSourceKind.PcAudio
      });
    });
  });
});
