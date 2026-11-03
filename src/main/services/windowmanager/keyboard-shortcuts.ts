/**
 * The kinds of keyboard shortcut that work inside a window
 */
export const KeyboardShortcut = {
  CloseWindow: "closeWindow",
  ToggleFullScreen: "toggleFullScreen",
} as const;
export type KeyboardShortcut =
  (typeof KeyboardShortcut)[keyof typeof KeyboardShortcut];

/**
 * Which keyboard shortcuts are enabled, keyed by kind
 */
export type KeyboardShortcutSelection = {
  [K in KeyboardShortcut]?: boolean;
};

/**
 * A keyboard input event (for example the input of Electron's `before-input-event`)
 */
export type KeyboardShortcutInput = {
  type: string;
  key: string;
  control: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
};

const KEY_DOWN = "keyDown";
const CLOSE_WINDOW_KEY = "w";
const TOGGLE_FULL_SCREEN_KEY = "F11";

function isCloseWindow(input: KeyboardShortcutInput, isMac: boolean) {
  if (input.key.toLowerCase() !== CLOSE_WINDOW_KEY) return false;
  if (input.alt || input.shift) return false;
  if (isMac) return input.meta && !input.control;
  return input.control && !input.meta;
}

function isToggleFullScreen(input: KeyboardShortcutInput) {
  if (input.key !== TOGGLE_FULL_SCREEN_KEY) return false;
  return !input.control && !input.meta && !input.alt && !input.shift;
}

/**
 * Returns the keyboard shortcut a key input matches, or null when it matches none
 *
 * Only key down inputs match.
 *
 * @param isMac Whether the platform uses the Command key (meta) in place of Control
 */
export function matchKeyboardShortcut(
  input: KeyboardShortcutInput,
  isMac: boolean,
): KeyboardShortcut | null {
  if (input.type !== KEY_DOWN) return null;
  if (isCloseWindow(input, isMac)) return KeyboardShortcut.CloseWindow;
  if (isToggleFullScreen(input)) return KeyboardShortcut.ToggleFullScreen;
  return null;
}
