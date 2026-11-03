// IMPORTANT NOTES ABOUT THIS FILE
//
// This file contains all logic related to interacting with YTM itself and works under the assumption of a trusted environment and data.
// Anything passed to this file does not necessarily need to be or will be validated.
//
// If adding new things to this file ensure best security practices are followed.
// - executeJavaScript is used to enter the main world when you need to interact with YTM APIs or anything from YTM that would otherwise need the prototypes or events from YTM.
//   - Always wrap your executeJavaScript code in an IIFE calling it from outside executeJavaScript when it returns
// - Add functions to exposeInMainWorld when you need to call back to the main program. By nature you should not trust data coming from this.

// Early bail if the page isn't YTM. This could be an account login or something else
if (window.location.hostname !== "music.youtube.com") {
  throw new Error("[YTMDFastFail]: THIS IS NOT AN ERROR! Location not applicable bailing preload");
}

import { ipcRenderer, webFrame } from "electron";
import Store from "../store-ipc/store";
import { StoreSchema } from "~shared/store/schema";
import { BackgroundVideoIpc, BackgroundVideoMessage, YtmBackgroundReport, YtmBackgroundState } from "~shared/background-video";
import { MiniplayerVideoIpc, MiniplayerVideoMessage } from "~shared/miniplayer-video";
import { SongRecognitionIpc, SongRecognitionMessageOp, SongRecognitionViewState } from "~shared/song-recognition";
import { YtmStartupIpc, YtmStartupMessage } from "~shared/ytm-startup";
import { YTMViewSetupCompletionFlags } from "~shared/types";

import scriptsRaw from "./scripts?raw";

const store = new Store<StoreSchema>();

let backgroundVideoState: YtmBackgroundState | null = null;
let backgroundVideoPageListening = false;
function postBackgroundVideoState() {
  if (backgroundVideoState) window.postMessage({ op: BackgroundVideoMessage.State, state: backgroundVideoState }, "*");
}

ipcRenderer.on(BackgroundVideoIpc.State, (_event, state: YtmBackgroundState) => {
  backgroundVideoState = state;
  postBackgroundVideoState();
});

// The last miniplayer message is kept, the page scripts may not be listening yet when it arrives
let miniplayerVideoMessage: MiniplayerVideoMessage | null = null;
function postMiniplayerVideoMessage() {
  if (miniplayerVideoMessage) window.postMessage({ op: miniplayerVideoMessage }, "*");
}

ipcRenderer.on(MiniplayerVideoIpc.Mount, () => {
  miniplayerVideoMessage = MiniplayerVideoMessage.Mount;
  postMiniplayerVideoMessage();
});

ipcRenderer.on(MiniplayerVideoIpc.Release, () => {
  miniplayerVideoMessage = MiniplayerVideoMessage.Release;
  postMiniplayerVideoMessage();
});

let songRecognitionState: SongRecognitionViewState | null = null;
function postSongRecognitionState() {
  if (songRecognitionState) window.postMessage({ op: SongRecognitionMessageOp.State, state: songRecognitionState }, "*");
}

ipcRenderer.on(SongRecognitionIpc.State, (_event, state: SongRecognitionViewState) => {
  songRecognitionState = state;
  postSongRecognitionState();
});

ipcRenderer.on(SongRecognitionIpc.Search, (_event, query: string) => {
  window.postMessage({ op: SongRecognitionMessageOp.Search, query }, "*");
});

/**
 * Seeks the player once to the given position, as soon as the given video is ready to play.
 * Does nothing when the position is not a positive number, when the player is unavailable, or when another video is loaded first.
 */
async function seekVideoOnceReady(videoId: string, position: number) {
  if (!videoId || !Number.isFinite(position) || position <= 0) return;

  try {
    (
      await webFrame.executeJavaScript(`
      (function() {
        const playerApi = window.__YTMD_HOOK__?.ytmPlayerController?.playerApi;
        if (!playerApi) return;

        const targetVideoId = ${JSON.stringify(videoId)};
        const position = ${position};
        const PlayerState = { Playing: 1, Paused: 2, Cued: 5 };
        const readyStates = [PlayerState.Playing, PlayerState.Paused, PlayerState.Cued];

        // Returns true once the check is settled (seeked, or another video is loaded)
        const trySeek = playerState => {
          if (!readyStates.includes(playerState)) return false;
          const currentVideoId = playerApi.getPlayerResponse()?.videoDetails?.videoId;
          if (!currentVideoId) return false;
          if (currentVideoId === targetVideoId) playerApi.seekTo(position);
          return true;
        };

        try {
          if (trySeek(playerApi.getPlayerState())) return;
        } catch (err) {
          console.error("[ytmd-err(seekVideoOnceReady)]", err);
          return;
        }

        const onStateChange = playerState => {
          try {
            if (!trySeek(playerState)) return;
          } catch (err) {
            console.error("[ytmd-err(seekVideoOnceReady)]", err);
          }
          playerApi.removeEventListener("onStateChange", onStateChange);
        };
        playerApi.addEventListener("onStateChange", onStateChange);
      })
    `)
    )();
  } catch (err) {
    console.error("[ytmd-err(seekVideoOnceReady)]", err);
  }
}

