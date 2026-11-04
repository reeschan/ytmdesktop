// Grooving: the sidebar entry, the place of the screen over the center of YTM, and the messages between the page and the preload.
// The screen itself is drawn by grooving-view.ts; the calls from main are answered by grooving-ytm.ts and grooving-playback.ts.
// The places in the YTM DOM follow what PBI-401 checked on the dev build (docs/pbi/notes/grooving.devcheck.md, sections 3 and 4).

import protectedapimanager from "../protectedapimanager";
import {
  GROOVING_PROTECTED_API,
  GroovingMessageOp,
  GroovingScreen,
  type GroovingSignal,
  type GroovingViewMessage,
  isGroovingViewMessage
} from "~shared/grooving";
import { createGroovingView, GROOVING_VIEW_CSS } from "./grooving-view";
import { cancelGroovingYtm, setupGroovingYtm } from "./grooving-ytm";
import { setupGroovingPlayback } from "./grooving-playback";

const ENTRY_TITLE = "Grooving";
const ENTRY_ICON = "instant_mix";
// Not an icon YTM knows, so YTM draws nothing and the Material Symbols icon goes in its place
const ENTRY_ICON_TYPE = "YTMD_GROOVING";

const ClassName = {
  Host: "ytmd-grooving-host",
  Entry: "ytmd-grooving-entry",
  EntryActive: "ytmd-grooving-entry-active",
  EntryIcon: "ytmd-grooving-entry-icon"
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
  ytmusic-guide-entry-renderer.${ClassName.Entry} .${ClassName.EntryIcon} {
    display: block;
    width: 24px;
    height: 24px;
    font-size: 24px;
    line-height: 24px;
  }
`;

type GuideEntry = HTMLElement & { data?: unknown };

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
  entry.addEventListener("click", () => send({ type: "open", pageLanguage: readPageLanguage() }), true);
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

  let open = false;

  function updateEntries() {
    for (const entry of document.querySelectorAll<HTMLElement>(`ytmusic-guide-entry-renderer.${ClassName.Entry}`)) {
      entry.classList.toggle(ClassName.EntryActive, open);
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
        entry.classList.toggle(ClassName.EntryActive, open);
        items.append(entry);
      }
      applyEntryIcon(entry);
    }

    if (!host.isConnected) document.querySelector(CONTENT_SELECTOR)?.append(host);
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
    const wasOpen = open;
    open = state.screen !== GroovingScreen.Closed;
    // Closing stops the YTM reads in progress on the page (the queue additions of grooving-playback.ts go on)
    if (wasOpen && !open) cancelGroovingYtm();
    view.render(state);
    host.hidden = !open;
    updateEntries();
  }

  // Moving to another page closes Grooving. Previews, queue replacements and the next track in the queue
  // all show up as a navigation to /watch, so those do not close it.
  navigation.addEventListener("navigate", event => {
    if (!open) return;
    // YTM sometimes writes the same address again; that is not moving to another page
    if (event.navigationType === "replace" && event.destination.url === location.href) return;
    let pathname: string;
    try {
      pathname = new URL(event.destination.url).pathname;
    } catch {
      return;
    }
    if (pathname !== "/watch") send({ type: "leave" });
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
