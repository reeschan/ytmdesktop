// Grooving: the sidebar entry, the place of the screen over the center of YTM, and the messages between the page and the preload.
// The screen itself is drawn by grooving-view.ts; the calls from main are answered by grooving-ytm.ts and grooving-playback.ts.
// The places in the YTM DOM follow what was checked on the dev build (2026-11-03).

import protectedapimanager from "../protectedapimanager";
import {
  GROOVING_PROTECTED_API,
  GroovingMessageOp,
  GroovingVisibility,
  type GroovingSignal,
  type GroovingViewMessage,
  isGroovingViewMessage
} from "~shared/grooving";
import { createGroovingView, GROOVING_VIEW_CSS } from "./grooving-view";
import { cancelGroovingYtm, setupGroovingYtm } from "./grooving-ytm";
import { endFoldingPlayerPage, foldPlayerPage, isFoldingPlayerPage, setGroovingShown, setupGroovingPlayback } from "./grooving-playback";

const ENTRY_TITLE = "Grooving";
const ENTRY_ICON = "instant_mix";
// Not an icon YTM knows, so YTM draws nothing and the Material Symbols icon goes in its place
const ENTRY_ICON_TYPE = "YTMD_GROOVING";

const ClassName = {
  Host: "ytmd-grooving-host",
  Entry: "ytmd-grooving-entry",
  EntryActive: "ytmd-grooving-entry-active",
  EntryIcon: "ytmd-grooving-entry-icon",
  EntryMark: "ytmd-grooving-entry-mark",
  EntryDot: "ytmd-grooving-entry-dot"
} as const;

// The wide sidebar and the thin one; both always exist, only one is shown
const GUIDES: { selector: string; collapsed: boolean }[] = [
  { selector: "ytmusic-guide-renderer#guide-renderer", collapsed: false },
  { selector: "ytmusic-guide-renderer#mini-guide-renderer", collapsed: true }
];
const CONTENT_SELECTOR = "div#content.ytmusic-app";

// Changes of the page are gathered for this long before the entries and the screen are checked again
const RECONCILE_DELAY_MS = 250;

const STYLE = `
  .${ClassName.Host} {
    position: fixed;
    top: var(--ytmusic-nav-bar-height, 64px);
    left: var(--ytmusic-guide-width, 240px);
    right: 0;
    bottom: var(--ytmusic-player-bar-height, 72px);
    z-index: 1;
  }
  .${ClassName.Host}[hidden] { display: none; }
  .${ClassName.Host} .ytmd-grooving-panel { overscroll-behavior: contain; }

  ytmusic-guide-entry-renderer.${ClassName.Entry}.${ClassName.EntryActive} {
    border-radius: 8px;
    background: color-mix(in srgb, var(--ytmusic-color-white1, #fff) 10%, transparent);
  }
  ytmusic-guide-entry-renderer.${ClassName.Entry} { position: relative; }
  ytmusic-guide-entry-renderer.${ClassName.Entry} yt-icon { position: relative; }
  ytmusic-guide-entry-renderer.${ClassName.Entry} .${ClassName.EntryIcon} {
    display: block;
    width: 24px;
    height: 24px;
    font-size: 24px;
    line-height: 24px;
  }
  ytmusic-guide-entry-renderer.${ClassName.Entry} .${ClassName.EntryMark} {
    position: absolute;
    top: 50%;
    right: 10px;
    max-width: 72px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transform: translateY(-50%);
    color: var(--ytmd-color-text-muted);
    font-size: 11px;
    line-height: 16px;
    pointer-events: none;
  }
  ytmusic-guide-entry-renderer.${ClassName.Entry} .${ClassName.EntryDot} {
    position: absolute;
    top: -2px;
    right: -2px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--ytmd-color-accent);
    box-shadow: 0 0 0 2px var(--ytmusic-background, #030303);
    pointer-events: none;
  }
`;

type GuideEntry = HTMLElement & { data?: unknown };

// The visibility main sent last. A press of the entry while the screen is shown has to fold the player page itself,
// because main ignores `open` for a screen that is already shown
let visibility: GroovingVisibility = GroovingVisibility.Gone;

