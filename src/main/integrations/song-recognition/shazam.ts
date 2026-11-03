import { SHAZAM_API_HOST, SHAZAM_DETECT_URL } from "~shared/song-recognition";
import { ShazamOutcome, ShazamOutcomeKind } from "~shared/song-recognition/response";

/**
 * Posts the base64 PCM to Shazam and reports what came back. Never throws.
 * An aborted signal is reported as a timeout, any other failure to reach the server as a network error.
 * The body is null when it is not JSON.
 */
export async function detectSong(apiKey: string, pcm: string, signal: AbortSignal): Promise<ShazamOutcome> {
  try {
    const response = await fetch(SHAZAM_DETECT_URL, {
      method: "POST",
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": SHAZAM_API_HOST,
        "Content-Type": "text/plain"
      },
      body: pcm,
      signal
    });

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      if (signal.aborted) return { kind: ShazamOutcomeKind.Timeout };
    }

    return { kind: ShazamOutcomeKind.Http, status: response.status, body };
  } catch {
    return signal.aborted ? { kind: ShazamOutcomeKind.Timeout } : { kind: ShazamOutcomeKind.NetworkError };
  }
}
