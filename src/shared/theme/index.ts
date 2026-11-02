export const ColorItem = {
  Background: "background",
  Surface: "surface",
  Text: "text",
  TextMuted: "textMuted",
  Accent: "accent",
  Border: "border"
} as const;
export type ColorItem = (typeof ColorItem)[keyof typeof ColorItem];

export const COLOR_ITEMS: readonly ColorItem[] = [
  ColorItem.Background,
  ColorItem.Surface,
  ColorItem.Text,
  ColorItem.TextMuted,
  ColorItem.Accent,
  ColorItem.Border
];

export const COLOR_ITEM_CSS_VARIABLES: Record<ColorItem, string> = {
  [ColorItem.Background]: "--ytmd-color-background",
  [ColorItem.Surface]: "--ytmd-color-surface",
  [ColorItem.Text]: "--ytmd-color-text",
  [ColorItem.TextMuted]: "--ytmd-color-text-muted",
  [ColorItem.Accent]: "--ytmd-color-accent",
  [ColorItem.Border]: "--ytmd-color-border"
};

export type ThemeColors = Record<ColorItem, string>;

export const BundledTheme = {
  Default: "default",
  Midnight: "midnight",
  Forest: "forest"
} as const;
export type BundledTheme = (typeof BundledTheme)[keyof typeof BundledTheme];

export const BUNDLED_THEMES: Record<BundledTheme, ThemeColors> = {
  [BundledTheme.Default]: {
    [ColorItem.Background]: "#030303",
    [ColorItem.Surface]: "#212121",
    [ColorItem.Text]: "#FFFFFF",
    [ColorItem.TextMuted]: "#AAAAAA",
    [ColorItem.Accent]: "#FF0000",
    [ColorItem.Border]: "#212121"
  },
  [BundledTheme.Midnight]: {
    [ColorItem.Background]: "#0B1020",
    [ColorItem.Surface]: "#161D33",
    [ColorItem.Text]: "#E6E9F2",
    [ColorItem.TextMuted]: "#9AA3BD",
    [ColorItem.Accent]: "#7AA2F7",
    [ColorItem.Border]: "#263052"
  },
  [BundledTheme.Forest]: {
    [ColorItem.Background]: "#0C1410",
    [ColorItem.Surface]: "#16231C",
    [ColorItem.Text]: "#E4EEE8",
    [ColorItem.TextMuted]: "#93A89B",
    [ColorItem.Accent]: "#4ADE80",
    [ColorItem.Border]: "#22352B"
  }
};

export const DEFAULT_THEME_COLORS: ThemeColors = BUNDLED_THEMES[BundledTheme.Default];

export const ThemeSourceKind = {
  Bundled: "bundled",
  File: "file"
} as const;
export type ThemeSourceKind = (typeof ThemeSourceKind)[keyof typeof ThemeSourceKind];

/**
 * A bundled theme by name, or the content of a theme file (`null` when the file could not be found)
 */
export type ThemeSource = { kind: typeof ThemeSourceKind.Bundled; theme: BundledTheme } | { kind: typeof ThemeSourceKind.File; content: string | null };

export type ResolvedTheme = {
  colors: ThemeColors;
  /**
   * Color items that were missing or not readable as a color, in the order of COLOR_ITEMS
   */
  unreadableItems: ColorItem[];
  fileMissing: boolean;
};

