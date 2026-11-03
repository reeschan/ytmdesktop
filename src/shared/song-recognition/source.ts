import { SongRecognitionInputDevice, SongRecognitionRecordSource, SongRecognitionSourceKind, SongRecognitionSourceSetting } from "./index";

// Loopback capture of the PC audio is documented by Electron for Windows only
const PC_AUDIO_PLATFORMS = ["win32"];

export function isPcAudioAvailable(platform: string): boolean {
  return PC_AUDIO_PLATFORMS.includes(platform);
}

function pcAudioOrDefaultMic(platform: string): SongRecognitionRecordSource {
  return isPcAudioAvailable(platform) ? { kind: SongRecognitionSourceKind.PcAudio } : { kind: SongRecognitionSourceKind.DefaultMic };
}

// A missing or unknown setting is treated as the default (PC audio on Windows, the default mic elsewhere)
export function resolveRecordSource(
  setting: SongRecognitionSourceSetting | null | undefined,
  devices: SongRecognitionInputDevice[],
  platform: string
): SongRecognitionRecordSource {
  switch (setting?.kind) {
    case SongRecognitionSourceKind.DefaultMic:
      return { kind: SongRecognitionSourceKind.DefaultMic };
    case SongRecognitionSourceKind.Device: {
      const deviceId = setting.deviceId;
      if (deviceId !== null && devices.some(device => device.deviceId === deviceId)) {
        return { kind: SongRecognitionSourceKind.Device, deviceId };
      }
      return { kind: SongRecognitionSourceKind.DefaultMic };
    }
    default:
      return pcAudioOrDefaultMic(platform);
  }
}