let startupReadySeen = false;
let sessionRestoreStarted = false;

async function restoreLastSession() {
  try {
    const state = await store.get("state");
    const continueWhereYouLeftOff = (await store.get("playback")).continueWhereYouLeftOff;
    if (!continueWhereYouLeftOff) return;

    if (!window.location.pathname.startsWith("/watch")) {
      const getLoadedVideoId = await webFrame.executeJavaScript(`
        (function() {
          const playerApi = window.__YTMD_HOOK__?.ytmPlayerController?.playerApi;
          if (!playerApi) return undefined;
          return playerApi.getVideoData?.()?.video_id ?? null;
        })
      `);
      const loadedVideoId = getLoadedVideoId();
      if (loadedVideoId === undefined || loadedVideoId || !state.lastVideoId) return;
      document.dispatchEvent(
        new CustomEvent("yt-navigate", {
          detail: { endpoint: { watchEndpoint: { videoId: state.lastVideoId, playlistId: state.lastPlaylistId } } }
        })
      );
    }

    await seekVideoOnceReady(state.lastVideoId, state.lastVideoProgress ?? 0);
  } catch (err) {
    console.error("[ytmd-err(restoreLastSession)]", err);
  }
}

function onCompletions(completions: number) {
  if (!sessionRestoreStarted && (completions & YTMViewSetupCompletionFlags.Hooks) !== 0) {
    sessionRestoreStarted = true;
    void restoreLastSession();
  }
}

let protectedApiBound = false;
window.addEventListener("message", async event => {
  if (event.data === "ytmd-protected-api-port" && !protectedApiBound) {
    ipcRenderer.postMessage("protectedApi:bindPort", null, [...event.ports]);
    protectedApiBound = true;
  }

  if (event.data.op === YtmStartupMessage.Ready && typeof event.data.completions === "number" && !startupReadySeen) {
    startupReadySeen = true;
    ipcRenderer.send(YtmStartupIpc.Ready, event.data.completions);
    store.onDidAnyChange(newState => {
      if (newState.appearance.alwaysShowVolumeSlider) {
        const volumeSlider = document.querySelector("#volume-slider");
        if (volumeSlider && !volumeSlider.classList.contains("ytmd-persist-volume-slider")) {
          volumeSlider.classList.add("ytmd-persist-volume-slider");
        }
      } else {
        const volumeSlider = document.querySelector("#volume-slider");
        if (volumeSlider && volumeSlider.classList.contains("ytmd-persist-volume-slider")) {
          volumeSlider.classList.remove("ytmd-persist-volume-slider");
        }
      }
    });

    ipcRenderer.on("ytmView:executeScript", async (_event, script) => {
      (await webFrame.executeJavaScript(script))();
    });

    const alwaysShowVolumeSlider = (await store.get("appearance")).alwaysShowVolumeSlider;
    if (alwaysShowVolumeSlider) {
      document.querySelector("ytmusic-app-layout>ytmusic-player-bar #volume-slider")?.classList.add("ytmd-persist-volume-slider");
    }
    onCompletions(event.data.completions);
  }

  if (event.data.op === YtmStartupMessage.SetupUpdated && typeof event.data.completions === "number") {
    ipcRenderer.send(YtmStartupIpc.SetupUpdated, event.data.completions);
    onCompletions(event.data.completions);
  }

  if (event.data.op === YtmStartupMessage.Errored) {
    ipcRenderer.send(YtmStartupIpc.Errored, event.data.error);
  }

  if (event.data.op && event.data.op === BackgroundVideoMessage.Report) {
    const report: YtmBackgroundReport = {
      available: event.data.available === true,
      reducedMotion: event.data.reducedMotion === true
    };
    ipcRenderer.send(BackgroundVideoIpc.Report, report);

    // A state that arrived before the page scripts were listening is sent again once they first report
    if (!backgroundVideoPageListening) {
      backgroundVideoPageListening = true;
      postBackgroundVideoState();
      postMiniplayerVideoMessage();
    }
  }

  // Only the page's own main world may press; other frames (ads, embeds) are ignored
  if (event.source === window && event.data.op && event.data.op === SongRecognitionMessageOp.Press) {
    ipcRenderer.send(SongRecognitionIpc.Press);
  }

  // The page started listening, so the last state is sent again
  if (event.data.op && event.data.op === SongRecognitionMessageOp.Listening) {
    postSongRecognitionState();
  }
});

void webFrame.executeJavaScript(scriptsRaw);
