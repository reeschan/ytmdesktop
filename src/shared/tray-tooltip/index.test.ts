import { describe, expect, it } from "vitest";
import { buildTrayTooltip, TrayTooltipOptions } from "~shared/tray-tooltip";

const IDLE_TEXT = "Idle";
const OPTIONS: TrayTooltipOptions = { idleText: IDLE_TEXT };

describe("buildTrayTooltip", () => {
  it("joins the title and the artist", () => {
    expect(buildTrayTooltip({ title: "Song Title", artist: "Artist Name" }, OPTIONS)).toBe("Song Title - Artist Name");
  });

  it("removes leading and trailing spaces", () => {
    expect(buildTrayTooltip({ title: "  Song Title ", artist: " Artist Name  " }, OPTIONS)).toBe("Song Title - Artist Name");
  });

  it.each([undefined, null, "", "   "])("uses only the title when the artist is %j", artist => {
    expect(buildTrayTooltip({ title: "Song Title", artist }, OPTIONS)).toBe("Song Title");
  });

  it.each([
    { title: undefined, artist: undefined },
    { title: null, artist: null },
    { title: "", artist: "" },
    { title: "   ", artist: "  " },
    { title: " ", artist: "Artist Name" }
  ])("uses the idle text when there is no title (%j)", track => {
    expect(buildTrayTooltip(track, OPTIONS)).toBe(IDLE_TEXT);
  });

  it("cuts text longer than the maximum to exactly the maximum, ending with an ellipsis", () => {
    const tooltip = buildTrayTooltip({ title: "x".repeat(200), artist: "Artist Name" }, { ...OPTIONS, maxLength: 127 });
    expect(tooltip).toHaveLength(127);
    expect(tooltip.endsWith("...")).toBe(true);
    expect(tooltip).toBe("x".repeat(124) + "...");
  });

  it("keeps text of exactly the maximum length", () => {
    const title = "y".repeat(127);
    expect(buildTrayTooltip({ title }, { ...OPTIONS, maxLength: 127 })).toBe(title);
  });

  it("does not cut the text when no maximum is given", () => {
    const title = "z".repeat(500);
    expect(buildTrayTooltip({ title, artist: "Artist Name" }, OPTIONS)).toBe(`${title} - Artist Name`);
  });

  it("does not split a surrogate pair when cutting", () => {
    // A cut after 4 units would fall between the two halves of the second emoji
    const title = "a" + "😀".repeat(10);
    const tooltip = buildTrayTooltip({ title }, { ...OPTIONS, maxLength: 7 });
    expect(tooltip).toBe("a😀...");
    expect(tooltip.length).toBeLessThanOrEqual(7);
  });

  it("returns only part of the ellipsis when the maximum is shorter than the ellipsis", () => {
    expect(buildTrayTooltip({ title: "Song Title" }, { ...OPTIONS, maxLength: 2 })).toBe("..");
  });
});
