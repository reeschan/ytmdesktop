import { EqualizerMessageOp, isEqualizerViewMessage, type EqualizerSignal } from "~shared/equalizer/messages";
import { getEqualizerAudio } from "./equalizer-audio";
import { createEqualizerView } from "./equalizer-view";
import { EQUALIZER_TEXT, equalizerLanguage } from "./equalizer-text";

const RECONCILE_DELAY_MS = 250;
const STYLE = `
  .ytmd-eq-panel { position: fixed; right: 16px; bottom: var(--ytmusic-player-bar-height, 72px); z-index: 1000; width: min(480px, calc(100vw - 32px)); max-height: min(80vh, 720px); overflow: auto; box-sizing: border-box; padding: 16px; border: 1px solid var(--ytmd-color-border); border-radius: 12px; background: var(--ytmd-color-surface); color: var(--ytmd-color-text); backdrop-filter: blur(var(--ytmd-surface-blur)); font-size: 13px; }
  .ytmd-eq-panel[hidden] { display: none; }
  .ytmd-eq-panel h2, .ytmd-eq-panel h3 { margin: 0 0 8px; }
  .ytmd-eq-panel button, .ytmd-eq-panel input, .ytmd-eq-panel select, .ytmd-eq-panel textarea { color: var(--ytmd-color-text); background: var(--ytmd-color-background); border: 1px solid var(--ytmd-color-border); border-radius: 4px; margin: 3px; }
  .ytmd-eq-panel input[type=range], .ytmd-eq-panel input[type=checkbox] { accent-color: var(--ytmd-color-accent); }
  .ytmd-eq-row { display: flex; align-items: center; justify-content: space-between; }
  .ytmd-eq-section { margin: 12px 0; }
  .ytmd-eq-panel canvas { display: block; width: 100%; height: 80px; }
  .ytmd-eq-bands { display: flex; justify-content: space-between; gap: 2px; }
  .ytmd-eq-bands label { display: flex; align-items: center; flex-direction: column; font-size: 10px; min-width: 0; }
  .ytmd-eq-bands input { writing-mode: vertical-lr; direction: rtl; height: 110px; width: 18px; }
  .ytmd-eq-panel textarea { display: block; width: 95%; resize: vertical; }
`;

export function setupEqualizer() {
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.append(style);
  const send = (signal: EqualizerSignal) => window.postMessage({ op: EqualizerMessageOp.Signal, signal }, "*");
  const view = createEqualizerView(send);
  view.element.hidden = true;
  document.body.append(view.element);
  const button = document.createElement("yt-icon-button");
  button.classList.add("ytmusic-player-bar", "ytmd-player-bar-control", "ytmd-equalizer-button");
  button.setAttribute("title", EQUALIZER_TEXT[equalizerLanguage()].title);
  button.setAttribute("aria-label", EQUALIZER_TEXT[equalizerLanguage()].title);
  button.setAttribute("aria-expanded", "false");
  const icon = document.createElement("yt-icon") as HTMLElement & { set: (key: string, value: string) => void };
  icon.set("icon", "TUNE");
  button.append(icon);
  function close() {
    view.element.hidden = true;
    button.setAttribute("aria-expanded", "false");
  }
  button.addEventListener("click", () => {
    const rect = button.getBoundingClientRect();
    view.element.style.right = `${Math.max(16, window.innerWidth - rect.right)}px`;
    view.element.style.bottom = `${window.innerHeight - rect.top + 8}px`;
    view.element.hidden = !view.element.hidden;
    button.setAttribute("aria-expanded", String(!view.element.hidden));
  });
  document.addEventListener("pointerdown", event => {
    if (!view.element.hidden && event.target instanceof Node && !view.element.contains(event.target) && !button.contains(event.target)) close();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !view.element.hidden) {
      close();
      button.focus();
    }
  });
  function reconcile() {
    const controls = document.querySelector(".right-controls-buttons");
    if (controls && button.parentElement !== controls) controls.append(button);
    if (!view.element.isConnected) document.body.append(view.element);
  }
  let timer: ReturnType<typeof setTimeout> | null = null;
  const observer = new MutationObserver(() => {
    if (timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      reconcile();
    }, RECONCILE_DELAY_MS);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("message", event => {
    if (event.source !== window || !isEqualizerViewMessage(event.data)) return;
    getEqualizerAudio().apply(event.data.state.enabled, event.data.state.values);
    view.render(event.data.state);
  });
  reconcile();
  window.postMessage({ op: EqualizerMessageOp.Ready }, "*");
}
