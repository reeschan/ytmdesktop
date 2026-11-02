import { app, BaseWindow, WebContentsView } from "electron";
import fs from "node:fs";
import path from "node:path";
import log from "electron-log";
import { DependencyConstructor } from "~shared/types";
import { MemoryStoreSchema } from "~shared/store/schema";
import {
  BackgroundVideoDecision,
  BackgroundVideoPlayback,
  BackgroundVideoViewState,
  decideBackgroundVideo,
  WindowVisibility,
  YtmBackground
} from "~shared/background-video";
import { ColorItem } from "~shared/theme";
import Service from "../service";
import ConfigStore from "../configstore";
import MemoryStore from "../memorystore";
import AppWindowManager from "../windowmanager";
import YTMViewManager from "../ytmviewmanager";
import ThemeManager from "../thememanager";
import { BACKGROUND_VIDEO_FILE_HOST } from "../protocolmanager";
import { AppView } from "../windowmanager/appview";
import { AppWindow, AppWindowType } from "../windowmanager/appwindow";

declare const ALL_WINDOWS_VITE_DEV_SERVER_URL: string;

const BACKGROUND_VIDEO_VIEW_NAME = "BackgroundVideo";
const STATE_CHANNEL = "backgroundVideo:state";
const REQUEST_STATE_CHANNEL = "backgroundVideo:requestState";
const VIDEO_FILE_POLL_INTERVAL_MS = 1000;
const TRANSPARENT_BACKGROUND_COLOR = "#00000000";
// Host of the pages the YTM view is made transparent on (other pages, for example the Google sign-in, stay opaque)
const YTM_HOST = "music.youtube.com";

// Elements of YouTube Music that paint their own background (checked on music.youtube.com on 2026-11-02,
// #mini-guide-background and #player-bar-background were found while signed in)
// Each selector repeats itself so it is more specific than the !important theme rules and wins whichever is inserted last
const YTM_TRANSPARENT_SELECTORS = [
  "html:root",
  "body:is(body)",
  "ytmusic-app:is(ytmusic-app)",
  "ytmusic-app-layout:is(ytmusic-app-layout)",
  "#nav-bar-background#nav-bar-background",
  "#guide-wrapper#guide-wrapper",
  "#mini-guide-background#mini-guide-background",
  "#player-bar-background#player-bar-background",
  "ytmusic-player-bar:is(ytmusic-player-bar)",
  "ytmusic-browse-response:is(ytmusic-browse-response)"
];
const YTM_TRANSPARENT_VARIABLE_SELECTORS = ["html:root", "ytmusic-app:is(ytmusic-app)"];
const YTM_TRANSPARENT_CSS = [
  `${YTM_TRANSPARENT_SELECTORS.join(", ")} { background: transparent !important; }`,
  `${YTM_TRANSPARENT_VARIABLE_SELECTORS.join(", ")} { --ytmusic-background: transparent !important; }`
].join("\n");

type YTMBackgroundUpdate = {
  // Whether a new document was loaded, which drops any CSS inserted into the previous one
  documentLoaded: boolean;
  // Whether to insert the CSS again so it comes after CSS inserted since (for example rules as specific as it)
  reinsert: boolean;
  // Whether the theme colors changed, so an opaque background takes the new background color
  colorsChanged: boolean;
};

const PLAIN_UPDATE: YTMBackgroundUpdate = { documentLoaded: false, reinsert: false, colorsChanged: false };

