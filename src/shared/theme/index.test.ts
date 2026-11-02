import { describe, expect, it } from "vitest";
import {
  BundledTheme,
  ColorItem,
  COLOR_ITEMS,
  DEFAULT_THEME_COLORS,
  isReadableColor,
  resolveTheme,
  ThemeColors,
  ThemeSourceKind,
  toCssVariables,
  toNativeColor
} from "~shared/theme";

const DEFAULT_COLORS: ThemeColors = {
  background: "#030303",
  surface: "#212121",
  text: "#FFFFFF",
  textMuted: "#AAAAAA",
  accent: "#FF0000",
  border: "#212121"
};

const FILE_COLORS: ThemeColors = {
  background: "#101010",
  surface: "rgb(20 20 20)",
  text: "white",
  textMuted: "hsl(0deg 0% 70% / 80%)",
  accent: "#1e90ffcc",
  border: "oklch(40% 0.02 250)"
};

function fileSource(content: string | null) {
  return { kind: ThemeSourceKind.File, content } as const;
}

function themeFile(colors: Partial<Record<string, string>>): string {
  const names: Record<string, string> = {
    background: "--ytmd-color-background",
    surface: "--ytmd-color-surface",
    text: "--ytmd-color-text",
    textMuted: "--ytmd-color-text-muted",
    accent: "--ytmd-color-accent",
    border: "--ytmd-color-border"
  };
  const declarations = Object.entries(colors).map(([item, value]) => `  ${names[item]}: ${value};`);
  return `:root {\n${declarations.join("\n")}\n}\n`;
}

describe("resolveTheme", () => {
  it.each([
    [BundledTheme.Default, DEFAULT_COLORS],
    [
      BundledTheme.Midnight,
      { background: "#0B1020", surface: "#161D33", text: "#E6E9F2", textMuted: "#9AA3BD", accent: "#7AA2F7", border: "#263052" }
    ],
    [
      BundledTheme.Forest,
      { background: "#0C1410", surface: "#16231C", text: "#E4EEE8", textMuted: "#93A89B", accent: "#4ADE80", border: "#22352B" }
    ]
  ])("returns the colors of the bundled theme %s", (theme, colors) => {
    expect(resolveTheme({ kind: ThemeSourceKind.Bundled, theme })).toEqual({ colors, unreadableItems: [], fileMissing: false });
  });

  it("returns every value of a theme file that declares all items", () => {
    expect(resolveTheme(fileSource(themeFile(FILE_COLORS)))).toEqual({ colors: FILE_COLORS, unreadableItems: [], fileMissing: false });
  });

  it("uses Default for items missing from the file and reports them in COLOR_ITEMS order", () => {
    const content = themeFile({ border: "#333333", background: "#101010", text: "white" });

    expect(resolveTheme(fileSource(content))).toEqual({
      colors: { ...DEFAULT_COLORS, background: "#101010", text: "white", border: "#333333" },
      unreadableItems: [ColorItem.Surface, ColorItem.TextMuted, ColorItem.Accent],
      fileMissing: false
    });
  });

  it.each(["banana", "#12", "rgb(", "rgb(1 2 3) red", ""])("uses Default for an item whose value %j is not a color", value => {
    const content = themeFile({ ...FILE_COLORS, accent: value });

    expect(resolveTheme(fileSource(content))).toEqual({
      colors: { ...FILE_COLORS, accent: DEFAULT_COLORS.accent },
      unreadableItems: [ColorItem.Accent],
      fileMissing: false
    });
  });

  it("uses Default for several unreadable items at once", () => {
    const content = themeFile({ ...FILE_COLORS, background: "banana", text: "#12", border: "rgb(" });

    expect(resolveTheme(fileSource(content))).toEqual({
      colors: { ...FILE_COLORS, background: DEFAULT_COLORS.background, text: DEFAULT_COLORS.text, border: DEFAULT_COLORS.border },
      unreadableItems: [ColorItem.Background, ColorItem.Text, ColorItem.Border],
      fileMissing: false
    });
  });

  it("never lets text after a declaration end into a color value", () => {
    const content = themeFile({ ...FILE_COLORS, accent: "red; } body { color: blue" });
    const resolved = resolveTheme(fileSource(content));

    expect(resolved.colors.accent).toBe("red");
    expect(toCssVariables(resolved.colors, ":root")).not.toMatch(/body/);
  });

  it("returns Default for every item and reports all of them for an empty file", () => {
    expect(resolveTheme(fileSource(""))).toEqual({ colors: DEFAULT_COLORS, unreadableItems: [...COLOR_ITEMS], fileMissing: false });
  });

  it("returns Default for every item and reports the file as missing when there is no content", () => {
    expect(resolveTheme(fileSource(null))).toEqual({ colors: DEFAULT_COLORS, unreadableItems: [], fileMissing: true });
  });

  it("reads declarations in any selector, ignores comments, keeps the last one and drops !important", () => {
    const content = [
      "/* --ytmd-color-surface: #999999; */",
      ".theme {",
      "  --ytmd-color-background: #111111;",
      "  --ytmd-color-surface: #222222 !important;",
      "  --ytmd-color-text: #333333;",
      "  --ytmd-color-text-muted: #444444;",
      "  --ytmd-color-accent: #555555;",
      "  --ytmd-color-border: #666666",
      "}",
      ":root { --ytmd-color-background: #777777; }"
    ].join("\n");

    expect(resolveTheme(fileSource(content)).colors).toEqual({
      background: "#777777",
      surface: "#222222",
      text: "#333333",
      textMuted: "#444444",
      accent: "#555555",
      border: "#666666"
    });
  });
});

