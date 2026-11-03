import { desktopCapturer, session } from "electron";
import log from "electron-log";
import {
  SONG_RECOGNITION_RECORD_SECONDS,
  SONG_RECOGNITION_RECORDER_GLOBAL,
  SongRecognitionRecording,
  SongRecognitionRecordSource
} from "~shared/song-recognition";

const RECORD_TIMEOUT_MARGIN_MS = 10000;
const TIMED_OUT = Symbol("timed-out");

const Permission = {
  Media: "media",
  DisplayCapture: "display-capture"
} as const;

const MediaType = {
  Video: "video"
} as const;

const LOOPBACK_AUDIO = "loopback";

/**
 * Limits audio and screen capture on the default session to the app view and
 * hands it the system audio (loopback) for getDisplayMedia.
 * Other permissions keep Electron's default (allowed).
 * The getter is read on every request because the app view's web contents can be recreated.
 */
export function installSongRecognitionMediaHandlers(getAppViewContents: () => Electron.WebContents | null | undefined): void {
  const isAppView = (contents: Electron.WebContents | null | undefined) => {
    const appViewContents = getAppViewContents();
    return !!appViewContents && contents === appViewContents;
  };

  const defaultSession = session.defaultSession;

  defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    let granted = true;
    try {
      if (permission === Permission.Media) {
        const mediaTypes = (details as Electron.MediaAccessPermissionRequest).mediaTypes ?? [];
        granted = isAppView(webContents) && !mediaTypes.includes(MediaType.Video);
      } else if (permission === Permission.DisplayCapture) {
        granted = isAppView(webContents);
      }
    } catch (err) {
      log.error("Song recognition permission request failed", err);
      granted = false;
    } finally {
      callback(granted);
    }
  });

  defaultSession.setPermissionCheckHandler((webContents, permission) => {
    if (permission === Permission.Media || permission === Permission.DisplayCapture) {
      try {
        return isAppView(webContents);
      } catch (err) {
        log.error("Song recognition permission check failed", err);
        return false;
      }
    }

    return true;
  });

  defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    let answered = false;
    const answer = (streams: Electron.Streams | null) => {
      if (answered) return;
      answered = true;
      try {
        callback(streams);
      } catch (err) {
        log.error("Song recognition display media callback failed", err);
      }
    };

    try {
      const appViewContents = getAppViewContents();
      if (!appViewContents || !request.frame || request.frame !== appViewContents.mainFrame) {
        answer(null);
        return;
      }

      const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } });
      if (sources.length === 0) {
        answer(null);
        return;
      }

      answer({ video: sources[0], audio: LOOPBACK_AUDIO });
    } catch (err) {
      log.error("Song recognition display media request failed", err);
      answer(null);
    }
  });
}

function isRecording(value: unknown): value is SongRecognitionRecording {
  if (typeof value !== "object" || value === null) return false;
  const recording = value as { ok?: unknown; pcm?: unknown };
  if (recording.ok === true) return typeof recording.pcm === "string";
  return recording.ok === false;
}

/**
 * Records on the app view through its recorder global.
 * Resolves to { ok: false } when the recorder is missing, throws, answers in a wrong shape or does not answer in time.
 */
export async function recordOnAppView(contents: Electron.WebContents, source: SongRecognitionRecordSource): Promise<SongRecognitionRecording> {
  const failed: SongRecognitionRecording = { ok: false };
  const expression = `(async () => {
    const recorder = window[${JSON.stringify(SONG_RECOGNITION_RECORDER_GLOBAL)}];
    if (!recorder) return { ok: false };
    return await recorder.record(${JSON.stringify(source)});
  })()`;

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<typeof TIMED_OUT>(resolve => {
    timer = setTimeout(() => resolve(TIMED_OUT), SONG_RECOGNITION_RECORD_SECONDS * 1000 + RECORD_TIMEOUT_MARGIN_MS);
  });

  try {
    const result = await Promise.race([contents.executeJavaScript(expression, true) as Promise<unknown>, timeout]);
    if (result === TIMED_OUT) {
      cancelRecordingOnAppView(contents);
      return failed;
    }

    return isRecording(result) ? result : failed;
  } catch (err) {
    log.error("Song recognition recording failed", err);
    return failed;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Asks the app view's recorder to stop. Failures are ignored.
 */
export function cancelRecordingOnAppView(contents: Electron.WebContents): void {
  const expression = `window[${JSON.stringify(SONG_RECOGNITION_RECORDER_GLOBAL)}]?.cancel()`;
  try {
    contents.executeJavaScript(expression, true).catch(() => {});
  } catch {
    // The web contents is gone
  }
}