function send(signal: GroovingSignal) {
  window.postMessage({ op: GroovingMessageOp.Signal, signal }, "*");
}

function createEntry(collapsed: boolean): GuideEntry {
  // cloneNode(true) of another entry comes out empty (Polymer draws from data), so the entry is made from scratch
  const entry: GuideEntry = document.createElement("ytmusic-guide-entry-renderer");
  entry.className = `style-scope ytmusic-guide-section-renderer ${ClassName.Entry}`;
  entry.setAttribute("is-primary", "");
  if (collapsed) entry.setAttribute("is-collapsed", "");
  // An empty navigationEndpoint makes YTM not navigate when the entry is pressed
  entry.data = {
    formattedTitle: { runs: [{ text: ENTRY_TITLE }] },
    icon: { iconType: ENTRY_ICON_TYPE },
    navigationEndpoint: {},
    isPrimary: true
  };
  entry.addEventListener(
    "click",
    () => {
      // While the screen is already shown, main keeps it shown: fold the player page here so the screen comes back in view.
      // The navigation this causes is held back by the flag of grooving-playback.ts (see the listener below)
      if (visibility === GroovingVisibility.Shown) foldPlayerPage();
      send({ type: "open", pageLanguage: readPageLanguage() });
    },
    true
  );
  return entry;
}

// The display language of YTM (ytcfg's HL, read in the main world like grooving-ytm.ts). null when it cannot be read
function readPageLanguage(): string | null {
  try {
    const language = (window as unknown as { ytcfg?: { get?: (key: string) => unknown } }).ytcfg?.get?.("HL");
    return typeof language === "string" && language !== "" ? language : null;
  } catch {
    return null;
  }
}

// YTM may draw the icon again at any time, so this is checked on every reconcile
function applyEntryIcon(entry: HTMLElement) {
  const icon = entry.querySelector("yt-icon");
  if (!icon || icon.querySelector(`.${ClassName.EntryIcon}`)) return;
  const symbol = document.createElement("span");
  symbol.className = `material-symbols-outlined ${ClassName.EntryIcon}`;
  symbol.textContent = ENTRY_ICON;
  symbol.setAttribute("aria-hidden", "true");
  icon.replaceChildren(symbol);
}

// The thin sidebar has room only for a dot on the icon; the wide one shows the word at the right edge
function applyEntryMark(entry: HTMLElement, mark: string | null, collapsed: boolean) {
  const previous = entry.querySelector<HTMLElement>(`.${ClassName.EntryMark}, .${ClassName.EntryDot}`);
  if (mark === null) {
    previous?.remove();
    return;
  }
  if (collapsed) {
    const icon = entry.querySelector("yt-icon") ?? entry;
    let dot = previous?.classList.contains(ClassName.EntryDot) && previous.parentElement === icon ? previous : null;
    if (!dot) {
      previous?.remove();
      dot = document.createElement("span");
      dot.className = ClassName.EntryDot;
      icon.append(dot);
    }
    if (dot.title !== mark) dot.title = mark;
    return;
  }
  let node = previous?.classList.contains(ClassName.EntryMark) ? previous : null;
  if (!node) {
    previous?.remove();
    node = document.createElement("span");
    node.className = ClassName.EntryMark;
    entry.append(node);
  }
  // Writing the same text again replaces the text node, which wakes the observer and comes back here without end
  if (node.textContent !== mark) node.textContent = mark;
}

