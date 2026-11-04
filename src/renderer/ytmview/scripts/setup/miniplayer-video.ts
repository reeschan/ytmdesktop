import { MiniplayerVideoMessage } from "~shared/miniplayer-video";

const HOST_ID = "ytmd-miniplayer-video-host";
// The video of the player, the same one the background video draws from
const PLAYER_VIDEO_SELECTOR = "#movie_player video";
// The furthest front z-index, so the host covers the whole page
const HOST_Z_INDEX = "2147483647";
const HOST_STYLE: Record<string, string> = {
  position: "fixed",
  inset: "0",
  "z-index": HOST_Z_INDEX,
  background: "black",
  display: "flex",
  "align-items": "center",
  "justify-content": "center"
};
// Makes the video fill the host, overriding the sizes and offsets set by the player
const VIDEO_STYLE: Record<string, string> = {
  position: "relative",
  top: "0",
  left: "0",
  right: "auto",
  bottom: "auto",
  transform: "none",
  margin: "0",
  width: "100%",
  height: "100%",
  "max-width": "none",
  "max-height": "none",
  "object-fit": "contain",
  background: "black"
};
// How often the player video is looked up again while it is moved (the player may replace it)
const VIDEO_LOOKUP_INTERVAL_MS = 1000;
// How long after a move a paused video is played again, when it was playing before the move
const RESUME_AFTER_MOVE_MS = 1500;
const VISIBLE_STATE: DocumentVisibilityState = "visible";
const VISIBILITY_PROPERTIES = ["hidden", "visibilityState"] as const;

type MovedVideo = {
  video: HTMLVideoElement;
  // Marks the place the video was taken from
  marker: Comment;
  parent: Node;
  style: string | null;
  wasPlaying: boolean;
  movedAt: number;
};

let initialized = false;
let host: HTMLDivElement | null = null;
let moved: MovedVideo | null = null;
let lookupTimer: ReturnType<typeof setInterval> | null = null;
let savedVisibility: Map<string, PropertyDescriptor> | null = null;

function findPlayerVideo(): HTMLVideoElement | null {
  return document.querySelector<HTMLVideoElement>(PLAYER_VIDEO_SELECTOR);
}

function playAgain(video: HTMLVideoElement) {
  void video.play().catch(() => undefined);
}

/**
 * Makes the document report itself as visible, the player stops drawing frames while the document is hidden
 */
function overrideVisibility() {
  if (savedVisibility) return;

  const saved = new Map<string, PropertyDescriptor>();
  for (const property of VISIBILITY_PROPERTIES) {
    const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, property);
    if (!descriptor?.configurable) return;
    saved.set(property, descriptor);
  }
  Object.defineProperty(Document.prototype, "hidden", { configurable: true, get: () => false });
  Object.defineProperty(Document.prototype, "visibilityState", { configurable: true, get: () => VISIBLE_STATE });
  savedVisibility = saved;
  document.dispatchEvent(new Event("visibilitychange"));
}

function restoreVisibility() {
  if (!savedVisibility) return;

  for (const [property, descriptor] of savedVisibility) Object.defineProperty(Document.prototype, property, descriptor);
  savedVisibility = null;
  document.dispatchEvent(new Event("visibilitychange"));
}

function createHost(): HTMLDivElement {
  const element = document.createElement("div");
  element.id = HOST_ID;
  for (const [property, value] of Object.entries(HOST_STYLE)) element.style.setProperty(property, value, "important");
  document.documentElement.appendChild(element);
  return element;
}

function moveIntoHost(video: HTMLVideoElement, target: HTMLDivElement) {
  const parent = video.parentNode;
  if (!parent) return;

  const wasPlaying = !video.paused && !video.ended;
  const marker = document.createComment(HOST_ID);
  const style = video.getAttribute("style");
  // Taken out and put in within the same task, so the video stays connected for anything watching it
  parent.insertBefore(marker, video);
  target.appendChild(video);
  for (const [property, value] of Object.entries(VIDEO_STYLE)) video.style.setProperty(property, value, "important");
  moved = { video, marker, parent, style, wasPlaying, movedAt: Date.now() };
  if (wasPlaying && video.paused) playAgain(video);
}

function putBack(item: MovedVideo) {
  const { video, marker, parent, style } = item;
  if (style === null) video.removeAttribute("style");
  else video.setAttribute("style", style);

  if (marker.isConnected) marker.replaceWith(video);
  else if (parent.isConnected) parent.appendChild(video);
  // The place it came from is gone, so it is no longer used by the player
  else video.remove();
  marker.remove();
}

/**
 * Moves the player video into the host, or moves the new one when the player replaced it.
 * Leaves things as they are when the player has no video (for example while the moved one is in the host).
 */
function refresh() {
  if (!host) return;

  const video = findPlayerVideo();
  if (video && video !== moved?.video) {
    if (moved) putBack(moved);
    moved = null;
    moveIntoHost(video, host);
  }

  if (moved?.wasPlaying && moved.video.paused && Date.now() - moved.movedAt <= RESUME_AFTER_MOVE_MS) playAgain(moved.video);
}

/**
 * Shows only the player video over the whole page, and keeps the document visible while it is shown
 */
function mount() {
  if (!host) host = createHost();
  overrideVisibility();
  refresh();
  if (lookupTimer === null) lookupTimer = setInterval(refresh, VIDEO_LOOKUP_INTERVAL_MS);
}

/**
 * Puts the video back where it was with its style, and restores the visibility of the document
 */
function release() {
  if (lookupTimer !== null) clearInterval(lookupTimer);
  lookupTimer = null;
  if (moved) putBack(moved);
  moved = null;
  host?.remove();
  host = null;
  restoreVisibility();
}

export function initMiniplayerVideo() {
  if (initialized) return;
  initialized = true;

  window.addEventListener("message", event => {
    // Only messages from the preload of this page are accepted (not from embedded frames)
    if (event.source !== window) return;
    if (event.data?.op === MiniplayerVideoMessage.Mount) mount();
    else if (event.data?.op === MiniplayerVideoMessage.Release) release();
  });
  window.addEventListener("pagehide", release);
}
