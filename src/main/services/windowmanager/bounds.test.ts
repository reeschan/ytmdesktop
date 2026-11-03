import { describe, expect, it } from "vitest";
import { ensureBoundsAreVisible, Rectangle } from "./bounds";

const MINIMUM_VISIBLE_SIZE = 64;
const primary: Rectangle = { x: 0, y: 0, width: 1920, height: 1040 };
const secondary: Rectangle = { x: 1920, y: 0, width: 1280, height: 984 };

describe("ensureBoundsAreVisible", () => {
  it("returns the same bounds when they fit inside a work area", () => {
    const bounds = { x: 100, y: 100, width: 1280, height: 720 };
    expect(ensureBoundsAreVisible(bounds, [primary, secondary], primary, MINIMUM_VISIBLE_SIZE)).toBe(bounds);
  });

  it("returns the same bounds when they sit inside the second work area", () => {
    const bounds = { x: 2000, y: 50, width: 800, height: 600 };
    expect(ensureBoundsAreVisible(bounds, [primary, secondary], secondary, MINIMUM_VISIBLE_SIZE)).toBe(bounds);
  });

  it("returns the same bounds when they overlap a work area by the minimum size", () => {
    const bounds = { x: 1920 - 64, y: 100, width: 800, height: 600 };
    expect(ensureBoundsAreVisible(bounds, [primary], primary, MINIMUM_VISIBLE_SIZE)).toBe(bounds);
  });

  it("returns the same bounds for a window smaller than the minimum size that is fully visible", () => {
    const bounds = { x: 10, y: 10, width: 40, height: 30 };
    expect(ensureBoundsAreVisible(bounds, [primary], primary, MINIMUM_VISIBLE_SIZE)).toBe(bounds);
  });

  it("centers bounds that overlap no work area in the fallback work area", () => {
    const bounds = { x: 3500, y: 200, width: 1280, height: 720 };
    expect(ensureBoundsAreVisible(bounds, [primary], primary, MINIMUM_VISIBLE_SIZE)).toEqual({ x: 320, y: 160, width: 1280, height: 720 });
  });

  it("centers bounds in a fallback work area that does not start at the origin", () => {
    const bounds = { x: -3000, y: -2000, width: 640, height: 480 };
    expect(ensureBoundsAreVisible(bounds, [primary, secondary], secondary, MINIMUM_VISIBLE_SIZE)).toEqual({ x: 2240, y: 252, width: 640, height: 480 });
  });

  it("shrinks bounds larger than the fallback work area to its size", () => {
    const bounds = { x: 5000, y: 5000, width: 2560, height: 1440 };
    expect(ensureBoundsAreVisible(bounds, [primary], primary, MINIMUM_VISIBLE_SIZE)).toEqual({ x: 0, y: 0, width: 1920, height: 1040 });
  });

  it("moves bounds that overlap a work area horizontally by fewer pixels than the minimum size", () => {
    const bounds = { x: 1920 - 10, y: 100, width: 800, height: 600 };
    expect(ensureBoundsAreVisible(bounds, [primary], primary, MINIMUM_VISIBLE_SIZE)).toEqual({ x: 560, y: 220, width: 800, height: 600 });
  });

  it("moves bounds that overlap a work area vertically by fewer pixels than the minimum size", () => {
    const bounds = { x: 100, y: -600 + 5, width: 800, height: 600 };
    expect(ensureBoundsAreVisible(bounds, [primary], primary, MINIMUM_VISIBLE_SIZE)).toEqual({ x: 560, y: 220, width: 800, height: 600 });
  });

  it("uses the minimum size passed in", () => {
    const bounds = { x: 1920 - 10, y: 100, width: 800, height: 600 };
    expect(ensureBoundsAreVisible(bounds, [primary], primary, 8)).toBe(bounds);
  });
});
