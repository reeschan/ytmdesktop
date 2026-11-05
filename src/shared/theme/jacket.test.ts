import { describe, expect, it } from "vitest";
import { BUNDLED_THEMES, BundledTheme, ColorItem, isReadableColor, ThemeColors } from "~shared/theme";
import { extractJacketColors } from "~shared/theme/jacket";

const GLASS: ThemeColors = BUNDLED_THEMES[BundledTheme.Glass];

type PixelOrder = "rgba" | "bgra";

type Image = {
  data: Uint8Array;
  width: number;
  height: number;
  order: PixelOrder;
};

const OPAQUE = 255;

function writePixel(data: Uint8Array, index: number, color: readonly [number, number, number], order: PixelOrder, alpha: number): void {
  const offset = index * 4;
  const [r, g, b] = color;
  data[offset] = order === "rgba" ? r : b;
  data[offset + 1] = g;
  data[offset + 2] = order === "rgba" ? b : r;
  data[offset + 3] = alpha;
}

function solidImage(color: readonly [number, number, number], width = 8, height = 8, order: PixelOrder = "rgba", alpha = OPAQUE): Image {
  const data = new Uint8Array(width * height * 4);
  for (let index = 0; index < width * height; index++) writePixel(data, index, color, order, alpha);
  return { data, width, height, order };
}

/**
 * An image that is mostly `base` with `spotRatio` of its pixels in `spot`
 */
function spottedImage(
  base: readonly [number, number, number],
  spot: readonly [number, number, number],
  spotRatio: number,
  size = 64,
  order: PixelOrder = "rgba"
): Image {
  const data = new Uint8Array(size * size * 4);
  const spotPixels = Math.round(size * size * spotRatio);
  for (let index = 0; index < size * size; index++) {
    writePixel(data, index, index < spotPixels ? spot : base, order, OPAQUE);
  }
  return { data, width: size, height: size, order };
}

function srgbToLinear(channel: number): number {
  const unit = channel / 255;
  return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
}

/**
 * Reads the OKLCH lightness, chroma and hue of a hex color
 */
function hexToOklch(hex: string): { lightness: number; chroma: number; hue: number } {
  const [red, green, blue] = (hex.slice(1, 7).match(/../g) ?? []).map(channel => srgbToLinear(parseInt(channel, 16)));
  const l = 0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue;
  const m = 0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue;
  const s = 0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue;

  const light = Math.cbrt(l);
  const middle = Math.cbrt(m);
  const short = Math.cbrt(s);

  const lightness = 0.2104542553 * light + 0.793617785 * middle - 0.0040720468 * short;
  const a = 1.9779984951 * light - 2.428592205 * middle + 0.4505937099 * short;
  const b = 0.0259040371 * light + 0.7827717662 * middle - 0.808675766 * short;

  const hue = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return { lightness, chroma: Math.sqrt(a * a + b * b), hue };
}

function hueDistance(first: number, second: number): number {
  const distance = Math.abs(first - second) % 360;
  return distance > 180 ? 360 - distance : distance;
}

const RED: [number, number, number] = [255, 0, 0];
const GREEN: [number, number, number] = [0, 255, 0];
const BLUE: [number, number, number] = [0, 0, 255];
const NAVY: [number, number, number] = [19, 28, 51];
const ORANGE: [number, number, number] = [255, 106, 0];

const RED_HUE = 29.23;
const GREEN_HUE = 142.5;
const BLUE_HUE = 264.05;
const ORANGE_HUE = 45;

describe("extractJacketColors", () => {
  it.each([
    ["red", RED, RED_HUE],
    ["green", GREEN, GREEN_HUE],
    ["blue", BLUE, BLUE_HUE]
  ] as const)("uses the hue of a %s jacket for the accent", (_name, color, hue) => {
    const colors = extractJacketColors(solidImage(color));

    expect(hueDistance(hexToOklch(colors[ColorItem.Accent]).hue, hue)).toBeLessThanOrEqual(25);
  });

  it("takes the background hue from the dominant color and the accent hue from the vivid spot", () => {
    const image = spottedImage(NAVY, ORANGE, 0.12);
    const colors = extractJacketColors(image);

    expect(hueDistance(hexToOklch(colors[ColorItem.Background]).hue, hexToOklch("#131C33").hue)).toBeLessThanOrEqual(25);
    expect(hueDistance(hexToOklch(colors[ColorItem.Accent]).hue, ORANGE_HUE)).toBeLessThanOrEqual(25);
  });

  it.each([
    ["black", [0, 0, 0]],
    ["white", [255, 255, 255]],
    ["gray", [128, 128, 128]]
  ] as const)("uses the Glass accent for a %s jacket", (_name, color) => {
    expect(extractJacketColors(solidImage(color))[ColorItem.Accent]).toBe(GLASS[ColorItem.Accent]);
  });

  it.each([
    ["white", solidImage([255, 255, 255])],
    ["black", solidImage([0, 0, 0])],
    ["red", solidImage(RED)],
    ["navy with orange", spottedImage(NAVY, ORANGE, 0.12)]
  ] as const)("keeps the Glass text colors for a %s jacket", (_name, image) => {
    const colors = extractJacketColors(image);

    expect(colors[ColorItem.Text]).toBe(GLASS[ColorItem.Text]);
    expect(colors[ColorItem.TextMuted]).toBe(GLASS[ColorItem.TextMuted]);
  });

  it.each([
    ["white", solidImage([255, 255, 255])],
    ["black", solidImage([0, 0, 0])],
    ["red", solidImage(RED)],
    ["navy with orange", spottedImage(NAVY, ORANGE, 0.12)]
  ] as const)("keeps the background dark for a %s jacket", (_name, image) => {
    expect(hexToOklch(extractJacketColors(image)[ColorItem.Background]).lightness).toBeLessThanOrEqual(0.25);
  });

  it.each([
    ["white", solidImage([255, 255, 255])],
    ["black", solidImage([0, 0, 0])],
    ["red", solidImage(RED)],
    ["navy with orange", spottedImage(NAVY, ORANGE, 0.12)]
  ] as const)("returns readable colors for a %s jacket", (_name, image) => {
    const colors = extractJacketColors(image);

    for (const value of Object.values(colors)) expect(isReadableColor(value)).toBe(true);
  });

  it("returns the Glass colors for an image whose pixels are all almost transparent", () => {
    expect(extractJacketColors(solidImage(RED, 8, 8, "rgba", 127))).toEqual(GLASS);
  });

  it("returns the Glass colors for an image with no pixels", () => {
    expect(extractJacketColors({ data: new Uint8Array(0), width: 0, height: 0, order: "rgba" })).toEqual(GLASS);
  });

  it("returns the same colors when the pixels are in BGRA order", () => {
    const image = spottedImage(NAVY, ORANGE, 0.12);
    const swapped = spottedImage(NAVY, ORANGE, 0.12, 64, "bgra");

    expect(extractJacketColors(swapped)).toEqual(extractJacketColors(image));
  });
});
