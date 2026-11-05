import { BUNDLED_THEMES, BundledTheme, ColorItem, ThemeColors } from "./index";

/**
 * The pixels of a jacket image, in row order. `order` says whether the bytes are RGBA or BGRA
 */
export type JacketImage = {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
  order: "rgba" | "bgra";
};

// Pixels with a smaller alpha are almost transparent and do not count
const MIN_ALPHA = 128;

// The groups pixels are sorted into: 4 steps of lightness, 12 steps of hue, and one group per lightness for colors without a hue
const LIGHTNESS_STEPS = 4;
const HUE_STEPS = 12;
const HUE_STEP_DEGREES = 360 / HUE_STEPS;
// Colors with a smaller chroma have no hue (white, gray, black)
const ACHROMATIC_CHROMA = 0.04;

// A group needs this share of the counted pixels to become the prominent color
const PROMINENT_MIN_SHARE = 0.03;
// The accent of a jacket with a less vivid prominent color is the Glass accent
const ACCENT_MIN_PROMINENT_CHROMA = 0.06;
const ACCENT_LIGHTNESS = 0.72;
const ACCENT_MIN_CHROMA = 0.1;
const ACCENT_MAX_CHROMA = 0.2;

const BACKGROUND_LIGHTNESS = 0.16;
const SURFACE_LIGHTNESS = 0.85;
// The most chroma the background, the surface and the border take from the dominant color
const TINT_MAX_CHROMA = 0.04;
const SURFACE_ALPHA = 0.1;
const BORDER_ALPHA = 0.2;

// The hue slots of a lightness step: the achromatic group, then one group per hue step
const HUE_SLOTS = HUE_STEPS + 1;
const BUCKET_COUNT = LIGHTNESS_STEPS * HUE_SLOTS;

type Bucket = {
  count: number;
  a: number;
  b: number;
};

type ColorGroup = {
  count: number;
  chroma: number;
  hue: number;
  achromatic: boolean;
};

type Oklab = {
  lightness: number;
  a: number;
  b: number;
};

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function srgbToLinear(channel: number): number {
  const unit = channel / 255;
  return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
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
 * Converts an sRGB color (each channel 0 to 255) to OKLab (https://bottosson.github.io/posts/oklab/)
 */
function srgbToOklab(red: number, green: number, blue: number): Oklab {
  const r = srgbToLinear(red);
  const g = srgbToLinear(green);
  const b = srgbToLinear(blue);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  return {
    lightness: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  };
}

/**
 * Converts an OKLCH color to a hex color (`#RRGGBB`, or `#RRGGBBAA` when it is not opaque).
 * Channels outside the sRGB gamut are clamped
 */
function oklchToHex(lightness: number, chroma: number, hue: number, alpha = 1): string {
  const hueRadians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(hueRadians);
  const b = chroma * Math.sin(hueRadians);

  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const hex = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ]
    .map(channel => toHexByte(linearToGammaSrgb(channel)))
    .join("");

  return alpha < 1 ? `#${hex}${toHexByte(alpha)}` : `#${hex}`;
}

function bucketIndex(lightness: number, chroma: number, hue: number): number {
  const lightnessStep = Math.min(LIGHTNESS_STEPS - 1, Math.max(0, Math.floor(lightness * LIGHTNESS_STEPS)));
  if (chroma < ACHROMATIC_CHROMA) return lightnessStep * HUE_SLOTS;

  const hueStep = Math.min(HUE_STEPS - 1, Math.max(0, Math.floor(hue / HUE_STEP_DEGREES)));
  return lightnessStep * HUE_SLOTS + hueStep + 1;
}

function normalizeHue(radians: number): number {
  return ((((radians * 180) / Math.PI) % 360) + 360) % 360;
}

/**
 * Reads the color groups of an image, in one pass over its pixels
 */
function readGroups(image: JacketImage): { groups: ColorGroup[]; counted: number } {
  const buckets: Bucket[] = Array.from({ length: BUCKET_COUNT }, () => ({ count: 0, a: 0, b: 0 }));
  const data = image.data;
  const width = Math.max(0, Math.floor(image.width));
  const height = Math.max(0, Math.floor(image.height));
  const pixelCount = Math.min(width * height, Math.floor(data.length / 4));
  const isRgba = image.order === "rgba";
  let counted = 0;

  for (let index = 0; index < pixelCount; index++) {
    const offset = index * 4;
    if (data[offset + 3] < MIN_ALPHA) continue;

    const lab = srgbToOklab(isRgba ? data[offset] : data[offset + 2], data[offset + 1], isRgba ? data[offset + 2] : data[offset]);
    const chroma = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
    const hue = chroma === 0 ? 0 : normalizeHue(Math.atan2(lab.b, lab.a));
    const bucket = buckets[bucketIndex(lab.lightness, chroma, hue)];
    bucket.count++;
    bucket.a += lab.a;
    bucket.b += lab.b;
    counted++;
  }

  const groups: ColorGroup[] = [];
  for (let index = 0; index < BUCKET_COUNT; index++) {
    const bucket = buckets[index];
    if (bucket.count === 0) continue;

    const meanA = bucket.a / bucket.count;
    const meanB = bucket.b / bucket.count;
    const chroma = Math.sqrt(meanA * meanA + meanB * meanB);
    const achromatic = index % HUE_SLOTS === 0;
    groups.push({
      count: bucket.count,
      chroma,
      hue: achromatic || chroma === 0 ? 0 : normalizeHue(Math.atan2(meanB, meanA)),
      achromatic
    });
  }

  return { groups, counted };
}

/**
 * Builds the six color items of the Jacket theme from the pixels of a jacket.
 * Pixels that are almost transparent do not count, and an image with no counted pixel returns the Glass colors
 */
export function extractJacketColors(image: JacketImage): ThemeColors {
  const glass = BUNDLED_THEMES[BundledTheme.Glass];
  const { groups, counted } = readGroups(image);
  if (counted === 0) return { ...glass };

  let dominant: ColorGroup | null = null;
  let prominent: ColorGroup | null = null;
  let prominentScore = 0;
  for (const group of groups) {
    if (dominant === null || group.count > dominant.count) dominant = group;

    const share = group.count / counted;
    if (share < PROMINENT_MIN_SHARE) continue;

    const score = group.chroma * Math.sqrt(share);
    if (score > prominentScore) {
      prominent = group;
      prominentScore = score;
    }
  }

  // A group always exists when a pixel was counted
  if (dominant === null) return { ...glass };
  const mainColor = dominant;

  const tintChroma = mainColor.achromatic ? 0 : Math.min(mainColor.chroma, TINT_MAX_CHROMA);
  const accent =
    prominent !== null && prominent.chroma >= ACCENT_MIN_PROMINENT_CHROMA
      ? oklchToHex(ACCENT_LIGHTNESS, Math.min(ACCENT_MAX_CHROMA, Math.max(ACCENT_MIN_CHROMA, prominent.chroma)), prominent.hue)
      : glass[ColorItem.Accent];

  return {
    [ColorItem.Background]: oklchToHex(BACKGROUND_LIGHTNESS, tintChroma, mainColor.hue),
    [ColorItem.Surface]: oklchToHex(SURFACE_LIGHTNESS, tintChroma, mainColor.hue, SURFACE_ALPHA),
    [ColorItem.Text]: glass[ColorItem.Text],
    [ColorItem.TextMuted]: glass[ColorItem.TextMuted],
    [ColorItem.Accent]: accent,
    [ColorItem.Border]: oklchToHex(SURFACE_LIGHTNESS, tintChroma, mainColor.hue, BORDER_ALPHA)
  };
}
