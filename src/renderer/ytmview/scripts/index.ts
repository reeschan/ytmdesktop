import { YTMViewSetupCompletionFlags } from "~shared/types";
import { DEFAULT_FONT_TIMEOUT_MS, DEFAULT_POLL_INTERVALS, DEFAULT_STARTUP_TIMEOUT_MS, pollUntil, withTimeout, YtmStartupMessage } from "~shared/ytm-startup";
import initPlayerStateStore, { waitForYTMPlayerApiReady } from "./playerstatestore";
import ytmhook from "./ytmhook";
import protectedapimanager from "./protectedapimanager";
import { createMaterialSymbolsLink, createStyleSheet } from "./setup/styles";
import { createNavigationMenuArrows } from "./setup/navigation";
import initRemote from "./setup/remote";
import { initBackgroundVideo } from "./setup/background-video";
import { initMiniplayerVideo } from "./setup/miniplayer-video";
import { createSongRecognitionButton } from "./setup/song-recognition";
import { setupGrooving } from "./setup/grooving";
import { addTimedLyrics, createAdditionalPlayerBarControls, hideChromecastButton, overrideHistoryButtonDisplay } from "./setup/extras";

protectedapimanager.init();
ytmhook.init();

function createStartupReport() {
  let completions = 0;
  let sentCompletions = 0;
  let ready = false;
  return {
    add(flag: YTMViewSetupCompletionFlags) { completions |= flag; },
    error(error: unknown) { window.postMessage({ op: YtmStartupMessage.Errored, error }, "/"); },
    ready() {
      if (ready) return;
      ready = true;
      sentCompletions = completions;
      window.postMessage({ op: YtmStartupMessage.Ready, completions }, "/");
    },
    flush() {
      if (!ready || sentCompletions === completions) return;
      sentCompletions = completions;
      window.postMessage({ op: YtmStartupMessage.SetupUpdated, completions }, "/");
    }
  };
}

function waitForFont(link: HTMLLinkElement, timeoutMs: number): Promise<boolean> {
  return new Promise(resolve => {
    const finish = (loaded: boolean) => {
      clearTimeout(timer);
      link.onload = null;
      link.onerror = null;
      resolve(loaded);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    link.onload = () => finish(true);
    link.onerror = () => finish(false);
  });
}

window.addEventListener("load", async () => {
  const report = createStartupReport();
  const controller = new AbortController();
  window.addEventListener("pagehide", () => controller.abort(), { once: true });
  let setupStarted = false;
  const runHookedSetup = () => {
    if (setupStarted) return;
    setupStarted = true;
    initPlayerStateStore();
    report.add(YTMViewSetupCompletionFlags.Hooks);
    // Grooving is optional, so its failure does not stop the rest of the setup
    try {
      setupGrooving();
    } catch (error) {
      console.error("Failed to set up Grooving", error);
    }
    initRemote();
    report.add(YTMViewSetupCompletionFlags.Remote);
    overrideHistoryButtonDisplay();
    void hideChromecastButton();
    void createAdditionalPlayerBarControls();
    void addTimedLyrics();
    report.add(YTMViewSetupCompletionFlags.Extras);
  };

  try {
    createStyleSheet();
    const font = createMaterialSymbolsLink();
    const fontWait = waitForFont(font, DEFAULT_FONT_TIMEOUT_MS);
    document.head.appendChild(font);
    // Listens before the background video sends its first report, which makes the preload send the last miniplayer message again
    try {
      initMiniplayerVideo();
    } catch (error) {
      console.error("Failed to set up the miniplayer video", error);
    }
    try {
      initBackgroundVideo();
    } catch (error) {
      console.error("Failed to set up the background video", error);
    }

    if (await fontWait) report.add(YTMViewSetupCompletionFlags.Styles);
    else console.warn("Material Symbols did not load before the deadline");

    const hooked = (async () => {
      if (!await ytmhook.ready()) return false;
      window.__YTMD_HOOK__ = Object.freeze({
        ytmPlayerController: ytmhook.ytmPlayerController,
        ytmStateStore: ytmhook.ytmStateStore
      });
      report.add(YTMViewSetupCompletionFlags.Early);
      return waitForYTMPlayerApiReady(controller.signal);
    })();
    const hookedSetup = hooked.then(ready => {
      if (ready) runHookedSetup();
    }).finally(() => report.flush());
    const domController = new AbortController();
    const onPageHide = () => domController.abort();
    window.addEventListener("pagehide", onPageHide, { once: true });
    const domReady = pollUntil(() => Boolean(document.querySelector("ytmusic-search-box")), {
      ...DEFAULT_POLL_INTERVALS,
      signal: domController.signal
    }).then(found => {
      if (!found) return;
      createNavigationMenuArrows();
      report.add(YTMViewSetupCompletionFlags.Navigation);
      try {
        createSongRecognitionButton();
      } catch (error) {
        console.error("Failed to set up the song recognition button", error);
      }
    });
    const result = await withTimeout(Promise.all([hookedSetup, domReady]), DEFAULT_STARTUP_TIMEOUT_MS);
    domController.abort();
    window.removeEventListener("pagehide", onPageHide);
    if (!result.done) {
      console.warn("YTM setup did not finish before the deadline");
      void hookedSetup.catch(error => report.error(error));
    }
  } catch (error) {
    report.error(error);
  } finally {
    report.ready();
  }
});
