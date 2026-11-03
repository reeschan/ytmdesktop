export type TrayTooltipTrack = {
  title?: string | null;
  artist?: string | null;
};

export type TrayTooltipOptions = {
  /** Text used when there is no title (for example the app name). */
  idleText: string;
  /** Maximum length in UTF-16 code units, including the ellipsis. No limit when omitted. */
  maxLength?: number;
};

const ELLIPSIS = "...";
const TITLE_ARTIST_SEPARATOR = " - ";

function isHighSurrogate(charCode: number) {
  return charCode >= 0xd800 && charCode <= 0xdbff;
}

/**
 * Cuts the text so that it fits the maximum length, ending it with an ellipsis.
 * A surrogate pair is never split, so the result can be one unit shorter than the maximum.
 */
function fitToMaxLength(text: string, maxLength: number | undefined) {
  if (maxLength === undefined || text.length <= maxLength) return text;
  if (maxLength <= ELLIPSIS.length) return ELLIPSIS.slice(0, Math.max(maxLength, 0));

  let end = maxLength - ELLIPSIS.length;
  if (isHighSurrogate(text.charCodeAt(end - 1))) end -= 1;
  return text.slice(0, end) + ELLIPSIS;
}

/**
 * Builds the tooltip text as `title - artist`, or only the title when there is no artist.
 * Leading and trailing spaces are removed. Falls back to the idle text when there is no title.
 */
export function buildTrayTooltip(track: TrayTooltipTrack, options: TrayTooltipOptions): string {
  const title = track.title?.trim() ?? "";
  const artist = track.artist?.trim() ?? "";

  let text = options.idleText;
  if (title.length > 0) {
    text = artist.length > 0 ? `${title}${TITLE_ARTIST_SEPARATOR}${artist}` : title;
  }
  return fitToMaxLength(text, options.maxLength);
}