// https://www.w3.org/TR/css-color-4/#named-colors
const NAMED_COLORS = new Set([
  "aliceblue", "antiquewhite", "aqua", "aquamarine", "azure", "beige", "bisque", "black", "blanchedalmond", "blue",
  "blueviolet", "brown", "burlywood", "cadetblue", "chartreuse", "chocolate", "coral", "cornflowerblue", "cornsilk", "crimson",
  "cyan", "darkblue", "darkcyan", "darkgoldenrod", "darkgray", "darkgreen", "darkgrey", "darkkhaki", "darkmagenta", "darkolivegreen",
  "darkorange", "darkorchid", "darkred", "darksalmon", "darkseagreen", "darkslateblue", "darkslategray", "darkslategrey", "darkturquoise", "darkviolet",
  "deeppink", "deepskyblue", "dimgray", "dimgrey", "dodgerblue", "firebrick", "floralwhite", "forestgreen", "fuchsia", "gainsboro",
  "ghostwhite", "gold", "goldenrod", "gray", "green", "greenyellow", "grey", "honeydew", "hotpink", "indianred",
  "indigo", "ivory", "khaki", "lavender", "lavenderblush", "lawngreen", "lemonchiffon", "lightblue", "lightcoral", "lightcyan",
  "lightgoldenrodyellow", "lightgray", "lightgreen", "lightgrey", "lightpink", "lightsalmon", "lightseagreen", "lightskyblue", "lightslategray", "lightslategrey",
  "lightsteelblue", "lightyellow", "lime", "limegreen", "linen", "magenta", "maroon", "mediumaquamarine", "mediumblue", "mediumorchid",
  "mediumpurple", "mediumseagreen", "mediumslateblue", "mediumspringgreen", "mediumturquoise", "mediumvioletred", "midnightblue", "mintcream", "mistyrose", "moccasin",
  "navajowhite", "navy", "oldlace", "olive", "olivedrab", "orange", "orangered", "orchid", "palegoldenrod", "palegreen",
  "paleturquoise", "palevioletred", "papayawhip", "peachpuff", "peru", "pink", "plum", "powderblue", "purple", "rebeccapurple",
  "red", "rosybrown", "royalblue", "saddlebrown", "salmon", "sandybrown", "seagreen", "seashell", "sienna", "silver",
  "skyblue", "slateblue", "slategray", "slategrey", "snow", "springgreen", "steelblue", "tan", "teal", "thistle",
  "tomato", "turquoise", "violet", "wheat", "white", "whitesmoke", "yellow", "yellowgreen",
  "transparent"
]);

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNCTION_COLOR = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\((?:[0-9.%/,\s+-]|deg|none)*\)$/i;
const CSS_BREAKING_CHARACTERS = /[;{}]/;

/**
 * Returns whether the value is a hex color, a color function or a named color.
 * Values containing `;`, `{` or `}` are never readable
 */
export function isReadableColor(value: string): boolean {
  if (CSS_BREAKING_CHARACTERS.test(value)) return false;

  const trimmed = value.trim();
  return HEX_COLOR.test(trimmed) || FUNCTION_COLOR.test(trimmed) || NAMED_COLORS.has(trimmed.toLowerCase());
}

