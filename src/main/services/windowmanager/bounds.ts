export type Rectangle = {
  x: number;
  y: number;
  width: number;
  height: number;
};

// Returns true when the rectangle overlaps the area by at least the given size on both axes.
// The required overlap is capped at the rectangle's own width/height so small rectangles can still pass.
const overlapsEnough = (bounds: Rectangle, area: Rectangle, minimumVisibleSize: number): boolean => {
  const visibleWidth = Math.min(bounds.x + bounds.width, area.x + area.width) - Math.max(bounds.x, area.x);
  const visibleHeight = Math.min(bounds.y + bounds.height, area.y + area.height) - Math.max(bounds.y, area.y);
  return visibleWidth >= Math.min(minimumVisibleSize, bounds.width) && visibleHeight >= Math.min(minimumVisibleSize, bounds.height);
};

/**
 * Keeps the bounds when they overlap any of the work areas by at least `minimumVisibleSize` on both axes.
 * Otherwise returns bounds centered in `fallbackWorkArea`, shrunk so they fit inside it.
 *
 * @param bounds The bounds to check (for example bounds restored from a previous session)
 * @param workAreas The work areas the bounds may be shown in
 * @param fallbackWorkArea The work area to center the bounds in when they are not visible enough (for example the closest display)
 * @param minimumVisibleSize The overlap in pixels on each axis that counts as visible
 */
export const ensureBoundsAreVisible = (
  bounds: Rectangle,
  workAreas: readonly Rectangle[],
  fallbackWorkArea: Rectangle,
  minimumVisibleSize: number
): Rectangle => {
  if (workAreas.some(workArea => overlapsEnough(bounds, workArea, minimumVisibleSize))) {
    return bounds;
  }

  const width = Math.min(bounds.width, fallbackWorkArea.width);
  const height = Math.min(bounds.height, fallbackWorkArea.height);
  return {
    x: Math.round(fallbackWorkArea.x + (fallbackWorkArea.width - width) / 2),
    y: Math.round(fallbackWorkArea.y + (fallbackWorkArea.height - height) / 2),
    width,
    height
  };
};
