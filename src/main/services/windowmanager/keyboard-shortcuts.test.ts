import { describe, expect, it } from "vitest";
import { KeyboardShortcut, KeyboardShortcutInput, matchKeyboardShortcut } from "./keyboard-shortcuts";

const NOT_MAC = false;
const MAC = true;

function keyDown(key: string, modifiers: Partial<Omit<KeyboardShortcutInput, "type" | "key">> = {}): KeyboardShortcutInput {
  return { type: "keyDown", key, control: false, meta: false, alt: false, shift: false, ...modifiers };
}

function keyUp(key: string, modifiers: Partial<Omit<KeyboardShortcutInput, "type" | "key">> = {}): KeyboardShortcutInput {
  return { ...keyDown(key, modifiers), type: "keyUp" };
}

describe("matchKeyboardShortcut", () => {
  describe("close window on Windows and Linux", () => {
    it("matches Ctrl+W", () => {
      expect(matchKeyboardShortcut(keyDown("w", { control: true }), NOT_MAC)).toBe(KeyboardShortcut.CloseWindow);
    });

    it("matches Ctrl+W when the key is upper case", () => {
      expect(matchKeyboardShortcut(keyDown("W", { control: true }), NOT_MAC)).toBe(KeyboardShortcut.CloseWindow);
    });

    it("does not match Ctrl+Shift+W", () => {
      expect(matchKeyboardShortcut(keyDown("W", { control: true, shift: true }), NOT_MAC)).toBeNull();
    });

    it("does not match Ctrl+Alt+W", () => {
      expect(matchKeyboardShortcut(keyDown("w", { control: true, alt: true }), NOT_MAC)).toBeNull();
    });

    it("does not match Ctrl+Meta+W", () => {
      expect(matchKeyboardShortcut(keyDown("w", { control: true, meta: true }), NOT_MAC)).toBeNull();
    });

    it("does not match Meta+W", () => {
      expect(matchKeyboardShortcut(keyDown("w", { meta: true }), NOT_MAC)).toBeNull();
    });

    it("does not match W without a modifier", () => {
      expect(matchKeyboardShortcut(keyDown("w"), NOT_MAC)).toBeNull();
    });

    it("does not match Ctrl+W on key up", () => {
      expect(matchKeyboardShortcut(keyUp("w", { control: true }), NOT_MAC)).toBeNull();
    });
  });

  describe("close window on macOS", () => {
    it("matches Cmd+W", () => {
      expect(matchKeyboardShortcut(keyDown("w", { meta: true }), MAC)).toBe(KeyboardShortcut.CloseWindow);
    });

    it("does not match Ctrl+W", () => {
      expect(matchKeyboardShortcut(keyDown("w", { control: true }), MAC)).toBeNull();
    });

    it("does not match Cmd+Ctrl+W", () => {
      expect(matchKeyboardShortcut(keyDown("w", { meta: true, control: true }), MAC)).toBeNull();
    });

    it("does not match Cmd+Shift+W", () => {
      expect(matchKeyboardShortcut(keyDown("W", { meta: true, shift: true }), MAC)).toBeNull();
    });

    it("does not match Cmd+W on key up", () => {
      expect(matchKeyboardShortcut(keyUp("w", { meta: true }), MAC)).toBeNull();
    });
  });

  describe("toggle full screen", () => {
    it.each([NOT_MAC, MAC])("matches F11 on key down (isMac: %s)", isMac => {
      expect(matchKeyboardShortcut(keyDown("F11"), isMac)).toBe(KeyboardShortcut.ToggleFullScreen);
    });

    it.each([
      ["control", { control: true }],
      ["meta", { meta: true }],
      ["alt", { alt: true }],
      ["shift", { shift: true }]
    ])("does not match F11 with %s", (_name, modifiers) => {
      expect(matchKeyboardShortcut(keyDown("F11", modifiers), NOT_MAC)).toBeNull();
    });

    it("does not match F11 on key up", () => {
      expect(matchKeyboardShortcut(keyUp("F11"), NOT_MAC)).toBeNull();
    });
  });

  describe("other keys", () => {
    it.each([
      ["Q with Ctrl", keyDown("q", { control: true })],
      ["F10", keyDown("F10")],
      ["F12", keyDown("F12")],
      ["Enter", keyDown("Enter")]
    ])("does not match %s", (_name, input) => {
      expect(matchKeyboardShortcut(input, NOT_MAC)).toBeNull();
      expect(matchKeyboardShortcut(input, MAC)).toBeNull();
    });
  });
});
