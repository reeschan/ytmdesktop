// Draws the Grooving screen inside the YTM view from the state main sends, and turns what the user does into signals.
// Strings that came from outside go in through textContent only; colors come only from the theme's CSS variables.

import {
  GROOVING_BLEND_GENRE_LIMIT,
  GROOVING_LLM_TIMEOUT_MS,
  GROOVING_PREVIEW_SECONDS,
  GROOVING_PROVIDER_LABELS,
  GROOVING_ROUND_OPTIONS,
  GroovingAnswer,
  GroovingCandidate,
  GroovingConsentChoice,
  GroovingContinuationPhase,
  GroovingDirection,
  GroovingFailureReason,
  GroovingLanguage,
  GroovingMessageOp,
  GroovingMood,
  GroovingMoodItem,
  GroovingMoodSection,
  GroovingRounds,
  GroovingSaveStatus,
  GroovingSaveAction,
  GroovingScreen,
  GroovingSignal,
  GroovingStep,
  GroovingTrackKind,
  GroovingViewMessage,
  GroovingViewState,
  GroovingVisibility
} from "~shared/grooving";
import { GROOVING_PRICES_AS_OF } from "~shared/grooving/usage";
import { GROOVING_TEXT, GroovingText } from "./grooving-text";

type ViewOf<S extends GroovingScreen> = Extract<GroovingViewState, { screen: S }>;

const ROOT_CLASS = "ytmd-grooving";
const PANEL_CLASS = "ytmd-grooving-panel";
const ICON_CLASS = "material-symbols-outlined";

// Chips past this many in one section hide behind "+N more"
const CHIP_LIMIT = 14;
const PREVIEW_CLOCK_INTERVAL_MS = 250;

const DIRECTION_ORDER: GroovingDirection[] = [GroovingDirection.Familiar, GroovingDirection.Discover, GroovingDirection.Mix];
const MOOD_SECTION_ORDER: GroovingMoodSection[] = [GroovingMoodSection.Moods, GroovingMoodSection.Genres];
const DEFAULT_ROUNDS: GroovingRounds = 5;

// The text of each failure is in GROOVING_TEXT (failures)
const FAILURES: Record<GroovingFailureReason, { icon: string; settings: boolean }> = {
  [GroovingFailureReason.InvalidKey]: { icon: "key_off", settings: true },
  [GroovingFailureReason.ModelNotFound]: { icon: "search_off", settings: true },
  [GroovingFailureReason.RateLimited]: { icon: "hourglass_top", settings: false },
  [GroovingFailureReason.Rejected]: { icon: "block", settings: false },
  [GroovingFailureReason.Network]: { icon: "wifi_off", settings: false },
  [GroovingFailureReason.Unusable]: { icon: "error", settings: false },
  [GroovingFailureReason.YtmUnreadable]: { icon: "cloud_off", settings: false },
  [GroovingFailureReason.NotEnough]: { icon: "queue_music", settings: false }
};

// Stand-ins for album art that has no thumbnail (all mixed from the theme's colors)
const ART_GRADIENTS = 5;

// The thin stripe at the start of each chip, cycled per section
const CHIP_STRIPES = [
  "color-mix(in oklab, var(--ytmd-color-accent) 50%, var(--ytmd-color-text))",
  "var(--ytmd-color-text-muted)",
  "color-mix(in oklab, var(--ytmd-color-accent) 70%, var(--ytmd-color-background))",
  "var(--ytmd-color-accent)",
  "var(--ytmd-color-text)",
  "color-mix(in oklab, var(--ytmd-color-accent) 35%, var(--ytmd-color-text-muted))"
];