function isFile(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * Whether the URL points at the host (an URL that cannot be parsed matches no host)
 */
function hasHost(url: string, host: string): boolean {
  try {
    return new URL(url).hostname === host;
  } catch {
    return false;
  }
}

export default class BackgroundVideoManager extends Service {
  public static override readonly dependencies: DependencyConstructor<Service>[] = [
    ConfigStore,
    MemoryStore<MemoryStoreSchema>,
    AppWindowManager,
    YTMViewManager,
    ThemeManager
  ];

  private view: AppView | null = null;
  private mainWindow: AppWindow<AppWindowType> | null = null;
  private electronWindow: BaseWindow | null = null;
  private ytmView: AppView | null = null;

  private decision: BackgroundVideoDecision = { video: BackgroundVideoPlayback.NotShown, ytmBackground: YtmBackground.Theme };
  private fullscreen = false;
  private fileFound = false;
  private fileMissing: boolean | null = null;
  // Changes whenever the view has to load the video again (for example another file was chosen)
  private sourceToken = Date.now();

  private watchedFilePath: string | null = null;
  private configListener: ReturnType<ConfigStore["onDidChange"]> | null = null;

  private ytmCssKey: string | null = null;
  private ytmBackgroundTransparent = false;
  // YTM background changes run one after another so an inserted CSS key is never lost
  private ytmQueue: Promise<void> = Promise.resolve();

  private videoFileListener = (current: fs.Stats, previous: fs.Stats) => {
    const fileFound = isFile(this.watchedFilePath ?? "");
    if (fileFound && (!this.fileFound || current.mtimeMs !== previous.mtimeMs)) this.sourceToken = Date.now();
    this.fileFound = fileFound;
    this.update();
  };

  private windowStateListener = () => {
    this.update();
  };

  private colorsChangedListener = () => {
    this.update();
    this.applyYTMBackground({ documentLoaded: false, reinsert: false, colorsChanged: true });
  };

  private ytmThemeAppliedListener = () => {
    this.applyYTMBackground({ documentLoaded: false, reinsert: true, colorsChanged: false });
  };

  private ytmStatusChangedListener = () => {
    this.attachYTMView();
  };

  private ytmViewRecreatedListener = () => {
    // The recreated YTM view is attached again at the bottom, so this view is moved back below it
    if (this.mainWindow && this.view && this.view.getParentWindow() === this.mainWindow) {
      this.mainWindow.detachView(this.view);
      this.mainWindow.attachView(this.view, 0);
    }

    this.fullscreen = false;
    // The recreated view has a new webContents with the default background and no inserted CSS
    this.ytmBackgroundTransparent = false;
    this.applyYTMBackground({ documentLoaded: true, reinsert: false, colorsChanged: false });
    this.update();
  };

  private ytmViewReadyListener = () => {
    this.applyYTMBackground({ documentLoaded: true, reinsert: false, colorsChanged: false });
  };

  private ytmEnterFullscreenListener = () => {
    this.fullscreen = true;
    this.update();
  };

  private ytmLeaveFullscreenListener = () => {
    this.fullscreen = false;
    this.update();
  };

  private requestStateListener = () => {
    this.sendState();
  };

  public override onPreInitialized() {}

  public override onInitialized() {
    const configStore = this.getDependency(ConfigStore);
    const ytmViewManager = this.getDependency(YTMViewManager);
    const themeManager = this.getDependency(ThemeManager);

    this.updateVideoFileWatch();

    this.configListener = configStore.onDidChange("appearance", (newState, oldState) => {
      if (
        newState?.backgroundVideoEnabled === oldState?.backgroundVideoEnabled &&
        newState?.backgroundVideoPath === oldState?.backgroundVideoPath &&
        newState?.backgroundVideoMaskOpacity === oldState?.backgroundVideoMaskOpacity &&
        newState?.backgroundVideoMaskBlur === oldState?.backgroundVideoMaskBlur
      )
        return;

      if (newState?.backgroundVideoEnabled !== oldState?.backgroundVideoEnabled || newState?.backgroundVideoPath !== oldState?.backgroundVideoPath) {
        this.sourceToken = Date.now();
      }
      this.updateVideoFileWatch();
      this.update();
    });

    themeManager.on("colors-changed", this.colorsChangedListener);
    themeManager.on("ytm-theme-applied", this.ytmThemeAppliedListener);

    // The YTM view is created after the services are initialized, so it is attached once the manager reports a status for it
    ytmViewManager.on("status-changed", this.ytmStatusChangedListener);
    ytmViewManager.on("view-recreated", this.ytmViewRecreatedListener);

    this.update();

    log.info("BackgroundVideoManager initialized");
  }

  public override onPostInitialized() {}

  public override onTerminated() {
    const ytmViewManager = this.getDependency(YTMViewManager);
    const themeManager = this.getDependency(ThemeManager);

    themeManager.off("colors-changed", this.colorsChangedListener);
    themeManager.off("ytm-theme-applied", this.ytmThemeAppliedListener);
    ytmViewManager.off("status-changed", this.ytmStatusChangedListener);
    ytmViewManager.off("view-recreated", this.ytmViewRecreatedListener);
    this.detachYTMView();

    if (this.electronWindow) {
      if (!this.electronWindow.isDestroyed()) {
        this.electronWindow.off("minimize", this.windowStateListener);
        this.electronWindow.off("restore", this.windowStateListener);
        this.electronWindow.off("hide", this.windowStateListener);
        this.electronWindow.off("show", this.windowStateListener);
      }
      this.electronWindow = null;
    }
    this.mainWindow = null;
    this.view?.ipcOff(REQUEST_STATE_CHANNEL, this.requestStateListener);

    if (this.configListener) {
      this.configListener();
      this.configListener = null;
    }
    if (this.watchedFilePath !== null) {
      fs.unwatchFile(this.watchedFilePath, this.videoFileListener);
      this.watchedFilePath = null;
    }
  }

  /**
   * Creates the background video view and attaches it below every view already attached to the window
   */
  public attachToMainWindow(mainWindow: AppWindow<AppWindowType>) {
    if (this.view) throw new Error("The background video view is already attached");

    const configStore = this.getDependency(ConfigStore);

    this.view = new AppView({
      name: BACKGROUND_VIDEO_VIEW_NAME,
      url: app.isPackaged ? "ytmd-app://background-video" : ALL_WINDOWS_VITE_DEV_SERVER_URL + "/windows/background-video/index.html",
      autoRecreate: true,
      viewState: {
        autoResize: {
          width: true,
          height: true,
          offsetHeight: {
            anchor: "Bottom",
            pixels: 36
          }
        }
      },
      electronOptions: {
        webPreferences: {
          transparent: true,
          sandbox: true,
          contextIsolation: true,
          preload: path.join(__dirname, `../renderer/windows/background-video/preload.cjs`),
          devTools: !app.isPackaged ? true : configStore.get("developer.enableDevTools")
        }
      }
    });
    this.view.ipcOn(REQUEST_STATE_CHANNEL, this.requestStateListener);
    mainWindow.attachView(this.view, 0);

    this.mainWindow = mainWindow;
    this.electronWindow = mainWindow._getElectronWindow();
    this.electronWindow.on("minimize", this.windowStateListener);
    this.electronWindow.on("restore", this.windowStateListener);
    this.electronWindow.on("hide", this.windowStateListener);
    this.electronWindow.on("show", this.windowStateListener);

    this.attachYTMView();
    this.update();
  }

  private getWindowVisibility(): WindowVisibility {
    if (this.fullscreen) return WindowVisibility.Fullscreen;
    if (this.electronWindow && !this.electronWindow.isDestroyed() && (this.electronWindow.isMinimized() || !this.electronWindow.isVisible())) {
      return WindowVisibility.Hidden;
    }

    return WindowVisibility.Visible;
  }

  private update() {
    const configStore = this.getDependency(ConfigStore);
    const memoryStore = this.getDependency(MemoryStore<MemoryStoreSchema>);

    const enabled = configStore.get("appearance.backgroundVideoEnabled");
    const previousYTMBackground = this.decision.ytmBackground;
    this.decision = decideBackgroundVideo({ enabled, fileFound: this.fileFound, window: this.getWindowVisibility() });

    // The path is kept when the file is missing so the video comes back once the file does
    const fileMissing = this.watchedFilePath !== null && !this.fileFound;
    if (fileMissing !== this.fileMissing) {
      this.fileMissing = fileMissing;
      memoryStore.set("backgroundVideoFileMissing", fileMissing);
    }

    if (this.decision.ytmBackground !== previousYTMBackground) this.applyYTMBackground(PLAIN_UPDATE);
    this.sendState();
  }

  private getState(): BackgroundVideoViewState {
    const configStore = this.getDependency(ConfigStore);
    const themeManager = this.getDependency(ThemeManager);

    return {
      playback: this.decision.video,
      src: this.decision.video === BackgroundVideoPlayback.NotShown ? null : `ytmd-app://${BACKGROUND_VIDEO_FILE_HOST}/${this.sourceToken}`,
      maskOpacity: configStore.get("appearance.backgroundVideoMaskOpacity"),
      maskBlur: configStore.get("appearance.backgroundVideoMaskBlur"),
      maskColor: themeManager.getColors()[ColorItem.Background]
    };
  }

  private sendState() {
    const contents = this.view?.webContents;
    if (!contents || contents.isDestroyed()) return;

    contents.send(STATE_CHANNEL, this.getState());
  }

  private updateVideoFileWatch() {
    const configStore = this.getDependency(ConfigStore);
    const filePath = configStore.get("appearance.backgroundVideoEnabled") ? configStore.get("appearance.backgroundVideoPath") || null : null;

    if (filePath !== this.watchedFilePath) {
      if (this.watchedFilePath !== null) fs.unwatchFile(this.watchedFilePath, this.videoFileListener);
      this.watchedFilePath = filePath;
      // watchFile also reports the file disappearing and coming back
      if (filePath !== null) fs.watchFile(filePath, { interval: VIDEO_FILE_POLL_INTERVAL_MS }, this.videoFileListener);
    }

    this.fileFound = filePath !== null && isFile(filePath);
  }

  private attachYTMView() {
    const view = this.getDependency(YTMViewManager).getView() ?? null;
    if (view === this.ytmView) return;

    this.detachYTMView();
    this.ytmView = view;
    this.ytmView?.on("ready", this.ytmViewReadyListener);
    this.ytmView?.on("webcontents-enter-html-full-screen", this.ytmEnterFullscreenListener);
    this.ytmView?.on("webcontents-leave-html-full-screen", this.ytmLeaveFullscreenListener);

    this.ytmCssKey = null;
    this.ytmBackgroundTransparent = false;
    this.fullscreen = false;
    this.applyYTMBackground(PLAIN_UPDATE);
  }

  private detachYTMView() {
    if (!this.ytmView) return;

    this.ytmView.off("ready", this.ytmViewReadyListener);
    this.ytmView.off("webcontents-enter-html-full-screen", this.ytmEnterFullscreenListener);
    this.ytmView.off("webcontents-leave-html-full-screen", this.ytmLeaveFullscreenListener);
    this.ytmView = null;
  }

  private getYTMElectronView(): WebContentsView | null {
    try {
      return this.ytmView?._getElectronView() ?? null;
    } catch {
      // The view is destroyed
      return null;
    }
  }

  private applyYTMBackground(options: YTMBackgroundUpdate) {
    this.ytmQueue = this.ytmQueue
      .then(async () => {
        if (options.documentLoaded) this.ytmCssKey = null;

        const electronView = this.getYTMElectronView();
        const contents = electronView?.webContents;
        if (!electronView || !contents || contents.isDestroyed()) return;

        // Pages the view navigates to outside YouTube Music (for example the sign-in) keep their own opaque background
        const transparent = this.decision.ytmBackground === YtmBackground.Transparent && hasHost(contents.getURL(), YTM_HOST);
        if (transparent) {
          if (!this.ytmBackgroundTransparent) {
            electronView.setBackgroundColor(TRANSPARENT_BACKGROUND_COLOR);
            this.ytmBackgroundTransparent = true;
          }
          if (this.ytmCssKey !== null && !options.reinsert) return;

          // The new CSS is inserted before the old one is removed so the background never shows in between
          const previousKey = this.ytmCssKey;
          this.ytmCssKey = await contents.insertCSS(YTM_TRANSPARENT_CSS);
          if (previousKey !== null) await this.removeYTMCss(previousKey);
          return;
        }

        if (this.ytmCssKey !== null) {
          const key = this.ytmCssKey;
          this.ytmCssKey = null;
          await this.removeYTMCss(key);
        }
        if (this.ytmBackgroundTransparent || options.colorsChanged) {
          // A view created without a background color is opaque, so the theme background stands in for it
          electronView.setBackgroundColor(this.getDependency(ThemeManager).getNativeColors()[ColorItem.Background]);
          this.ytmBackgroundTransparent = false;
        }
      })
      .catch(error => {
        log.error("BackgroundVideoManager failed to update the YTM background", error);
      });
  }

  private async removeYTMCss(key: string) {
    const contents = this.getYTMElectronView()?.webContents;
    if (!contents || contents.isDestroyed()) return;

    try {
      await contents.removeInsertedCSS(key);
    } catch (error) {
      // The key may belong to a document that was replaced while this change was running
      log.debug("BackgroundVideoManager could not remove the previous YTM background CSS", error);
    }
  }
}