describe("isReadableColor", () => {
  it.each(["#abc", "#abcd", "#AABBCC", "#aabbccdd", "rgb(0, 0, 0)", "rgba(0 0 0 / 50%)", "hwb(120deg 10% 20%)", "lab(50% 40 30)", "oklch(none 0.1 200)", "RebeccaPurple", "transparent"])(
    "accepts %j",
    value => {
      expect(isReadableColor(value)).toBe(true);
    }
  );

  it.each(["lab(50% -20 30)", "oklab(0.5 -0.1 0.1)", "oklch(0.7 0.1 -30deg)", "rgb(+10 20 30)"])("accepts the negative or signed value %j", value => {
    expect(isReadableColor(value)).toBe(true);
  });

  it.each(["banana", "#12", "#12345", "rgb(", "rgb(0 0 0", "url(x)", "rgb(var(--x))", "red; } body {", "red}", "{red", "rgb()", "rgb(255 0)", "rgb(255, 0)", "hsl(deg)", "rgb(1,,,)", "rgb(1 2 3 4)", "rgb(1, 2 3)"])("rejects %j", value => {
    expect(isReadableColor(value)).toBe(false);
  });
});

const FALLBACK = "#123456";
const HEX_CHANNEL_TOLERANCE = 2;

function hexChannels(hex: string): number[] {
  return (hex.slice(1).match(/../g) ?? []).map(channel => parseInt(channel, 16));
}

describe("toNativeColor", () => {
  it.each([
    ["oklch(0.628 0.2577 29.23)", "#FF0000"],
    ["oklch(62.8% 0.2577 29.23deg)", "#FF0000"],
    ["oklch(1 0 0)", "#FFFFFF"],
    ["oklch(0 0 0)", "#000000"],
    ["oklch(none none none)", "#000000"],
    ["oklch(0.8664 0.2948 142.5)", "#00FF00"],
    ["oklch(0.452 0.3132 264.05)", "#0000FF"],
    ["oklab(0.628 0.2249 0.1258)", "#FF0000"],
    ["oklab(100% 0 0)", "#FFFFFF"],
    ["oklab(0 0 0)", "#000000"],
    ["oklch(0.628 0.2577 29.23 / 50%)", "#FF000080"],
    ["oklab(1 0 0 / 0.5)", "#FFFFFF80"]
  ])("converts %j to about %s", (value, expected) => {
    const converted = toNativeColor(value, FALLBACK);

    expect(converted).toMatch(expected.length === 9 ? /^#[0-9A-F]{8}$/ : /^#[0-9A-F]{6}$/);
    const actualChannels = hexChannels(converted);
    hexChannels(expected).forEach((channel, index) => {
      expect(Math.abs(actualChannels[index] - channel)).toBeLessThanOrEqual(HEX_CHANNEL_TOLERANCE);
    });
  });

  it("clamps channels outside the sRGB gamut", () => {
    expect(toNativeColor("oklch(0.7 0.4 150)", FALLBACK)).toMatch(/^#[0-9A-F]{6}$/);
    expect(toNativeColor("oklab(2 0 0)", FALLBACK)).toBe("#FFFFFF");
  });

  it.each(["#abc", "#AABBCCDD", "rgb(0, 0, 0)", "rgba(10 20 30 / 50%)", "hsl(0deg 0% 70%)", "hsla(0, 0%, 70%, 0.5)", "RebeccaPurple", "transparent"])(
    "returns %j as it is",
    value => {
      expect(toNativeColor(value, FALLBACK)).toBe(value);
    }
  );

  it.each(["lab(50% 40 30)", "lch(50% 40 30)", "hwb(120deg 10% 20%)", "banana", "", "oklch(0.5 0.1)", "oklch(0.5 0.1 20%)", "oklab(0.5 0.1 0.1 / 1 / 1)"])(
    "returns the fallback for %j",
    value => {
      expect(toNativeColor(value, FALLBACK)).toBe(FALLBACK);
    }
  );
});

describe("toCssVariables", () => {
  it("declares the six color items under the selector", () => {
    expect(toCssVariables(DEFAULT_THEME_COLORS, ":root")).toBe(
      ":root { --ytmd-color-background: #030303; --ytmd-color-surface: #212121; --ytmd-color-text: #FFFFFF; --ytmd-color-text-muted: #AAAAAA; --ytmd-color-accent: #FF0000; --ytmd-color-border: #212121; }"
    );
  });
});