const NATIVE_FUNCTION_COLOR = /^(?:rgba?|hsla?)\(/i;
const OK_FUNCTION_COLOR = /^(oklab|oklch)\((.*)\)$/i;
const OK_COMPONENT = /^(?:none|[+-]?(?:\d+\.?\d*|\.\d+)(?:%|deg)?)$/i;
// Reference ranges of CSS Color 4: 100% is 1 for L, 0.4 for C, a and b, and 1 for alpha
const OK_LIGHTNESS_PERCENT_SCALE = 1;
const OK_CHROMA_PERCENT_SCALE = 0.4;
const ALPHA_PERCENT_SCALE = 1;

type OkComponentOptions = {
  // The value of 100%, or null when the component does not accept percentages (for example the hue of oklch)
  percentScale: number | null;
  // Whether the component accepts the deg unit (for example the hue of oklch)
  angle: boolean;
};

/**
 * Reads one component of an oklab() or oklch() color. `none` is 0. Returns null when the component is not readable
 */
function readOkComponent(token: string, options: OkComponentOptions): number | null {
  if (!OK_COMPONENT.test(token)) return null;

  const lower = token.toLowerCase();
  if (lower === "none") return 0;
  if (lower.endsWith("%")) return options.percentScale === null ? null : (parseFloat(lower) / 100) * options.percentScale;
  if (lower.endsWith("deg")) return options.angle ? parseFloat(lower) : null;
  return parseFloat(lower);
}

/**
 * Converts OKLab to linear sRGB (https://bottosson.github.io/posts/oklab/)
 */
function oklabToLinearSrgb(lightness: number, a: number, b: number): [number, number, number] {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ];
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function linearToGammaSrgb(value: number): number {
  const clamped = clampUnit(value);
  return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
}

function toHexByte(unit: number): string {
  return Math.round(clampUnit(unit) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
}

/**
 * Converts an oklab() or oklch() color to a hex color (`#RRGGBB`, or `#RRGGBBAA` when it is not opaque).
 * Channels outside the sRGB gamut are clamped. Returns null when the value is not readable
 */
function okColorToHex(value: string): string | null {
  const match = OK_FUNCTION_COLOR.exec(value);
  if (!match) return null;

  const [, name, body] = match;
  const [channelPart, alphaPart, ...rest] = body.split("/");
  if (rest.length > 0) return null;

  const tokens = channelPart.trim().split(/[\s,]+/);
  if (tokens.length !== 3) return null;

  const isOklch = name.toLowerCase() === "oklch";
  const lightness = readOkComponent(tokens[0], { percentScale: OK_LIGHTNESS_PERCENT_SCALE, angle: false });
  const second = readOkComponent(tokens[1], { percentScale: OK_CHROMA_PERCENT_SCALE, angle: false });
  const third = readOkComponent(tokens[2], isOklch ? { percentScale: null, angle: true } : { percentScale: OK_CHROMA_PERCENT_SCALE, angle: false });
  if (lightness === null || second === null || third === null) return null;

  let alpha = 1;
  if (alphaPart !== undefined) {
    const alphaTokens = alphaPart.trim().split(/\s+/);
    const readAlpha = alphaTokens.length === 1 ? readOkComponent(alphaTokens[0], { percentScale: ALPHA_PERCENT_SCALE, angle: false }) : null;
    if (readAlpha === null) return null;
    alpha = clampUnit(readAlpha);
  }

  const hueRadians = (third * Math.PI) / 180;
  const [a, b] = isOklch ? [second * Math.cos(hueRadians), second * Math.sin(hueRadians)] : [second, third];
  const hex = oklabToLinearSrgb(lightness, a, b)
    .map(channel => toHexByte(linearToGammaSrgb(channel)))
    .join("");

  return alpha < 1 ? `#${hex}${toHexByte(alpha)}` : `#${hex}`;
}

/**
 * Returns a color that native APIs can read (hex, rgb()/rgba(), hsl()/hsla() or a named color).
 * Those forms are returned as they are, oklab() and oklch() are converted to hex, and anything else returns the fallback
 */
export function toNativeColor(value: string, fallback: string): string {
  if (!isReadableColor(value)) return fallback;

  const trimmed = value.trim();
  if (HEX_COLOR.test(trimmed) || NATIVE_FUNCTION_COLOR.test(trimmed) || NAMED_COLORS.has(trimmed.toLowerCase())) return trimmed;

  return okColorToHex(trimmed) ?? fallback;
}

const CSS_COMMENT = /\/\*[\s\S]*?(?:\*\/|$)/g;
const CSS_CUSTOM_PROPERTY_DECLARATION = /(?<![\w-])(--[\w-]+)\s*:([^;{}]*)/g;
const IMPORTANT_FLAG = /!\s*important\s*$/i;

/**
 * Reads custom property declarations from CSS, in any selector. A later declaration of the same property wins
 */
function readCustomProperties(css: string): Map<string, string> {
  const properties = new Map<string, string>();
  const withoutComments = css.replace(CSS_COMMENT, "");
  for (const [, name, rawValue] of withoutComments.matchAll(CSS_CUSTOM_PROPERTY_DECLARATION)) {
    properties.set(name, rawValue.trim().replace(IMPORTANT_FLAG, "").trim());
  }
  return properties;
}

/**
 * Resolves the colors of a theme source. Items that are missing or not readable as a color fall back to DEFAULT_THEME_COLORS
 */
export function resolveTheme(source: ThemeSource): ResolvedTheme {
  if (source.kind === ThemeSourceKind.Bundled) {
    return { colors: { ...BUNDLED_THEMES[source.theme] }, unreadableItems: [], fileMissing: false };
  }

  if (source.content === null) {
    return { colors: { ...DEFAULT_THEME_COLORS }, unreadableItems: [], fileMissing: true };
  }

  const properties = readCustomProperties(source.content);
  const colors = { ...DEFAULT_THEME_COLORS };
  const unreadableItems: ColorItem[] = [];
  for (const item of COLOR_ITEMS) {
    const value = properties.get(COLOR_ITEM_CSS_VARIABLES[item]);
    if (value !== undefined && isReadableColor(value)) {
      colors[item] = value;
    } else {
      unreadableItems.push(item);
    }
  }
  return { colors, unreadableItems, fileMissing: false };
}

/**
 * Builds a CSS rule declaring every color item as its CSS variable (for example `:root { --ytmd-color-background: #030303; ... }`)
 */
export function toCssVariables(colors: ThemeColors, selector: string): string {
  const declarations = COLOR_ITEMS.map(item => `${COLOR_ITEM_CSS_VARIABLES[item]}: ${colors[item]};`).join(" ");
  return `${selector} { ${declarations} }`;
}