export function setupGrooving() {
  // Main calls into the page through this one API; it is made once, like RemoteControl and PlayerState
  const api = protectedapimanager.createOrGetAPI(GROOVING_PROTECTED_API);
  setupGroovingYtm(api);
  setupGroovingPlayback(api);

  const style = document.createElement("style");
  style.appendChild(document.createTextNode(GROOVING_VIEW_CSS + STYLE));
  document.head.appendChild(style);

  const view = createGroovingView(send);
  const host = document.createElement("div");
  host.className = ClassName.Host;
  host.hidden = true;
  host.append(view.element);

  let mark: string | null = null;

  function updateEntries() {
    const markToShow = visibility === GroovingVisibility.Hidden ? mark : null;
    for (const entry of document.querySelectorAll<HTMLElement>(`ytmusic-guide-entry-renderer.${ClassName.Entry}`)) {
      entry.classList.toggle(ClassName.EntryActive, visibility === GroovingVisibility.Shown);
      applyEntryMark(entry, markToShow, entry.hasAttribute("is-collapsed"));
    }
  }

  function reconcile() {
    for (const guide of GUIDES) {
      const items = document.querySelector(guide.selector)?.querySelector("ytmusic-guide-section-renderer")?.querySelector("div#items");
      if (!items) continue;
      let entry = items.querySelector<HTMLElement>(`:scope > .${ClassName.Entry}`);
      if (!entry) {
        // The end of the first group, after Library
        entry = createEntry(guide.collapsed);
        items.append(entry);
      }
      applyEntryIcon(entry);
    }

    if (!host.isConnected) document.querySelector(CONTENT_SELECTOR)?.append(host);
    // YTM may draw the sidebar again; the mark is put back from the last state main sent
    updateEntries();
  }

  // Only additions and removals of children are watched, and the work is batched with a timer.
  // reconcile adds nothing that is already there, so its own changes settle after one more pass.
  let reconcileTimer: ReturnType<typeof setTimeout> | null = null;
  const observer = new MutationObserver(() => {
    if (reconcileTimer !== null) return;
    reconcileTimer = setTimeout(() => {
      reconcileTimer = null;
      reconcile();
    }, RECONCILE_DELAY_MS);
  });
  observer.observe(document.querySelector("ytmusic-app-layout") ?? document.body, { childList: true, subtree: true });

  function applyState(state: GroovingViewMessage) {
    const wasGone = visibility === GroovingVisibility.Gone;
    const wasShown = visibility === GroovingVisibility.Shown;
    visibility = state.visibility;
    mark = state.mark;
    // Closing (not hiding) stops the YTM reads in progress on the page (the queue additions of grooving-playback.ts go on)
    if (!wasGone && visibility === GroovingVisibility.Gone) cancelGroovingYtm();
    view.render(state);
    host.hidden = visibility !== GroovingVisibility.Shown;
    // The replacement of the queue folds the player page only while the screen is shown
    setGroovingShown(visibility === GroovingVisibility.Shown);
    // Shown again while the player page is open: fold it, so the screen kept from when it was hidden stays in view.
    // The navigation this causes is held back by the flag of grooving-playback.ts (see the listener below)
    if (!wasShown && visibility === GroovingVisibility.Shown) foldPlayerPage();
    updateEntries();
  }

  // Moving to another page hides Grooving. Previews, queue replacements and the next track in the queue
  // all show up as a navigation to /watch, so those do not hide it.
  // Folding the player page after a queue replacement moves away from /watch as a push; that one is held back
  // so the URL stays and the screen does not read as left.
  navigation.addEventListener("navigate", event => {
    let pathname: string | null = null;
    try {
      pathname = new URL(event.destination.url).pathname;
    } catch {
      pathname = null;
    }
    if (isFoldingPlayerPage()) {
      if (pathname !== null && pathname !== "/watch") {
        event.preventDefault();
        endFoldingPlayerPage();
        return;
      }
    }
    if (visibility !== GroovingVisibility.Shown) return;
    // YTM sometimes writes the same address again; that is not moving to another page
    if (event.navigationType === "replace" && event.destination.url === location.href) return;
    if (pathname !== null && pathname !== "/watch") send({ type: "leave" });
  });

  window.addEventListener("message", event => {
    // Only messages from the preload of this page are accepted (not from embedded frames)
    if (event.source !== window || event.data?.op !== GroovingMessageOp.State) return;
    if (!isGroovingViewMessage(event.data.state)) return;
    applyState(event.data.state);
  });

  reconcile();

  // The preload sends the last state again once the page listens
  window.postMessage({ op: GroovingMessageOp.Ready }, "*");
}