export const GROOVING_VIEW_CSS = `
  .ytmd-grooving {
    box-sizing: border-box;
    height: 100%;
    padding: 24px 32px 0;
    color: var(--ytmd-color-text);
    font-family: Roboto, "Noto Sans JP", Arial, sans-serif;
    font-size: 14px;
    line-height: 1.4;
    word-break: auto-phrase;
    background: color-mix(in oklab, var(--ytmd-color-background) 70%, transparent);
    backdrop-filter: blur(max(var(--ytmd-surface-blur, 0px), 24px));
    -webkit-backdrop-filter: blur(max(var(--ytmd-surface-blur, 0px), 24px));
  }
  .ytmd-grooving[hidden] { display: none; }
  .ytmd-grooving *, .ytmd-grooving *::before, .ytmd-grooving *::after { box-sizing: border-box; }
  .ytmd-grooving .material-symbols-outlined { font-size: 24px; line-height: 1; font-weight: 400; }
  .ytmd-grooving button {
    font: inherit; color: inherit; background: transparent; border: 0; margin: 0; padding: 0; cursor: pointer; text-align: inherit;
  }
  .ytmd-grooving button[aria-disabled="true"] { cursor: default; }
  .ytmd-grooving button:focus-visible, .ytmd-grooving input:focus-visible {
    outline: 2px solid var(--ytmd-color-accent);
    outline-offset: 2px;
  }

  .ytmd-grooving-panel {
    height: 100%;
    border-radius: 16px 16px 0 0;
    border: 1px solid var(--ytmd-color-border);
    border-bottom: 0;
    background: var(--ytmd-color-surface);
    padding: 32px 40px;
    overflow: auto;
    display: flex;
    flex-direction: column;
    scrollbar-width: thin;
    scrollbar-color: var(--ytmd-color-border) transparent;
  }
  .ytmd-grooving-panel:focus { outline: none; }
  .ytmd-grooving .g-glass { background: var(--ytmd-color-surface); border: 1px solid var(--ytmd-color-border); }

  .ytmd-grooving .g-head { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
  .ytmd-grooving .g-badge {
    display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--ytmd-color-accent);
  }
  .ytmd-grooving .g-badge .material-symbols-outlined { font-size: 18px; }
  .ytmd-grooving .g-close {
    margin-left: auto; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; color: var(--ytmd-color-text-muted);
  }
  .ytmd-grooving .g-close:hover { background: color-mix(in oklab, var(--ytmd-color-text) 10%, transparent); color: var(--ytmd-color-text); }

  .ytmd-grooving .g-big { font-size: 44px; line-height: 1.05; letter-spacing: -0.03em; font-weight: 900; margin: 0 0 8px; }
  .ytmd-grooving .g-lead { color: var(--ytmd-color-text-muted); font-size: 16px; margin: 0 0 28px; max-width: 60ch; }
  .ytmd-grooving .g-label {
    font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ytmd-color-text-muted); margin: 0 0 10px; font-weight: 500;
  }
  .ytmd-grooving .g-hint { color: var(--ytmd-color-text-muted); font-size: 13px; }
  .ytmd-grooving .g-notice {
    display: flex; align-items: flex-start; gap: 10px; margin: -8px 0 20px; padding: 12px 12px 12px 16px; border-radius: 10px;
    border: 1px solid color-mix(in oklab, var(--ytmd-color-accent) 45%, var(--ytmd-color-border));
    background: color-mix(in oklab, var(--ytmd-color-accent) 12%, transparent);
  }
  .ytmd-grooving .g-notice p { flex: 1; margin: 0; font-size: 13px; line-height: 1.45; }
  .ytmd-grooving .g-notice .g-close { margin-left: 0; width: 28px; height: 28px; flex: none; }
  .ytmd-grooving .g-notice .g-close .material-symbols-outlined { font-size: 18px; }
  .ytmd-grooving .g-cap {
    font-size: 11px; color: var(--ytmd-color-text-muted); letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 10px;
  }

  .ytmd-grooving .g-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
  .ytmd-grooving .g-chip {
    height: 36px; padding: 0 14px; border-radius: 8px; display: inline-flex; align-items: center; font-size: 14px;
    background: color-mix(in oklab, var(--ytmd-color-text) 8%, transparent); border: 1px solid var(--ytmd-color-border); color: var(--ytmd-color-text);
  }
  .ytmd-grooving .g-chip:hover { background: color-mix(in oklab, var(--ytmd-color-text) 14%, transparent); }
  .ytmd-grooving .g-chip.g-on { background: var(--ytmd-color-text); color: var(--ytmd-color-background); border-color: transparent; font-weight: 500; }
  .ytmd-grooving .g-chip.g-more { color: var(--ytmd-color-text-muted); border-style: dashed; }
  .ytmd-grooving .g-chip[aria-disabled="true"] { opacity: 0.45; }
  .ytmd-grooving .g-chip[aria-disabled="true"]:hover { background: transparent; }
  .ytmd-grooving .g-chip::before {
    content: ""; width: 4px; height: 18px; border-radius: 2px; margin-right: 10px; background: var(--g-stripe, var(--ytmd-color-accent));
  }
  .ytmd-grooving .g-chip.g-more::before { display: none; }

  .ytmd-grooving .g-field {
    height: 48px; border-radius: 10px; display: flex; align-items: center; gap: 10px; padding: 0 14px; max-width: 520px;
    background: color-mix(in oklab, var(--ytmd-color-background) 40%, transparent); border: 1px solid var(--ytmd-color-border);
    color: var(--ytmd-color-text-muted); font-size: 15px;
  }
  .ytmd-grooving .g-field input {
    flex: 1; min-width: 0; height: 100%; background: transparent; border: 0; outline: none; font: inherit; color: var(--ytmd-color-text);
  }
  .ytmd-grooving .g-field input::placeholder { color: var(--ytmd-color-text-muted); font-style: italic; }
  .ytmd-grooving .g-field:focus-within { border-color: var(--ytmd-color-accent); }

  .ytmd-grooving .g-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px 40px; margin-top: 20px; }
  .ytmd-grooving .g-seg {
    display: inline-flex; padding: 4px; border-radius: 12px; gap: 4px;
    background: color-mix(in oklab, var(--ytmd-color-background) 45%, transparent); border: 1px solid var(--ytmd-color-border);
  }
  .ytmd-grooving .g-opt { min-width: 128px; padding: 10px 16px; border-radius: 9px; font-size: 14px; font-weight: 500; text-align: left; color: var(--ytmd-color-text); }
  .ytmd-grooving .g-opt small { display: block; font-weight: 400; font-size: 12px; color: var(--ytmd-color-text-muted); margin-top: 2px; }
  .ytmd-grooving .g-opt.g-on { background: var(--ytmd-color-accent); color: var(--ytmd-color-background); }
  .ytmd-grooving .g-opt.g-on small { color: color-mix(in oklab, var(--ytmd-color-background) 75%, transparent); }
  .ytmd-grooving .g-opt.g-off { opacity: 0.38; }
  .ytmd-grooving .g-seg.g-small .g-opt { min-width: 64px; text-align: center; }
  .ytmd-grooving .g-note {
    display: flex; gap: 8px; align-items: flex-start; font-size: 13px; color: var(--ytmd-color-text-muted); margin: 10px 0 0; max-width: 460px;
  }
  .ytmd-grooving .g-note .material-symbols-outlined { font-size: 18px; }
  .ytmd-grooving .g-link { color: var(--ytmd-color-accent); text-decoration: none; }
  .ytmd-grooving .g-link:hover { text-decoration: underline; }

  .ytmd-grooving .g-actions { margin-top: auto; display: flex; align-items: center; gap: 12px; padding: 20px 0 28px; flex-wrap: wrap; }
  .ytmd-grooving .g-btn {
    height: 44px; padding: 0 22px; border-radius: 22px; display: inline-flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 500;
    border: 1px solid var(--ytmd-color-border); color: var(--ytmd-color-text); background: transparent;
    transition: background-color 0.15s ease, transform 0.1s ease;
  }
  .ytmd-grooving .g-btn:hover { background: color-mix(in oklab, var(--ytmd-color-text) 10%, transparent); }
  .ytmd-grooving .g-btn:active { transform: scale(0.97); }
  .ytmd-grooving .g-btn.g-primary { background: var(--ytmd-color-text); color: var(--ytmd-color-background); border-color: transparent; }
  .ytmd-grooving .g-btn.g-primary:hover { background: color-mix(in oklab, var(--ytmd-color-text) 85%, var(--ytmd-color-accent)); }
  .ytmd-grooving .g-btn[aria-disabled="true"] { opacity: 0.45; transform: none; }
  .ytmd-grooving .g-btn[aria-disabled="true"]:hover { background: transparent; }
  .ytmd-grooving .g-btn.g-primary[aria-disabled="true"]:hover { background: var(--ytmd-color-text); }
  .ytmd-grooving .g-btn .material-symbols-outlined { font-size: 20px; }
  .ytmd-grooving .g-status { color: var(--ytmd-color-text-muted); font-size: 14px; margin: 0 0 20px; }

  .ytmd-grooving .g-art { position: relative; overflow: hidden; display: block; border-radius: 8px; background: var(--g-art); }
  .ytmd-grooving .g-art img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .ytmd-grooving .g-art.g-blank::after {
    content: ""; position: absolute; inset: 0;
    background: radial-gradient(80% 80% at 30% 20%, color-mix(in oklab, var(--ytmd-color-text) 22%, transparent), transparent 60%);
  }
  .ytmd-grooving .g-g1 {
    --g-art: linear-gradient(135deg, color-mix(in oklab, var(--ytmd-color-accent) 85%, var(--ytmd-color-background)), color-mix(in oklab, var(--ytmd-color-accent) 20%, var(--ytmd-color-background)));
  }
  .ytmd-grooving .g-g2 {
    --g-art: linear-gradient(200deg, color-mix(in oklab, var(--ytmd-color-text) 55%, var(--ytmd-color-background)), color-mix(in oklab, var(--ytmd-color-accent) 35%, var(--ytmd-color-background)));
  }
  .ytmd-grooving .g-g3 {
    --g-art: conic-gradient(from 210deg at 60% 40%, color-mix(in oklab, var(--ytmd-color-accent) 60%, var(--ytmd-color-text)), var(--ytmd-color-background), color-mix(in oklab, var(--ytmd-color-accent) 70%, var(--ytmd-color-background)));
  }
  .ytmd-grooving .g-g4 { --g-art: linear-gradient(160deg, color-mix(in oklab, var(--ytmd-color-background) 30%, var(--ytmd-color-text)), var(--ytmd-color-background)); }
  .ytmd-grooving .g-g5 {
    --g-art: radial-gradient(circle at 70% 70%, color-mix(in oklab, var(--ytmd-color-accent) 90%, var(--ytmd-color-text)), var(--ytmd-color-background) 70%);
  }

  .ytmd-grooving .g-progress { display: flex; gap: 6px; margin-bottom: 18px; }
  .ytmd-grooving .g-progress i { width: 40px; height: 4px; border-radius: 2px; background: color-mix(in oklab, var(--ytmd-color-text) 18%, transparent); }
  .ytmd-grooving .g-progress i.g-done { background: var(--ytmd-color-accent); }
  .ytmd-grooving .g-progress i.g-now { background: var(--ytmd-color-text); }
  .ytmd-grooving .g-pair { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 20px; align-items: stretch; max-width: 900px; }
  .ytmd-grooving .g-vs { align-self: center; font-size: 13px; letter-spacing: 0.14em; color: var(--ytmd-color-text-muted); }
  .ytmd-grooving .g-card {
    border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 16px;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }
  .ytmd-grooving .g-card:hover {
    background: color-mix(in oklab, var(--ytmd-color-text) 12%, transparent);
    border-color: color-mix(in oklab, var(--ytmd-color-accent) 60%, var(--ytmd-color-border));
  }
  .ytmd-grooving .g-card .g-art { width: 100%; aspect-ratio: 1 / 1; max-height: 260px; flex: none; border-radius: 10px; }
  .ytmd-grooving .g-card .g-meta { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .ytmd-grooving .g-tag {
    align-self: flex-start; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; padding: 3px 8px; border-radius: 4px;
    border: 1px solid var(--ytmd-color-border); color: var(--ytmd-color-text-muted); margin-bottom: 12px;
  }
  .ytmd-grooving .g-tag.g-newtag { color: var(--ytmd-color-accent); border-color: color-mix(in oklab, var(--ytmd-color-accent) 55%, transparent); }
  .ytmd-grooving .g-card h2 { font-size: 24px; line-height: 1.15; letter-spacing: -0.02em; margin: 0 0 6px; font-weight: 700; overflow-wrap: anywhere; }
  .ytmd-grooving .g-artist { color: var(--ytmd-color-text-muted); font-size: 15px; margin: 0 0 auto; overflow-wrap: anywhere; }
  .ytmd-grooving .g-foot { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; }
  .ytmd-grooving .g-card.g-previewing { border-color: var(--ytmd-color-accent); }
  .ytmd-grooving .g-pv { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--ytmd-color-accent); margin-top: 14px; }
  .ytmd-grooving .g-pv .g-track { flex: 1; height: 4px; border-radius: 2px; background: color-mix(in oklab, var(--ytmd-color-accent) 25%, transparent); overflow: hidden; }
  .ytmd-grooving .g-pv .g-track i {
    display: block; height: 100%; width: 60%; background: var(--ytmd-color-accent); animation: ytmd-grooving-grow 15s linear infinite; transform-origin: left;
  }
  .ytmd-grooving .g-eq { display: inline-flex; gap: 2px; align-items: flex-end; height: 14px; }
  .ytmd-grooving .g-eq b { width: 3px; height: 4px; background: var(--ytmd-color-accent); animation: ytmd-grooving-eq 0.9s ease-in-out infinite; }
  .ytmd-grooving .g-eq b:nth-child(2) { animation-delay: 0.2s; }
  .ytmd-grooving .g-eq b:nth-child(3) { animation-delay: 0.4s; }
  .ytmd-grooving .g-neither { margin-top: 22px; display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
  .ytmd-grooving .g-waiting { margin-top: 26px; padding: 16px; border-radius: 14px; border: 1px dashed var(--ytmd-color-border); max-width: 980px; }
  .ytmd-grooving .g-sk { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .ytmd-grooving .g-sk div {
    height: 72px; border-radius: 10px;
    background: linear-gradient(90deg, color-mix(in oklab, var(--ytmd-color-text) 6%, transparent), color-mix(in oklab, var(--ytmd-color-text) 14%, transparent), color-mix(in oklab, var(--ytmd-color-text) 6%, transparent));
    background-size: 200% 100%;
    animation: ytmd-grooving-shimmer 1.4s linear infinite;
  }

  .ytmd-grooving .g-done-grid { display: grid; grid-template-columns: minmax(280px, 340px) minmax(0, 1fr); gap: 36px; }
  .ytmd-grooving .g-cover { width: 220px; height: 220px; border-radius: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 3px; overflow: hidden; margin-bottom: 22px; }
  .ytmd-grooving .g-cover .g-art { border-radius: 0; }
  .ytmd-grooving .g-kicker { font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ytmd-color-accent); margin: 0 0 8px; }
  .ytmd-grooving .g-hero h1 { font-size: 40px; line-height: 1.08; letter-spacing: -0.03em; font-weight: 900; margin: 0 0 18px; overflow-wrap: anywhere; }
  .ytmd-grooving .g-ratio { display: flex; height: 6px; border-radius: 3px; overflow: hidden; margin: 6px 0 18px; max-width: 300px; }
  .ytmd-grooving .g-ratio i { background: var(--ytmd-color-text); }
  .ytmd-grooving .g-ratio i + i { background: var(--ytmd-color-accent); }
  .ytmd-grooving .g-buttons { display: flex; gap: 10px; flex-wrap: wrap; }
  .ytmd-grooving .g-usage { margin-top: 20px; padding: 14px 16px; border-radius: 12px; font-size: 13px; color: var(--ytmd-color-text-muted); max-width: 320px; }
  .ytmd-grooving .g-usage b { color: var(--ytmd-color-text); font-weight: 500; }
  .ytmd-grooving .g-toast { margin-top: 14px; display: flex; gap: 10px; align-items: center; padding: 10px 14px; border-radius: 10px; font-size: 13px; max-width: 320px; }
  .ytmd-grooving .g-toast .material-symbols-outlined { color: var(--ytmd-color-accent); font-size: 20px; }
  .ytmd-grooving .g-list { list-style: none; margin: 0; padding: 0; columns: 2 300px; column-gap: 24px; }
  .ytmd-grooving .g-list li {
    break-inside: avoid; display: grid; grid-template-columns: 22px 36px 1fr auto; gap: 12px; align-items: center; padding: 6px 8px; border-radius: 8px;
    font-size: 14px;
  }
  .ytmd-grooving .g-list li:hover { background: color-mix(in oklab, var(--ytmd-color-text) 8%, transparent); }
  .ytmd-grooving .g-list .g-n { color: var(--ytmd-color-text-muted); font-size: 12px; text-align: right; }
  .ytmd-grooving .g-list .g-art { width: 36px; height: 36px; border-radius: 4px; }
  .ytmd-grooving .g-list .g-t { min-width: 0; }
  .ytmd-grooving .g-list .g-t b { display: block; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ytmd-grooving .g-list .g-t span { display: block; font-size: 12px; color: var(--ytmd-color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ytmd-grooving .g-list .g-k { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ytmd-color-text-muted); }
  .ytmd-grooving .g-list .g-k.g-kn { color: var(--ytmd-color-accent); }
  .ytmd-grooving .g-list-column { min-width: 0; }
  .ytmd-grooving .g-keep { margin-top: 22px; border-radius: 14px; padding: 16px 18px; }
  .ytmd-grooving .g-keep-head { display: flex; align-items: center; gap: 12px; }
  .ytmd-grooving .g-keep-head b { font-size: 15px; font-weight: 500; }
  .ytmd-grooving .g-keep p { margin: 6px 0 0; }
  .ytmd-grooving .g-keep .g-keep-line { font-size: 13px; color: var(--ytmd-color-accent); }
  .ytmd-grooving .g-switch {
    margin-left: auto; flex: none; width: 46px; height: 26px; padding: 3px; border-radius: 13px;
    background: color-mix(in oklab, var(--ytmd-color-text) 22%, transparent); border: 1px solid var(--ytmd-color-border);
    transition: background-color 0.15s ease;
  }
  .ytmd-grooving .g-switch[aria-checked="true"] { background: var(--ytmd-color-accent); border-color: transparent; }
  .ytmd-grooving .g-switch-knob {
    display: block; width: 18px; height: 18px; border-radius: 50%; background: var(--ytmd-color-background);
    transition: transform 0.15s ease;
  }
  .ytmd-grooving .g-switch[aria-checked="true"] .g-switch-knob { transform: translateX(20px); }

  .ytmd-grooving .g-sheet { border-radius: 16px; padding: 28px; max-width: 620px; }
  .ytmd-grooving .g-sheet h2 { font-size: 26px; letter-spacing: -0.02em; margin: 0 0 8px; font-weight: 700; }
  .ytmd-grooving .g-sheet p { color: var(--ytmd-color-text-muted); font-size: 14px; margin: 0 0 18px; line-height: 1.55; }
  .ytmd-grooving .g-sheet .g-key { font-size: 40px; color: var(--ytmd-color-accent); margin-bottom: 10px; }
  .ytmd-grooving .g-sends { list-style: none; padding: 0; margin: 0 0 18px; display: grid; gap: 10px; }
  .ytmd-grooving .g-sends li {
    display: grid; grid-template-columns: 28px 1fr auto; gap: 10px; align-items: center; font-size: 14px; padding: 10px 12px; border-radius: 10px;
    background: color-mix(in oklab, var(--ytmd-color-background) 35%, transparent); border: 1px solid var(--ytmd-color-border);
  }
  .ytmd-grooving .g-sends .material-symbols-outlined { font-size: 20px; color: var(--ytmd-color-accent); }
  .ytmd-grooving .g-sends small { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ytmd-color-text-muted); }
  .ytmd-grooving .g-sends li.g-always small { color: var(--ytmd-color-accent); }
  .ytmd-grooving .g-to {
    display: flex; gap: 10px; align-items: center; font-size: 14px; padding: 12px; border-radius: 10px; border: 1px dashed var(--ytmd-color-border); margin-bottom: 22px;
  }
  .ytmd-grooving .g-stack { display: flex; flex-direction: column; gap: 10px; }
  .ytmd-grooving .g-stack .g-btn { justify-content: flex-start; }
  .ytmd-grooving .g-stack .g-btn small { margin-left: auto; font-weight: 400; font-size: 12px; opacity: 0.7; }
  .ytmd-grooving .g-sheet .g-after { margin: 16px 0 0; }

  .ytmd-grooving .g-fails { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 360px)); gap: 20px; margin-top: 8px; }
  .ytmd-grooving .g-fail { border-radius: 16px; padding: 22px; display: flex; flex-direction: column; min-height: 260px; }
  .ytmd-grooving .g-fail .g-ic {
    width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; margin-bottom: 14px;
    background: color-mix(in oklab, var(--ytmd-color-accent) 18%, transparent); color: var(--ytmd-color-accent);
  }
  .ytmd-grooving .g-fail h2 { font-size: 20px; margin: 0 0 6px; font-weight: 700; letter-spacing: -0.01em; }
  .ytmd-grooving .g-fail p { color: var(--ytmd-color-text-muted); font-size: 14px; line-height: 1.5; margin: 0 0 6px; }
  .ytmd-grooving .g-fail .g-acts { margin-top: auto; display: flex; gap: 8px; padding-top: 16px; flex-wrap: wrap; }

  @keyframes ytmd-grooving-eq { 0%, 100% { height: 4px; } 50% { height: 14px; } }
  @keyframes ytmd-grooving-grow { from { transform: scaleX(0.4); } to { transform: scaleX(1.6); } }
  @keyframes ytmd-grooving-shimmer { from { background-position: 200% 0; } to { background-position: 0 0; } }

  @media (prefers-reduced-motion: reduce) {
    .ytmd-grooving *, .ytmd-grooving *::before, .ytmd-grooving *::after { animation: none !important; transition: none !important; }
  }
`;

