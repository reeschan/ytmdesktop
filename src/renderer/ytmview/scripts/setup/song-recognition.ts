import { SongRecognitionMessageOp, SongRecognitionPhase, SongRecognitionViewState } from "~shared/song-recognition";

const BUTTON_TITLE = "Search with Shazam";
const BUTTON_ICON = "graphic_eq";

const ClassName = {
  Container: "ytmd-song-recognition",
  Icon: "ytmd-song-recognition-icon",
  Message: "ytmd-song-recognition-message",
  Hidden: "ytmd-song-recognition-hidden",
  Recording: "ytmd-song-recognition-recording",
  Searching: "ytmd-song-recognition-searching"
} as const;

const CLOSED_SEARCH_BOX_WIDTH = "--ytmd-song-recognition-closed-search-box-width";

const PHASE_CLASS_NAMES: Record<SongRecognitionPhase, string | null> = {
  [SongRecognitionPhase.Idle]: null,
  [SongRecognitionPhase.Recording]: ClassName.Recording,
  [SongRecognitionPhase.Searching]: ClassName.Searching,
  [SongRecognitionPhase.Message]: null
};

const STYLE = `
  .${ClassName.Container} {
    position: relative;
    display: inline-flex;
    align-items: center;
    margin-left: 18px;
  }

  /* YTM takes the opened search box out of the flow, so the icon keeps the closed box's width in front of it */
  ytmusic-search-box[opened] + .${ClassName.Container} {
    margin-left: calc(var(${CLOSED_SEARCH_BOX_WIDTH}, 0px) + 18px);
  }

  .${ClassName.Container}.${ClassName.Hidden} {
    display: none;
  }

  .${ClassName.Icon} {
    cursor: pointer;
    font-size: 24px;
    color: var(--ytmusic-color-white1, #FFFFFF);
    opacity: 0.5;
  }

  .${ClassName.Icon}:hover,
  .${ClassName.Icon}.${ClassName.Recording},
  .${ClassName.Icon}.${ClassName.Searching} {
    opacity: 1;
  }

  .${ClassName.Icon}.${ClassName.Recording} {
    animation: ytmd-song-recognition-blink 1s ease-in-out infinite;
  }

  .${ClassName.Icon}.${ClassName.Searching} {
    animation: ytmd-song-recognition-spin 1s linear infinite;
  }

  .${ClassName.Message} {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-top: 4px;
    padding: 4px 8px;
    border-radius: 4px;
    white-space: nowrap;
    font-size: 12px;
    color: var(--ytmusic-color-white1, #FFFFFF);
    background: var(--ytmusic-brand-background-solid, #212121);
    z-index: 10;
  }

  .${ClassName.Message}.${ClassName.Hidden} {
    display: none;
  }

  @keyframes ytmd-song-recognition-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.2; }
  }

  @keyframes ytmd-song-recognition-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    .${ClassName.Icon}.${ClassName.Recording},
    .${ClassName.Icon}.${ClassName.Searching} {
      animation: none;
    }
  }
`;

const phases = new Set<string>(Object.values(SongRecognitionPhase));

function isViewState(value: unknown): value is SongRecognitionViewState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Record<string, unknown>;
  return (
    typeof state.visible === "boolean" &&
    typeof state.phase === "string" &&
    phases.has(state.phase) &&
    (state.message === null || typeof state.message === "string")
  );
}

export function createSongRecognitionButton() {
  const searchBox = document.querySelector("ytmusic-search-box");
  // Older YTM layouts have no search box
  if (!searchBox) return;

  const style = document.createElement("style");
  style.appendChild(document.createTextNode(STYLE));
  document.head.appendChild(style);

  const container = document.createElement("span");
  container.classList.add(ClassName.Container, ClassName.Hidden);

  const icon = document.createElement("span");
  icon.classList.add("material-symbols-outlined", ClassName.Icon);
  icon.innerText = BUTTON_ICON;
  icon.title = BUTTON_TITLE;
  icon.setAttribute("role", "button");
  icon.setAttribute("aria-label", BUTTON_TITLE);
  icon.tabIndex = 0;

  const message = document.createElement("span");
  message.classList.add(ClassName.Message, ClassName.Hidden);
  message.setAttribute("role", "status");

  container.append(icon, message);
  searchBox.after(container);

  // Only the closed width is kept; the opened box is wider and placed elsewhere
  new ResizeObserver(() => {
    if (searchBox.hasAttribute("opened")) return;
    container.style.setProperty(CLOSED_SEARCH_BOX_WIDTH, `${searchBox.getBoundingClientRect().width}px`);
  }).observe(searchBox);

  function press() {
    window.postMessage({ op: SongRecognitionMessageOp.Press }, "*");
  }

  icon.addEventListener("click", press);
  icon.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    // Holding the key repeats keydown; one hold must press only once.
    if (event.repeat) return;
    press();
  });

  function applyState(state: SongRecognitionViewState) {
    container.classList.toggle(ClassName.Hidden, !state.visible);

    for (const className of Object.values(PHASE_CLASS_NAMES)) {
      if (className) icon.classList.remove(className);
    }
    const phaseClassName = PHASE_CLASS_NAMES[state.phase];
    if (phaseClassName) icon.classList.add(phaseClassName);

    message.textContent = state.message ?? "";
    message.classList.toggle(ClassName.Hidden, !state.message);
  }

  function search(query: string) {
    const input = searchBox?.querySelector("input");
    if (input) {
      input.value = query;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }

    document.dispatchEvent(new CustomEvent("yt-navigate", { detail: { endpoint: { searchEndpoint: { query } } } }));
  }

  window.addEventListener("message", event => {
    // Only messages from the preload of this page are accepted (not from embedded frames)
    if (event.source !== window) return;

    if (event.data?.op === SongRecognitionMessageOp.State) {
      if (isViewState(event.data.state)) applyState(event.data.state);
    } else if (event.data?.op === SongRecognitionMessageOp.Search) {
      if (typeof event.data.query === "string" && event.data.query) search(event.data.query);
    }
  });

  // The preload sends the last state again once the page listens
  window.postMessage({ op: SongRecognitionMessageOp.Listening }, "*");
}
