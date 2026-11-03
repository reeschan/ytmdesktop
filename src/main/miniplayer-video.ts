import log from "electron-log";
import type { AppView } from "./services/windowmanager/appview";
import type { AppWindow, AppWindowType } from "./services/windowmanager/appwindow";
import type PlayerStateStore from "./services/playerstatestore";
import { PlayerState, VideoType } from "~shared/playerstatestore/types";
import { MiniplayerVideoIpc, MiniplayerVideoStep, miniplayerVideoBounds, nextMiniplayerVideoStep } from "~shared/miniplayer-video";

export type MiniplayerVideoOptions = {
  // The view that plays the songs, undefined when it is not created yet
  ytmView: AppView | undefined;
  // The window the view is attached to while it is not in the miniplayer
  mainWindow: AppWindow<AppWindowType>;
  miniplayerWindow: AppWindow<AppWindowType>;
  playerStateStore: PlayerStateStore;
  // Runs when the miniplayer closes, after the view is back in the main window
  onClose: () => void;
};

/**
 * Moves the YTM view into the miniplayer while a song with a moving picture plays, and back to the main window otherwise.
 * The first close of the miniplayer is held until the view is back, the close is not held while the app quits.
 * Stops on its own once the miniplayer really closes.
 */
export function startMiniplayerVideo(options: MiniplayerVideoOptions) {
  const { ytmView: view, mainWindow, miniplayerWindow, playerStateStore, onClose } = options;
  const electronMiniplayerWindow = miniplayerWindow._getElectronWindow();
  const miniplayerWebContents = miniplayerWindow.webContents;

  // Id of the song whose video was last moved into view
  let mountedId: string | null = null;
  // Set when the miniplayer starts closing, from then on the view only goes back
  let closing = false;
  // Set once the view is back, so the next close goes through
  let closeAllowed = false;
  let stopped = false;
  let queue: Promise<void> = Promise.resolve();

  // Runs the tasks one after another, so a step never starts while another one runs
  const enqueue = (task: () => void) => {
    queue = queue.then(task).catch((error: unknown) => {
      log.warn("Failed to update the miniplayer video", error);
    });
    return queue;
  };

  const liveWebContents = () => {
    const webContents = view?.webContents;
    return webContents && !webContents.isDestroyed() ? webContents : null;
  };

  const decideStep = (state: PlayerState) =>
    nextMiniplayerVideoStep({
      open: !closing && !stopped,
      videoType: state.videoDetails?.videoType ?? VideoType.Unknown,
      videoId: state.videoDetails?.id ?? "",
      mountedId,
      attachedToMiniplayer: !!view && view.getParentWindow() === miniplayerWindow
    });

  const mount = (videoId: string) => {
    const webContents = liveWebContents();
    // A recreated view starts with background throttling on, so it is turned off on every mount
    webContents?.setBackgroundThrottling(false);
    webContents?.send(MiniplayerVideoIpc.Mount);
    mountedId = videoId;
  };

  const release = (ytmView: AppView) => {
    const webContents = liveWebContents();
    webContents?.send(MiniplayerVideoIpc.Release);
    ytmView.setBoundsCalculator(null, false);
    webContents?.setBackgroundThrottling(true);
    // Index 0 puts it below the app view, the background video view moves itself below it when it is attached
    mainWindow.attachView(ytmView, 0);
    mountedId = null;
  };

  const runStep = () => {
    if (!view || stopped) return;

    const state = playerStateStore.getState();
    const videoId = state.videoDetails?.id ?? "";
    const step = decideStep(state);
    if (step === MiniplayerVideoStep.AttachAndMount) {
      // Set before attaching, attaching applies the bounds
      view.setBoundsCalculator(miniplayerVideoBounds, false);
      miniplayerWindow.attachView(view, 0);
      mount(videoId);
    } else if (step === MiniplayerVideoStep.Remount) {
      mount(videoId);
    } else if (step === MiniplayerVideoStep.Release) {
      release(view);
    }
  };

  const stateChangedListener = (state: PlayerState) => {
    if (decideStep(state) !== MiniplayerVideoStep.None) void enqueue(runStep);
  };

  // A new page has no video moved yet, so the remembered id is dropped and the step decided again
  const pageReplacedListener = () => {
    mountedId = null;
    void enqueue(runStep);
  };

  const closeListener = (event: Electron.Event) => {
    if (closeAllowed) {
      onClose();
      return;
    }

    event.preventDefault();
    if (closing) return;
    closing = true;
    void enqueue(runStep).finally(() => {
      closeAllowed = true;
      if (!stopped) miniplayerWindow.closeWindow();
    });
  };

  // Runs after the close listener of the window, so a close that was held is seen as prevented
  const windowCloseListener = (event: Electron.Event) => {
    if (event.defaultPrevented) return;
    stop();
  };

  // Runs before the window destroys itself without a close, while the view can still be detached from it
  const rendererGoneListener = () => {
    if (stopped) return;
    stop();
    // The queued tasks only run synchronous steps, so none is halfway through here
    try {
      if (view && view.getParentWindow() === miniplayerWindow) release(view);
    } catch (error: unknown) {
      // Not thrown on, so the listeners after this one still run
      log.warn("Failed to move the YTM view back to the main window", error);
    }
  };

  // The window is already destroyed here, so the view can no longer be detached from it
  const windowClosedListener = () => {
    if (stopped) return;
    stop();
    if (view && view.getParentWindow() === miniplayerWindow) log.warn("The miniplayer closed while the YTM view was still attached to it");
  };

  function stop() {
    stopped = true;
    playerStateStore.off("state-changed", stateChangedListener);
    view?.off("recreated", pageReplacedListener);
    view?.off("ready", pageReplacedListener);
    miniplayerWindow.off("electronwindow-close", closeListener);
    electronMiniplayerWindow.off("close", windowCloseListener);
    electronMiniplayerWindow.off("closed", windowClosedListener);
    miniplayerWebContents?.off("render-process-gone", rendererGoneListener);
  }

  playerStateStore.on("state-changed", stateChangedListener);
  view?.on("recreated", pageReplacedListener);
  view?.on("ready", pageReplacedListener);
  miniplayerWindow.on("electronwindow-close", closeListener);
  electronMiniplayerWindow.on("close", windowCloseListener);
  // A close does not come when the window is destroyed (for example after its renderer crashes), only closed does
  electronMiniplayerWindow.on("closed", windowClosedListener);
  // Put before the listener of the window that destroys it, so the view goes back first
  miniplayerWebContents?.prependListener("render-process-gone", rendererGoneListener);

  // Decided once right away, no state change arrives while the song is paused
  void enqueue(runStep);
}
