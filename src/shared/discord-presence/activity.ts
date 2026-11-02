import { Thumbnail, VideoDetails, VideoState } from "~shared/playerstatestore/types";

export enum DiscordActivityType {
  Game = 0,
  Streaming = 1,
  Listening = 2,
  Watching = 3,
  Custom = 4,
  Competing = 5
}

export enum DiscordActivityStatusDisplayType {
  Name = 0,
  State = 1,
  Details = 2
}

export type DiscordActivity = {
  type?: DiscordActivityType;
  status_display_type: DiscordActivityStatusDisplayType;
  state?: string;
  state_url?: string;
  details?: string;
  details_url?: string;
  timestamps?: {
    start?: number;
    end?: number;
  };
  assets?: {
    large_image?: string;
    large_text?: string;
    large_url?: string;
    small_image?: string;
    small_text?: string;
    small_url?: string;
  };
  instance?: boolean;
  buttons?: {
    label: string;
    url: string;
  }[];
};

export const TemplateField = {
  Title: "title",
  Artist: "artist",
  Album: "album"
} as const;
export type TemplateField = (typeof TemplateField)[keyof typeof TemplateField];

export type PresenceDisplaySettings = {
  templates: {
    details: string;
    state: string;
    largeText: string;
  };
  showButton: boolean;
  statusDisplay: DiscordActivityStatusDisplayType;
};

export const DEFAULT_PRESENCE_DISPLAY_SETTINGS: PresenceDisplaySettings = {
  templates: {
    details: `{${TemplateField.Title}}`,
    state: `{${TemplateField.Artist}}`,
    largeText: `{${TemplateField.Album}}`
  },
  showButton: true,
  statusDisplay: DiscordActivityStatusDisplayType.State
};

export type ActivityInput = {
  videoDetails: VideoDetails;
  videoState: VideoState;
  progressSeconds: number;
  nowMs: number;
};

type LengthLimits = {
  maximum: number;
  minimum: number;
};

export const ACTIVITY_TEXT_MAX_LENGTH = 128;
export const ACTIVITY_TEXT_MIN_LENGTH = 2;
const ACTIVITY_TEXT_LIMITS: LengthLimits = { maximum: ACTIVITY_TEXT_MAX_LENGTH, minimum: ACTIVITY_TEXT_MIN_LENGTH };

export const ACTIVITY_IMAGE_URL_MAX_LENGTH = 256;
const FALLBACK_LARGE_IMAGE_KEY = "ytmd-logo";
const PLAY_BUTTON_LABEL = "Play on YTMDesktop";

const SmallImageKey = {
  Playing: "play-border",
  Paused: "pause-border"
} as const;

const SmallImageText = {
  Playing: "Playing",
  Paused: "Paused"
} as const;

const TEMPLATE_FIELD_PATTERN = /\{(\w+)\}/g;

function getHighestResThumbnail(thumbnails: Thumbnail[]): string | undefined {
  return thumbnails.reduce<Thumbnail | undefined>(
    (accumulator, current) =>
      accumulator && current.height * current.width <= accumulator.height * accumulator.width ? accumulator : current,
    thumbnails[0]
  )?.url;
}

function getSmallImageKey(state: VideoState) {
  // Developer Note:
  // You can add "-invert" to the end of the image key to invert (Black with White Border)
  return state === VideoState.Playing ? SmallImageKey.Playing : SmallImageKey.Paused;
}

function getSmallImageText(state: VideoState) {
  return state === VideoState.Playing ? SmallImageText.Playing : SmallImageText.Paused;
}

function fitLength(str: string, limits: LengthLimits) {
  if (str.length > limits.maximum) {
    return str.substring(0, limits.maximum - 3).trim() + "...";
  }
  if (str.length < limits.minimum) {
    return str.padEnd(limits.minimum, "​"); // Zero width space
  }
  return str;
}

/**
 * Replaces each known `{field}` in the template with its value. Unknown fields are kept as they are.
 */
function fillTemplate(template: string, values: Record<TemplateField, string>) {
  return template.replace(TEMPLATE_FIELD_PATTERN, (match, name: string) => (isTemplateField(name) ? values[name] : match));
}

function isTemplateField(name: string): name is TemplateField {
  return (Object.values(TemplateField) as string[]).includes(name);
}

/**
 * Fills the template, trims it and fits it to the length limits. Returns undefined when the trimmed result is empty.
 */
function renderText(template: string, values: Record<TemplateField, string>, limits: LengthLimits) {
  const text = fillTemplate(template, values).trim();
  if (text.length === 0) return undefined;
  return fitLength(text, limits);
}

/**
 * Builds the activity from the display settings and the current playback.
 * An empty first line falls back to the title, other empty lines are left out.
 */
export function buildActivity(settings: PresenceDisplaySettings, input: ActivityInput): DiscordActivity {
  const { videoDetails, videoState, progressSeconds, nowMs } = input;
  const { title, author, album, id, thumbnails, durationSeconds, channelId, albumId } = videoDetails;
  const values: Record<TemplateField, string> = {
    [TemplateField.Title]: title,
    [TemplateField.Artist]: author,
    [TemplateField.Album]: album ?? ""
  };

  const details = renderText(settings.templates.details, values, ACTIVITY_TEXT_LIMITS) ?? fitLength(title, ACTIVITY_TEXT_LIMITS);
  const state = renderText(settings.templates.state, values, ACTIVITY_TEXT_LIMITS);
  const largeText = renderText(settings.templates.largeText, values, ACTIVITY_TEXT_LIMITS);

  const thumbnail = getHighestResThumbnail(thumbnails);
  const isPlaying = videoState === VideoState.Playing;

  return {
    type: DiscordActivityType.Listening,
    status_display_type: settings.statusDisplay,
    details,
    details_url: `https://music.youtube.com/watch?v=${id}`,
    state,
    state_url: state !== undefined ? `https://music.youtube.com/channel/${channelId}` : undefined,
    timestamps: {
      start: isPlaying ? nowMs - progressSeconds * 1000 : undefined,
      end: isPlaying ? nowMs + (durationSeconds - progressSeconds) * 1000 : undefined
    },
    assets: {
      large_image: thumbnail && thumbnail.length <= ACTIVITY_IMAGE_URL_MAX_LENGTH ? thumbnail : FALLBACK_LARGE_IMAGE_KEY,
      large_text: largeText,
      large_url: albumId ? `https://music.youtube.com/browse/${albumId}` : undefined,
      small_image: getSmallImageKey(videoState),
      small_text: getSmallImageText(videoState)
    },
    instance: false,
    buttons: settings.showButton
      ? [
          {
            label: PLAY_BUTTON_LABEL,
            url: `ytmd://play/${id}`
          }
        ]
      : undefined
  };
}
