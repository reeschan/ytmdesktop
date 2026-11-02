import {
  BackgroundVideoMessage,
  BackgroundVideoMotion,
  BackgroundVideoPlayback,
  YtmBackgroundReport,
  YtmBackgroundState
} from "~shared/background-video";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
// How many blur radii the canvas extends past each edge of the window
const BLUR_EDGE_BLEED_RATIO = 3;
const MASK_OPACITY_MAX = 100;
// Delay that groups DOM changes before looking for the player video again
const VIDEO_LOOKUP_DELAY_MS = 250;
// How long the video may lack a picture before that is reported (for example while the next song loads)
const UNAVAILABLE_REPORT_DELAY_MS = 2000;
const CANVAS_ID = "ytmd-background-video-canvas";
const MASK_ID = "ytmd-background-video-mask";
// The furthest back z-index, the mask sits right above the canvas
const CANVAS_Z_INDEX = "-2147483647";
const MASK_Z_INDEX = "-2147483646";
const VISIBLE_PLAYBACKS: BackgroundVideoPlayback[] = [BackgroundVideoPlayback.Playing, BackgroundVideoPlayback.Paused];
const PLAYBACKS: unknown[] = Object.values(BackgroundVideoPlayback);
const MOTIONS: unknown[] = Object.values(BackgroundVideoMotion);

// Nothing is shown until the first state arrives
const INITIAL_STATE: YtmBackgroundState = {
  show: false,
  playback: BackgroundVideoPlayback.NotShown,
  motion: BackgroundVideoMotion.Continuous,
  maskOpacity: 0,
  maskBlur: 0,
  maskColor: "transparent"
};

let initialized = false;

function getOrCreateLayer<K extends keyof HTMLElementTagNameMap>(tagName: K, id: string, zIndex: string): HTMLElementTagNameMap[K] {
  const existing = document.getElementById(id);
  if (existing) return existing as HTMLElementTagNameMap[K];

  const element = document.createElement(tagName);
  element.id = id;
  Object.assign(element.style, {
    position: "fixed",
    inset: "0",
    zIndex,
    pointerEvents: "none",
    display: "none"
  });
  document.documentElement.appendChild(element);
  return element;
}

/**
 * Returns whether the value has the shape of a YtmBackgroundState with values in range.
 */
function isBackgroundState(value: unknown): value is YtmBackgroundState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Record<string, unknown>;
  return (
    typeof state.show === "boolean" &&
    PLAYBACKS.includes(state.playback) &&
    MOTIONS.includes(state.motion) &&
    Number.isFinite(state.maskOpacity) &&
    Number.isFinite(state.maskBlur) &&
    typeof state.maskColor === "string"
  );
}

/**
 * Draws the video the YTM player plays onto a canvas covering the whole page behind everything, with a mask above it.
 * What is shown follows the state sent by the preload, and whether the video has a picture is reported back to it.
 */
