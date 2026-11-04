import { YTMViewSetupCompletionFlags } from "~shared/types";
import initPlayerStateStore, { waitForYTMPlayerApiReady } from "./playerstatestore";
import ytmhook from "./ytmhook";
import protectedapimanager from "./protectedapimanager";
import { createMaterialSymbolsLink, createStyleSheet } from "./setup/styles";
import { createNavigationMenuArrows } from "./setup/navigation";
import initRemote from "./setup/remote";
import { initBackgroundVideo } from "./setup/background-video";
import { createSongRecognitionButton } from "./setup/song-recognition";
import { setupGrooving } from "./setup/grooving";
import { addTimedLyrics, createAdditionalPlayerBarControls, hideChromecastButton, overrideHistoryButtonDisplay } from "./setup/extras";

protectedapimanager.init();
ytmhook.init();

window.addEventListener("load", async () => {
  let setupCompletions = 0;
  try {
    {
      await ytmhook.ready();
      window.__YTMD_HOOK__ = Object.freeze({
        ytmPlayerController: ytmhook.ytmPlayerController,
        ytmStateStore: ytmhook.ytmStateStore
      });

      setupCompletions |= YTMViewSetupCompletionFlags.Early;
    }

    {
      createStyleSheet();
      const materialSymbols = createMaterialSymbolsLink();
      let materialSymbolsLoaded = false;
      materialSymbols.onload = () => {
        materialSymbolsLoaded = true;
      };
      document.head.appendChild(materialSymbols);

      await new Promise<void>(resolve => {
        const interval = setInterval(async () => {
          if (materialSymbolsLoaded) {
            clearInterval(interval);
            resolve();
          }
        }, 250);
      });

      setupCompletions |= YTMViewSetupCompletionFlags.Styles;
    }

    {
      createNavigationMenuArrows();

      setupCompletions |= YTMViewSetupCompletionFlags.Navigation;
    }

    {
      await waitForYTMPlayerApiReady();
      initPlayerStateStore();

      setupCompletions |= YTMViewSetupCompletionFlags.Hooks;
    }

    {
      // The background video is optional, so its failure does not stop the rest of the setup
      try {
        initBackgroundVideo();
      } catch (error) {
        console.error("Failed to set up the background video", error);
      }
    }

    {
      // The song recognition button is optional, so its failure does not stop the rest of the setup
      try {
        createSongRecognitionButton();
      } catch (error) {
        console.error("Failed to set up the song recognition button", error);
      }
    }

    {
      // Grooving is optional, so its failure does not stop the rest of the setup
      try {
        setupGrooving();
      } catch (error) {
        console.error("Failed to set up Grooving", error);
      }
    }

    {
      initRemote();

      setupCompletions |= YTMViewSetupCompletionFlags.Remote;
    }

    {
      overrideHistoryButtonDisplay();
      hideChromecastButton();
      createAdditionalPlayerBarControls(); // Sort of broken as of new YTM player bar (10/03/26)
      addTimedLyrics();

      setupCompletions |= YTMViewSetupCompletionFlags.Extras;
    }
  } catch (error) {
    window.postMessage(
      {
        op: "ytmd-errored",
        error
      },
      "/"
    );
  } finally {
    window.postMessage(
      {
        op: "ytmd-ready",
        completions: setupCompletions
      },
      "/"
    );
  }
});