// What the setup screen remembers while the same setup lasts (a new state may arrive, for example when the moods load)
type SetupMemory = {
  // 0-1 item of "Moods & activities" and 0-GROOVING_BLEND_GENRE_LIMIT items of "Genres" (in the order chosen)
  mood: GroovingMoodItem | null;
  genres: GroovingMoodItem[];
  text: string;
  direction: GroovingDirection | null;
  rounds: GroovingRounds;
  expanded: Set<GroovingMoodSection>;
};

type FocusMemory = { key: string; selectionStart: number | null; selectionEnd: number | null };

function newSetupMemory(): SetupMemory {
  return { mood: null, genres: [], text: "", direction: null, rounds: DEFAULT_ROUNDS, expanded: new Set() };
}

// The chosen items, moods first and then genres in the order chosen
function chosenItems(memory: SetupMemory): GroovingMoodItem[] {
  return memory.mood ? [memory.mood, ...memory.genres] : [...memory.genres];
}

function isChosen(memory: SetupMemory, item: GroovingMoodItem): boolean {
  return chosenItems(memory).some(chosen => sameMoodItem(chosen, item));
}

function sameMoodItem(a: GroovingMoodItem, b: GroovingMoodItem): boolean {
  return a.section === b.section && a.params === b.params && a.name === b.name;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function icon(name: string, className?: string): HTMLSpanElement {
  const node = el("span", className ? `${ICON_CLASS} ${className}` : ICON_CLASS, name);
  node.setAttribute("aria-hidden", "true");
  return node;
}

function setDisabled(node: HTMLElement, disabled: boolean) {
  if (disabled) node.setAttribute("aria-disabled", "true");
  else node.removeAttribute("aria-disabled");
}

function isDisabled(node: HTMLElement): boolean {
  return node.getAttribute("aria-disabled") === "true";
}

type ButtonOptions = { className?: string; icon?: string; detail?: string; focusKey?: string; onPress: () => void };

function button(label: string, options: ButtonOptions): HTMLButtonElement {
  const node = el("button", options.className ?? "g-btn");
  node.type = "button";
  if (options.icon) node.append(icon(options.icon));
  node.append(document.createTextNode(label));
  if (options.detail !== undefined) node.append(el("small", undefined, options.detail));
  if (options.focusKey) node.dataset.focusKey = options.focusKey;
  node.addEventListener("click", () => {
    if (isDisabled(node)) return;
    options.onPress();
  });
  return node;
}

function note(iconName: string, ...content: (string | Node)[]): HTMLParagraphElement {
  const node = el("p", "g-note");
  const text = el("span");
  text.append(...content);
  node.append(icon(iconName), text);
  return node;
}

function art(thumbnailUrl: string | null, gradient: number, className?: string): HTMLSpanElement {
  const box = el("span", `g-art g-g${((gradient - 1) % ART_GRADIENTS) + 1}${className ? ` ${className}` : ""}`);
  if (!thumbnailUrl) {
    box.classList.add("g-blank");
    return box;
  }
  const image = el("img");
  image.alt = "";
  image.loading = "lazy";
  image.decoding = "async";
  image.addEventListener("error", () => {
    image.remove();
    box.classList.add("g-blank");
  });
  image.src = thumbnailUrl;
  box.append(image);
  return box;
}

function progress(round: number, rounds: number, label: string): HTMLDivElement {
  const bar = el("div", "g-progress");
  bar.setAttribute("role", "img");
  bar.setAttribute("aria-label", label);
  for (let index = 1; index <= rounds; index++) {
    bar.append(el("i", index < round ? "g-done" : index === round ? "g-now" : undefined));
  }
  return bar;
}

function formatSeconds(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

// null when the cost rounds below $0.001
function formatUsd(usd: number): string | null {
  if (usd < 0.0005) return null;
  return `$${usd.toFixed(usd < 0.01 ? 3 : 2)}`;
}

function formatCount(count: number): string {
  return count.toLocaleString("en-US");
}

function artistsOf(track: GroovingCandidate): string {
  return track.artists.join(", ");
}

function openSettings() {
  window.postMessage({ op: GroovingMessageOp.OpenSettings }, "*");
}

export function createGroovingView(send: (signal: GroovingSignal) => void): { element: HTMLElement; render(state: GroovingViewMessage): void } {
  const element = el("div", ROOT_CLASS);
  element.hidden = true;
  const panel = el("section", PANEL_CLASS);
  panel.setAttribute("aria-label", "Grooving");
  // Takes the focus when the focused control goes away, so Tab keeps moving inside the screen
  panel.tabIndex = -1;
  element.append(panel);

  let current: GroovingViewMessage = {
    screen: GroovingScreen.Closed,
    visibility: GroovingVisibility.Gone,
    mark: null,
    language: GroovingLanguage.English
  };
  // The fixed text in the language main chose (state.language), set on each render
  let text: GroovingText = GROOVING_TEXT[current.language];
  let setup = newSetupMemory();
  // Set once a pair is answered, so a second press cannot answer the pair that comes next
  let answered = false;
  let preview: { videoId: string; startedAt: number } | null = null;
  let previewClock: HTMLElement | null = null;
  let previewTimer: number | null = null;

  function header(hint: string): HTMLDivElement {
    const head = el("div", "g-head");
    const badge = el("span", "g-badge");
    badge.append(icon("instant_mix"), document.createTextNode("Grooving"));
    const close = el("button", "g-close");
    close.type = "button";
    close.title = text.close;
    close.setAttribute("aria-label", text.close);
    close.dataset.focusKey = "close";
    close.append(icon("close"));
    close.addEventListener("click", () => send({ type: "close" }));
    head.append(badge);
    if (hint) head.append(el("span", "g-hint", hint));
    head.append(close);
    return head;
  }

  // The notice of the previous run (the app closed while a run was still going), at the top left of the setup screen
  function buildNotice(): HTMLDivElement {
    const notice = el("div", "g-notice");
    notice.setAttribute("role", "status");
    notice.append(el("p", undefined, text.previousRunEnded));
    const dismiss = el("button", "g-close");
    dismiss.type = "button";
    dismiss.title = text.dismissNotice;
    dismiss.setAttribute("aria-label", text.dismissNotice);
    dismiss.dataset.focusKey = "dismiss-notice";
    dismiss.append(icon("close"));
    dismiss.addEventListener("click", () => send({ type: "dismissNotice" }));
    notice.append(dismiss);
    return notice;
  }

  function buildKeyMissing(state: ViewOf<typeof GroovingScreen.KeyMissing>): Node[] {
    const sheet = el("div", "g-sheet g-glass");
    sheet.append(
      icon("key", "g-key"),
      el("h2", undefined, text.keyMissingTitle),
      el("p", undefined, text.keyMissingText(Object.values(GROOVING_PROVIDER_LABELS)))
    );
    if (!state.safeStorageAvailable) {
      const warning = note("warning", text.keyNotSecure);
      warning.style.margin = "0 0 18px";
      sheet.append(warning);
    }
    sheet.append(
      button(text.openSettings, {
        className: "g-btn g-primary",
        icon: "settings",
        focusKey: "open-settings",
        onPress: () => {
          openSettings();
          send({ type: "close" });
        }
      })
    );
    return [header(text.keyMissingHint), sheet];
  }

  function buildConsent(state: ViewOf<typeof GroovingScreen.Consent>): Node[] {
    const sheet = el("div", "g-sheet g-glass");
    const sends = el("ul", "g-sends");
    const items: { icon: string; text: string; when: string; always: boolean }[] = [
      { icon: "history", text: text.sendsHistory, when: text.sendsHistoryWhen, always: false },
      { icon: "mood", text: text.sendsMood, when: text.sendsAlways, always: true },
      { icon: "queue_music", text: text.sendsCandidates, when: text.sendsAlways, always: true }
    ];
    for (const item of items) {
      const row = el("li", item.always ? "g-always" : undefined);
      row.append(icon(item.icon), el("span", undefined, item.text), el("small", undefined, item.when));
      sends.append(row);
    }
    const to = el("div", "g-to");
    const toText = el("span");
    toText.append(text.sentToBefore, el("b", undefined, state.providerLabel), text.sentToAfter);
    to.append(icon("send"), toText);

    const choose = (choice: GroovingConsentChoice | null) => send({ type: "consent", choice });
    const stack = el("div", "g-stack");
    stack.append(
      button(text.shareHistory, {
        className: "g-btn g-primary",
        icon: "check",
        detail: text.shareHistoryDetail,
        focusKey: "consent-share",
        onPress: () => choose(GroovingConsentChoice.ShareHistory)
      }),
      button(text.noHistory, {
        icon: "visibility_off",
        detail: text.noHistoryDetail,
        focusKey: "consent-no-history",
        onPress: () => choose(GroovingConsentChoice.NoHistory)
      }),
      button(text.notNow, { icon: "close", detail: text.notNowDetail, focusKey: "consent-not-now", onPress: () => choose(null) })
    );

    sheet.append(
      el("h2", undefined, text.consentTitle),
      el("p", undefined, text.consentText),
      sends,
      to,
      stack,
      el("p", "g-hint g-after", text.consentAfter)
    );
    return [header(text.consentHint), sheet];
  }

  function buildSetup(state: ViewOf<typeof GroovingScreen.Setup>): Node[] {
    const memory = setup;
    // The list was read again: drop only the chosen items it no longer has
    const loaded = state.moods;
    if (loaded) {
      const listed = (item: GroovingMoodItem) => loaded.some(known => sameMoodItem(known, item));
      if (memory.mood && !listed(memory.mood)) memory.mood = null;
      memory.genres = memory.genres.filter(listed);
    }

    const chips: { node: HTMLButtonElement; item: GroovingMoodItem }[] = [];
    let genreLimit: HTMLSpanElement | null = null;
    const directionButtons: { node: HTMLButtonElement; direction: GroovingDirection }[] = [];
    const roundButtons: { node: HTMLButtonElement; rounds: GroovingRounds }[] = [];

    const effectiveDirection = (): GroovingDirection => {
      if (!state.historyShared) return GroovingDirection.Discover;
      return memory.direction ?? GroovingDirection.Mix;
    };
    // One item stays kind "item"; 2-3 items are a blend (moods first, then genres in the order chosen)
    const chosenMood = (): GroovingMood | null => {
      const items = chosenItems(memory);
      const [first, ...rest] = items;
      if (first) return rest.length === 0 ? { kind: "item", item: first } : { kind: "blend", items };
      const text = memory.text.trim();
      return text ? { kind: "text", text } : null;
    };
    // A mood replaces the mood chosen before; a genre is added up to GROOVING_BLEND_GENRE_LIMIT. Pressing a chosen item again lets it go
    const toggleItem = (item: GroovingMoodItem) => {
      if (item.section === GroovingMoodSection.Genres) {
        if (isChosen(memory, item)) memory.genres = memory.genres.filter(genre => !sameMoodItem(genre, item));
        else if (memory.genres.length < GROOVING_BLEND_GENRE_LIMIT) memory.genres = [...memory.genres, item];
        else return;
      } else {
        memory.mood = memory.mood !== null && sameMoodItem(memory.mood, item) ? null : item;
      }
      if (isChosen(memory, item)) {
        memory.text = "";
        input.value = "";
      }
      sync();
    };

    const nodes: Node[] = [header(text.setupHint)];
    if (state.notice) nodes.push(buildNotice());
    nodes.push(el("h1", "g-big", text.setupTitle), el("p", "g-lead", text.setupLead(GROOVING_BLEND_GENRE_LIMIT)));

    const moods = state.moods ?? [];
    if (state.moods === null && !state.moodsFailed) {
      const loading = el("p", "g-status", text.moodsLoading);
      loading.setAttribute("role", "status");
      nodes.push(loading);
    } else if (state.moodsFailed || moods.length === 0) {
      const failed = note("cloud_off", text.moodsFailed);
      failed.setAttribute("role", "status");
      failed.style.marginBottom = "20px";
      nodes.push(failed);
    } else {
      for (const section of MOOD_SECTION_ORDER) {
        const label = text.moodSections[section];
        const items = moods.filter(item => item.section === section);
        if (items.length === 0) continue;
        const expanded = memory.expanded.has(section) || items.length <= CHIP_LIMIT + 1;
        const shown = expanded ? items : items.filter((item, index) => index < CHIP_LIMIT || isChosen(memory, item));
        const row = el("div", "g-chips");
        row.setAttribute("role", "group");
        row.setAttribute("aria-label", label);
        shown.forEach((item, index) => {
          const chip = button(item.name, {
            className: "g-chip",
            focusKey: `chip:${item.section}:${item.params}:${item.name}`,
            onPress: () => toggleItem(item)
          });
          chip.style.setProperty("--g-stripe", CHIP_STRIPES[index % CHIP_STRIPES.length]);
          chips.push({ node: chip, item });
          row.append(chip);
        });
        if (!expanded) {
          row.append(
            button(text.moreChips(items.length - shown.length), {
              className: "g-chip g-more",
              focusKey: `more:${section}`,
              onPress: () => {
                memory.expanded.add(section);
                render(current);
              }
            })
          );
        }
        const heading = el("p", "g-label", label);
        if (section === GroovingMoodSection.Genres) {
          // Shown while the genres are full (see sync)
          genreLimit = el("span", undefined, text.genreLimit(GROOVING_BLEND_GENRE_LIMIT));
          genreLimit.style.marginLeft = "8px";
          genreLimit.style.textTransform = "none";
          genreLimit.style.letterSpacing = "normal";
          heading.append(genreLimit);
        }
        nodes.push(heading, row);
      }
    }

    const field = el("label", "g-field");
    const input = el("input");
    input.type = "text";
    input.value = memory.text;
    input.placeholder = text.moodPlaceholder;
    input.setAttribute("aria-label", text.moodTextLabel);
    input.dataset.focusKey = "mood-text";
    input.addEventListener("input", () => {
      memory.text = input.value;
      if (memory.text.trim() !== "") {
        memory.mood = null;
        memory.genres = [];
      }
      sync();
    });
    input.addEventListener("keydown", event => {
      if (event.key !== "Enter" || event.isComposing) return;
      event.preventDefault();
      start.click();
    });
    field.append(icon("edit"), input);
    nodes.push(field);

    const directionColumn = el("div");
    const directionGroup = el("div", "g-seg");
    directionGroup.setAttribute("role", "group");
    directionGroup.setAttribute("aria-label", text.direction);
    for (const direction of DIRECTION_ORDER) {
      const unavailable = !state.historyShared && direction !== GroovingDirection.Discover;
      const option = button(text.directions[direction].label, {
        className: unavailable ? "g-opt g-off" : "g-opt",
        detail: unavailable ? text.needsHistory : text.directions[direction].detail,
        focusKey: `direction:${direction}`,
        onPress: () => {
          memory.direction = direction;
          sync();
        }
      });
      setDisabled(option, unavailable);
      directionButtons.push({ node: option, direction });
      directionGroup.append(option);
    }
    directionColumn.append(el("p", "g-label", text.direction), directionGroup);
    if (!state.historyShared) {
      const change = button(text.changeInSettings, { className: "g-link", focusKey: "change-in-settings", onPress: openSettings });
      directionColumn.append(note("lock", text.discoverOnly, change));
    }

    const roundsColumn = el("div");
    const roundsGroup = el("div", "g-seg g-small");
    roundsGroup.setAttribute("role", "group");
    roundsGroup.setAttribute("aria-label", text.rounds);
    for (const rounds of GROOVING_ROUND_OPTIONS) {
      const option = button(String(rounds), {
        className: "g-opt",
        focusKey: `rounds:${rounds}`,
        onPress: () => {
          memory.rounds = rounds;
          sync();
        }
      });
      roundButtons.push({ node: option, rounds });
      roundsGroup.append(option);
    }
    const roundsNote = el("span");
    const roundsNoteRow = el("p", "g-note");
    roundsNoteRow.append(icon("schedule"), roundsNote);
    roundsColumn.append(el("p", "g-label", text.rounds), roundsGroup, roundsNoteRow);

    const row = el("div", "g-row");
    row.append(directionColumn, roundsColumn);
    nodes.push(row);

    const start = button(text.start, {
      className: "g-btn g-primary",
      icon: "play_arrow",
      focusKey: "start",
      onPress: () => {
        const mood = chosenMood();
        if (!mood) return;
        send({ type: "start", mood, direction: effectiveDirection(), rounds: memory.rounds });
      }
    });
    const actions = el("div", "g-actions");
    actions.append(start, el("span", "g-hint", text.usesProvider(state.providerLabel, state.model)));
    nodes.push(actions);

    function sync() {
      const genresFull = memory.genres.length >= GROOVING_BLEND_GENRE_LIMIT;
      for (const chip of chips) {
        const on = isChosen(memory, chip.item);
        chip.node.classList.toggle("g-on", on);
        chip.node.setAttribute("aria-pressed", String(on));
        const overGenreLimit = genresFull && !on && chip.item.section === GroovingMoodSection.Genres;
        // Main drops a blend whose items share params, so an item with the same params as a chosen one (in either section) cannot be added
        const sameParams = !on && chosenItems(memory).some(chosen => chosen.params === chip.item.params);
        setDisabled(chip.node, overGenreLimit || sameParams);
        if (overGenreLimit) chip.node.title = text.genreLimitTitle(GROOVING_BLEND_GENRE_LIMIT);
        else chip.node.removeAttribute("title");
      }
      if (genreLimit) genreLimit.hidden = !genresFull;
      const direction = effectiveDirection();
      for (const option of directionButtons) {
        const on = option.direction === direction;
        option.node.classList.toggle("g-on", on);
        option.node.setAttribute("aria-pressed", String(on));
      }
      for (const option of roundButtons) {
        const on = option.rounds === memory.rounds;
        option.node.classList.toggle("g-on", on);
        option.node.setAttribute("aria-pressed", String(on));
      }
      roundsNote.textContent = text.roundsNote(memory.rounds);
      setDisabled(start, chosenMood() === null);
    }
    sync();

    return nodes;
  }

  function buildWorking(state: ViewOf<typeof GroovingScreen.Working>): Node[] {
    const nodes: Node[] = [header(state.round !== null && state.rounds !== null ? text.round(state.round, state.rounds) : "")];
    if (state.round !== null && state.rounds !== null) nodes.push(progress(state.round, state.rounds, text.round(state.round, state.rounds)));
    const title = el("h1", "g-big", text.working[state.step]);
    title.setAttribute("role", "status");
    nodes.push(title);
    if (state.filledFromMood) nodes.push(filledNote());
    const waiting = el("div", "g-waiting");
    waiting.setAttribute("aria-hidden", "true");
    const skeleton = el("div", "g-sk");
    skeleton.append(el("div"), el("div"));
    waiting.append(skeleton);
    nodes.push(waiting);
    return nodes;
  }

  function filledNote(): HTMLParagraphElement {
    const filled = note("info", text.filledFromMood);
    filled.style.margin = "0 0 20px";
    return filled;
  }

  function buildChoose(state: ViewOf<typeof GroovingScreen.Choose>): Node[] {
    const answer = (value: GroovingAnswer) => {
      if (answered) return;
      answered = true;
      send({ type: "answer", answer: value });
    };

    const card = (track: GroovingCandidate, side: GroovingAnswer, gradient: number): HTMLElement => {
      const previewing = state.previewing === track.videoId;
      const node = el("article", previewing ? "g-card g-glass g-previewing" : "g-card g-glass");
      const familiar = track.kind === GroovingTrackKind.Familiar;
      const meta = el("div", "g-meta");
      meta.append(
        el("span", familiar ? "g-tag" : "g-tag g-newtag", familiar ? text.familiarTag : text.newTag),
        el("h2", undefined, track.title),
        el("p", "g-artist", artistsOf(track))
      );
      if (previewing) {
        const status = el("div", "g-pv");
        status.setAttribute("role", "status");
        const eq = el("span", "g-eq");
        eq.setAttribute("aria-hidden", "true");
        eq.append(el("b"), el("b"), el("b"));
        const clock = el("span");
        previewClock = clock;
        const bar = el("span", "g-track");
        bar.setAttribute("aria-hidden", "true");
        bar.append(el("i"));
        status.append(eq, text.previewing, clock, bar);
        meta.append(status);
      }
      const foot = el("div", "g-foot");
      foot.append(
        button(text.pickThis, { className: "g-btn g-primary", focusKey: `pick:${track.videoId}`, onPress: () => answer(side) }),
        previewing
          ? button(text.stop, { icon: "stop", focusKey: `preview:${track.videoId}`, onPress: () => send({ type: "previewStop" }) })
          : button(text.preview, {
              icon: "headphones",
              focusKey: `preview:${track.videoId}`,
              onPress: () => {
                if (!answered) send({ type: "previewStart", videoId: track.videoId });
              }
            })
      );
      meta.append(foot);
      node.append(art(track.thumbnailUrl, gradient), meta);
      return node;
    };

    const nodes: Node[] = [
      header(`${state.moodLabel} · ${text.directions[state.direction].label}`),
      progress(state.round, state.rounds, text.round(state.round, state.rounds)),
      el("h1", "g-big", text.chooseTitle),
      el("p", "g-lead", text.chooseLead(state.round, state.rounds, GROOVING_PREVIEW_SECONDS))
    ];
    if (state.filledFromMood) nodes.push(filledNote());

    const pair = el("div", "g-pair");
    const vs = el("span", "g-vs", text.or);
    vs.setAttribute("aria-hidden", "true");
    pair.append(card(state.left, GroovingAnswer.Left, 1), vs, card(state.right, GroovingAnswer.Right, 3));

    const neither = el("div", "g-neither");
    neither.append(
      button(text.neither, { icon: "close", focusKey: "neither", onPress: () => answer(GroovingAnswer.Neither) }),
      el("span", "g-hint", text.neitherHint)
    );
    nodes.push(pair, neither);
    return nodes;
  }

  // The continue toggle and the one phase line under the list. The line stays empty while the toggle has never added a list
  function buildKeepGoing(state: ViewOf<typeof GroovingScreen.Done>): HTMLDivElement {
    const continuation = state.continuation;
    const box = el("div", "g-keep g-glass");
    const head = el("div", "g-keep-head");
    // The press sends the continueToggle signal; main turns it into the state's "continue-toggle" event
    const toggle = el("button", "g-switch");
    toggle.type = "button";
    toggle.setAttribute("role", "switch");
    toggle.setAttribute("aria-checked", String(continuation.enabled));
    toggle.setAttribute("aria-label", text.keepGoing);
    toggle.dataset.focusKey = "continue-toggle";
    toggle.addEventListener("click", () => send({ type: "continueToggle", enabled: !continuation.enabled }));
    toggle.append(el("span", "g-switch-knob"));
    head.append(el("b", undefined, text.keepGoing), toggle);
    box.append(head, el("p", "g-hint", text.keepGoingDetail));

    const line = keepGoingLine(continuation);
    if (line !== null) {
      const status = el("p", "g-keep-line", line);
      status.setAttribute("role", "status");
      box.append(status);
    }
    return box;
  }

  function keepGoingLine(continuation: ViewOf<typeof GroovingScreen.Done>["continuation"]): string | null {
    switch (continuation.phase) {
      case GroovingContinuationPhase.Collecting:
      case GroovingContinuationPhase.Requesting:
      case GroovingContinuationPhase.RequestingRetry:
        return text.continuationWorking;
      case GroovingContinuationPhase.Finished:
        return text.continuationFinished;
      case GroovingContinuationPhase.Failed:
        return text.continuationFailed;
      case GroovingContinuationPhase.Short:
        return text.continuationShort;
      case GroovingContinuationPhase.Idle:
        return continuation.rounds > 0 ? text.continuationCount(continuation.rounds, continuation.maxRounds) : null;
      default:
        return null;
    }
  }

  function buildDone(state: ViewOf<typeof GroovingScreen.Done>): Node[] {
    const hero = el("div", "g-hero");
    const cover = el("div", "g-cover");
    cover.setAttribute("aria-hidden", "true");
    [1, 3, 2, 5].forEach((gradient, index) => cover.append(art(state.listed[index]?.thumbnailUrl ?? null, gradient)));
    hero.append(cover, el("p", "g-kicker", text.doneKicker), el("h1", undefined, state.moodDescription), el("p", "g-label", state.moodLabel));

    const total = state.familiarCount + state.newCount;
    const counts = el("p", "g-label", text.doneCounts(state.familiarCount, state.newCount));
    counts.style.margin = "0";
    hero.append(counts);
    if (total > 0) {
      const ratio = el("div", "g-ratio");
      ratio.setAttribute("aria-hidden", "true");
      const familiar = el("i");
      familiar.style.width = `${(state.familiarCount / total) * 100}%`;
      const fresh = el("i");
      fresh.style.width = `${(state.newCount / total) * 100}%`;
      ratio.append(familiar, fresh);
      hero.append(ratio);
    }

    // The list is done but not in the queue: say so before the buttons, with a way to load it again (main decides whether to)
    if (state.queueFailed) {
      const queueAlert = el("div", "g-toast g-glass");
      queueAlert.setAttribute("role", "alert");
      queueAlert.style.flexWrap = "wrap";
      queueAlert.style.marginBottom = "18px";
      queueAlert.append(
        icon("error"),
        el("span", undefined, text.queueFailed),
        button(text.queueRetry, { icon: "queue_music", focusKey: "queue-retry", onPress: () => send({ type: "retry" }) })
      );
      hero.append(queueAlert);
    }

    const saving = state.saved === GroovingSaveStatus.Saving;
    const saved = state.saved === GroovingSaveStatus.Saved;
    const saveLabel = saving
      ? text.saving
      : state.saveAction === GroovingSaveAction.Saved
        ? text.saved
        : state.saveAction === GroovingSaveAction.Add
          ? text.saveAdd
          : text.save;
    const save = button(saveLabel, {
      className: "g-btn g-primary",
      icon: state.saveAction === GroovingSaveAction.Saved ? "check" : "playlist_add",
      focusKey: "save",
      onPress: () => send({ type: "save" })
    });
    setDisabled(save, saving || state.saveAction === GroovingSaveAction.Saved);
    const again = button(text.again, { icon: "refresh", focusKey: "again", onPress: () => send({ type: "again" }) });
    setDisabled(again, saving);
    const buttons = el("div", "g-buttons");
    buttons.append(save, again);
    hero.append(buttons);

    if (saved || state.saved === GroovingSaveStatus.Failed) {
      const toast = el("div", "g-toast g-glass");
      toast.setAttribute("role", "status");
      toast.append(icon(saved ? "check_circle" : "error"), el("span", undefined, saved ? text.savedToast(state.moodDescription) : text.saveFailed));
      hero.append(toast);
    }

    const usage = el("div", "g-usage g-glass");
    const cost = state.usage.estimatedUsd;
    usage.append(
      el("b", undefined, text.thisRun),
      ` · ${state.usage.model}`,
      el("br"),
      text.usageTokens(formatCount(state.usage.inputTokens), formatCount(state.usage.outputTokens)),
      el("br")
    );
    if (cost === null) usage.append(text.costUnknown);
    else {
      const usd = formatUsd(cost);
      if (usd === null) usage.append(el("b", undefined, text.costBelowMin));
      else usage.append(text.costBefore, el("b", undefined, usd));
      usage.append(text.costAfter(GROOVING_PRICES_AS_OF.slice(0, 7)));
    }
    hero.append(usage);

    const list = el("ol", "g-list");
    state.listed.forEach((track, index) => {
      const familiar = track.kind === GroovingTrackKind.Familiar;
      const row = el("li");
      const names = el("span", "g-t");
      names.append(el("b", undefined, track.title), el("span", undefined, artistsOf(track)));
      row.append(
        el("span", "g-n", String(index + 1)),
        art(track.thumbnailUrl, index + 1),
        names,
        el("span", familiar ? "g-k" : "g-k g-kn", familiar ? text.listFamiliar : text.listNew)
      );
      list.append(row);
    });

    const column = el("div", "g-list-column");
    column.append(list, buildKeepGoing(state));

    const grid = el("div", "g-done-grid");
    grid.append(hero, column);
    return [header(state.queueFailed ? text.queueFailedHint : text.doneHint), grid];
  }

  function buildFailed(state: ViewOf<typeof GroovingScreen.Failed>): Node[] {
    const failure = FAILURES[state.reason];
    // The search words are what was unusable in Collect, so the card does not talk about candidates
    const failureText =
      state.step === GroovingStep.Collect && state.reason === GroovingFailureReason.Unusable
        ? text.unusableCollect
        : text.failures(GROOVING_LLM_TIMEOUT_MS / 1000)[state.reason];
    const hint = state.round !== null && state.rounds !== null ? text.round(state.round, state.rounds) : "";
    const retryText = state.step === GroovingStep.Collect ? text.retryCollect : text.retryKeeps;
    const lead = state.reason === GroovingFailureReason.Unusable ? text.retriedLead(retryText) : retryText;

    const card = el("div", "g-fail g-glass");
    card.setAttribute("role", "alert");
    const actions = el("div", "g-acts");
    actions.append(
      button(text.retry, { className: "g-btn g-primary", focusKey: "retry", onPress: () => send({ type: "retry" }) }),
      failure.settings
        ? button(text.settings, { icon: "settings", focusKey: "settings", onPress: openSettings })
        : button(text.close, { focusKey: "close-failed", onPress: () => send({ type: "close" }) })
    );
    card.append(icon(failure.icon, "g-ic"), el("h2", undefined, failureText.title), el("p", undefined, failureText.text), actions);

    const column = el("div");
    column.append(el("div", "g-cap", text.failedStep[state.step]), card);
    const fails = el("div", "g-fails");
    fails.append(column);
    return [header(hint), el("h1", "g-big", text.failedTitle), el("p", "g-lead", lead), fails];
  }

  function build(state: GroovingViewState): Node[] {
    switch (state.screen) {
      case GroovingScreen.Closed:
        return [];
      case GroovingScreen.KeyMissing:
        return buildKeyMissing(state);
      case GroovingScreen.Consent:
        return buildConsent(state);
      case GroovingScreen.Setup:
        return buildSetup(state);
      case GroovingScreen.Working:
        return buildWorking(state);
      case GroovingScreen.Choose:
        return buildChoose(state);
      case GroovingScreen.Done:
        return buildDone(state);
      case GroovingScreen.Failed:
        return buildFailed(state);
      default:
        return [];
    }
  }

  function rememberFocus(): FocusMemory | null {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !panel.contains(active)) return null;
    const key = active.dataset.focusKey ?? "";
    if (active instanceof HTMLInputElement) return { key, selectionStart: active.selectionStart, selectionEnd: active.selectionEnd };
    return { key, selectionStart: null, selectionEnd: null };
  }

  function restoreFocus(memory: FocusMemory | null) {
    if (!memory || element.hidden) return;
    const target = Array.from(panel.querySelectorAll<HTMLElement>("[data-focus-key]")).find(node => node.dataset.focusKey === memory.key);
    if (!target) {
      panel.focus({ preventScroll: true });
      return;
    }
    target.focus({ preventScroll: true });
    if (target instanceof HTMLInputElement && memory.selectionStart !== null) target.setSelectionRange(memory.selectionStart, memory.selectionEnd);
  }

  function tickPreview() {
    if (!preview || !previewClock) return;
    const elapsed = Math.min((Date.now() - preview.startedAt) / 1000, GROOVING_PREVIEW_SECONDS);
    previewClock.textContent = `${formatSeconds(elapsed)} / ${formatSeconds(GROOVING_PREVIEW_SECONDS)}`;
  }

  function updatePreview(state: GroovingViewState) {
    const videoId = state.screen === GroovingScreen.Choose ? state.previewing : null;
    if (videoId === null) preview = null;
    else if (preview?.videoId !== videoId) preview = { videoId, startedAt: Date.now() };
  }

  // The same pair can arrive again (e.g. previewing goes back to null), and that must not undo `answered`
  function samePair(prev: GroovingViewState, next: GroovingViewState): boolean {
    return (
      prev.screen === GroovingScreen.Choose &&
      next.screen === GroovingScreen.Choose &&
      prev.round === next.round &&
      prev.left.videoId === next.left.videoId &&
      prev.right.videoId === next.right.videoId
    );
  }

  function render(state: GroovingViewMessage) {
    if (!samePair(current, state)) answered = false;
    // Main drops the answer of a hidden run, so an answer given while hidden is taken again when the screen comes back.
    // A pair that stays shown (e.g. previewing goes back to null) keeps it as before.
    if (state.visibility !== GroovingVisibility.Shown || current.visibility !== GroovingVisibility.Shown) answered = false;
    current = state;
    text = GROOVING_TEXT[state.language];
    // Chromium's word-break: auto-phrase works only when the content's language is ja
    element.lang = state.language;
    if (state.screen !== GroovingScreen.Setup) setup = newSetupMemory();
    updatePreview(state);

    if (previewTimer !== null) {
      window.clearInterval(previewTimer);
      previewTimer = null;
    }
    previewClock = null;

    const focus = rememberFocus();
    panel.replaceChildren(...build(state));
    element.hidden = state.visibility !== GroovingVisibility.Shown;
    restoreFocus(focus);

    if (preview && previewClock) {
      tickPreview();
      previewTimer = window.setInterval(tickPreview, PREVIEW_CLOCK_INTERVAL_MS);
    }
  }

  return { element, render };
}