export function initBackgroundVideo() {
  if (initialized) return;
  initialized = true;

  const canvas = getOrCreateLayer("canvas", CANVAS_ID, CANVAS_Z_INDEX);
  const mask = getOrCreateLayer("div", MASK_ID, MASK_Z_INDEX);
  const canvasContext = canvas.getContext("2d");
  if (!canvasContext) throw new Error("The background video canvas has no 2d context");
  const context: CanvasRenderingContext2D = canvasContext;

  const reducedMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY);

  let state = INITIAL_STATE;
  let video: HTMLVideoElement | null = null;
  let frameRequest: number | null = null;
  // Set when new content has no frame drawn from it yet
  let framePending = false;
  let lastReport: YtmBackgroundReport | null = null;
  let unavailableTimer: ReturnType<typeof setTimeout> | null = null;
  let lookupTimer: ReturnType<typeof setTimeout> | null = null;

  const isVisible = () => state.show && VISIBLE_PLAYBACKS.includes(state.playback);
  const isDrawing = () => isVisible() && state.playback === BackgroundVideoPlayback.Playing;
  // Every frame is drawn only in continuous motion, a still frame is drawn on loading and pause events
  const isDrawingEveryFrame = () => isDrawing() && state.motion === BackgroundVideoMotion.Continuous;

  function drawFrame(element: HTMLVideoElement) {
    if (element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || element.videoWidth === 0 || element.videoHeight === 0) return;

    // Covers the canvas like object-fit: cover
    const scale = Math.max(canvas.width / element.videoWidth, canvas.height / element.videoHeight);
    const width = element.videoWidth * scale;
    const height = element.videoHeight * scale;
    context.drawImage(element, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    framePending = false;
  }

  function onVideoFrame() {
    frameRequest = null;
    if (!video || !isDrawingEveryFrame()) return;

    drawFrame(video);
    requestFrame();
  }

  function requestFrame() {
    if (!video || frameRequest !== null || !isDrawingEveryFrame()) return;
    frameRequest = video.requestVideoFrameCallback(onVideoFrame);
  }

  function cancelFrame() {
    if (video && frameRequest !== null) video.cancelVideoFrameCallback(frameRequest);
    frameRequest = null;
  }

  /**
   * Sizes the canvas to the window, extended past each edge by the blur, at the device pixel ratio.
   * Returns whether the canvas size changed (which clears it).
   */
  function layoutCanvas() {
    const bleed = Math.max(state.maskBlur, 0) * BLUR_EDGE_BLEED_RATIO;
    const cssWidth = window.innerWidth + bleed * 2;
    const cssHeight = window.innerHeight + bleed * 2;
    Object.assign(canvas.style, {
      inset: "auto",
      left: `${-bleed}px`,
      top: `${-bleed}px`,
      width: `${cssWidth}px`,
      height: `${cssHeight}px`
    });

    const pixelWidth = Math.max(1, Math.round(cssWidth * window.devicePixelRatio));
    const pixelHeight = Math.max(1, Math.round(cssHeight * window.devicePixelRatio));
    if (canvas.width === pixelWidth && canvas.height === pixelHeight) return false;

    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    return true;
  }

  function currentReport(): YtmBackgroundReport {
    return {
      available: video !== null && video.videoWidth > 0,
      reducedMotion: reducedMotionQuery.matches
    };
  }

  function postReport(report: YtmBackgroundReport) {
    if (lastReport && lastReport.available === report.available && lastReport.reducedMotion === report.reducedMotion) return;

    lastReport = report;
    window.postMessage({ op: BackgroundVideoMessage.Report, ...report }, "*");
  }

  function clearUnavailableTimer() {
    if (unavailableTimer !== null) clearTimeout(unavailableTimer);
    unavailableTimer = null;
  }

  /**
   * Reports the current state. A picture that appears is reported at once; a picture that goes away is reported
   * only when it has not come back within UNAVAILABLE_REPORT_DELAY_MS, so loading the next song does not flash the background.
   */
  function sendReport() {
    const report = currentReport();
    if (report.available || !lastReport?.available) {
      clearUnavailableTimer();
      postReport(report);
      return;
    }

    // Other changes (for example reduced motion) are still reported at once
    postReport({ ...report, available: true });
    if (unavailableTimer !== null) return;
    unavailableTimer = setTimeout(() => {
      unavailableTimer = null;
      postReport(currentReport());
    }, UNAVAILABLE_REPORT_DELAY_MS);
  }

  function applyState(newState: YtmBackgroundState) {
    const wasVisible = isVisible();
    const wasDrawing = isDrawing();
    const motionChanged = newState.motion !== state.motion;
    state = newState;

    const visible = isVisible();
    const blur = Math.max(state.maskBlur, 0);
    canvas.style.display = visible ? "block" : "none";
    canvas.style.filter = blur > 0 ? `blur(${blur}px)` : "none";
    mask.style.display = visible ? "block" : "none";
    mask.style.backgroundColor = state.maskColor;
    mask.style.opacity = String(Math.min(Math.max(state.maskOpacity, 0), MASK_OPACITY_MAX) / MASK_OPACITY_MAX);

    if (!visible) {
      cancelFrame();
      if (wasVisible) context.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const resized = layoutCanvas();
    if (!isDrawing()) {
      // Paused keeps the last frame, it is drawn again only when resizing cleared it
      cancelFrame();
      if (resized && video) drawFrame(video);
      return;
    }

    if (video && (!wasDrawing || resized || motionChanged)) drawFrame(video);
    if (isDrawingEveryFrame()) requestFrame();
    else cancelFrame();
  }

  function onWindowResized() {
    if (isVisible() && layoutCanvas() && video) drawFrame(video);
  }

  function drawPendingFrame() {
    if (video && framePending && isDrawing()) drawFrame(video);
  }

  function onVideoResized() {
    sendReport();
    // The first frame of new content can only be drawn once its size is known
    drawPendingFrame();
  }

  function onVideoLoadedData() {
    // New content was loaded (for example another song), a frame is drawn from it
    framePending = true;
    sendReport();
    drawPendingFrame();
  }

  function onVideoPaused() {
    if (video && isDrawing()) drawFrame(video);
  }

  const videoListeners: [keyof HTMLMediaElementEventMap, () => void][] = [
    ["loadedmetadata", sendReport],
    ["resize", onVideoResized],
    ["emptied", sendReport],
    ["loadeddata", onVideoLoadedData],
    ["pause", onVideoPaused]
  ];

  function attachVideo(newVideo: HTMLVideoElement | null) {
    if (newVideo === video) return;

    if (video) {
      cancelFrame();
      for (const [type, listener] of videoListeners) video.removeEventListener(type, listener);
    }

    video = newVideo;
    framePending = true;
    if (video) {
      for (const [type, listener] of videoListeners) video.addEventListener(type, listener);
      if (isDrawing()) {
        drawFrame(video);
        requestFrame();
      }
    }
    sendReport();
  }

  // Watches the whole page for the player video, only while no video is attached
  const pageObserver = new MutationObserver(() => {
    if (lookupTimer !== null) return;
    lookupTimer = setTimeout(() => {
      lookupTimer = null;
      findVideo();
    }, VIDEO_LOOKUP_DELAY_MS);
  });

  // Watches the children of each ancestor of the attached video, the video can only leave the page through one of them
  const removalObserver = new MutationObserver(() => {
    if (!video) return;
    if (video.isConnected) {
      // The video may have moved, so the ancestors are watched again
      watchAncestors(video);
      return;
    }

    removalObserver.disconnect();
    attachVideo(null);
    findVideo();
  });

  function watchAncestors(element: HTMLElement) {
    removalObserver.disconnect();
    for (let node = element.parentNode; node; node = node.parentNode) removalObserver.observe(node, { childList: true });
  }

  function findVideo() {
    const found = document.querySelector("video");
    attachVideo(found);
    if (!found) {
      pageObserver.observe(document.documentElement, { childList: true, subtree: true });
      return;
    }

    pageObserver.disconnect();
    if (lookupTimer !== null) clearTimeout(lookupTimer);
    lookupTimer = null;
    watchAncestors(found);
  }

  window.addEventListener("message", event => {
    // Only messages from the preload of this page are accepted (not from embedded frames)
    if (event.source !== window || event.data?.op !== BackgroundVideoMessage.State) return;
    if (!isBackgroundState(event.data.state)) return;
    applyState(event.data.state);
  });
  window.addEventListener("resize", onWindowResized);
  reducedMotionQuery.addEventListener("change", sendReport);

  findVideo();
  // The first report is sent even when there is no video yet
  sendReport();
}
