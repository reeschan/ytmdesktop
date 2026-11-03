import fs from "fs";
import log from "electron-log";

import Integration from "../integration";
import YTMViewManager from "../../services/ytmviewmanager";
import ConfigStore from "../../services/configstore";
import ThemeManager from "../../services/thememanager";

export default class CustomCSS extends Integration {
  public override name = "CustomCSS";
  public override storeEnableProperty: Integration["storeEnableProperty"] = "appearance.customCSSEnabled";
  public override disableFlags = ["disable_custom_css"];

  private injected = false;

  private customCSSKey: string | null = null;
  private storeListener: ReturnType<ConfigStore["onDidChange"]> | null = null;

  private currentWatcher: fs.FSWatcher | null = null;

  // Injections and removals run one after another so a key is never lost
  private cssQueue: Promise<void> = Promise.resolve();

  private ytmViewRecreatedListener = () => {
    void this.enqueue(async () => {
      this.injected = false;
      await this.injectCSSNow();
    });
  };

  // Custom CSS is inserted again after the theme so it keeps winning over it
  private ytmThemeAppliedListener = () => {
    void this.updateCSS();
  };

  public onSetup() {}

  public onEnabled(): void {
    const ytmViewManager = this.getService(YTMViewManager);
    const configStore = this.getService(ConfigStore);

    ytmViewManager.on("view-recreated", this.ytmViewRecreatedListener);
    this.getService(ThemeManager).on("ytm-theme-applied", this.ytmThemeAppliedListener);
    this.storeListener = configStore.onDidChange("appearance", (newState, oldState) => {
      if (newState === undefined || oldState === undefined) {
        void this.updateCSS();
      } else {
        if (newState && (newState.customCSSEnabled && newState.customCSSPath !== oldState.customCSSPath)) {
          void this.updateCSS();
        }
      }
    });

    void this.injectCSS();
  }

  public onDisabled(): void {
    const ytmViewManager = this.getService(YTMViewManager);

    ytmViewManager.off("view-recreated", this.ytmViewRecreatedListener);
    this.getService(ThemeManager).off("ytm-theme-applied", this.ytmThemeAppliedListener);
    if (this.currentWatcher) {
      this.currentWatcher.close();
      this.currentWatcher = null;
    }
    if (this.storeListener) {
      this.storeListener();
      this.storeListener = null;
    }

    void this.removeCSS();
  }

  public async updateCSS() {
    await this.enqueue(async () => {
      await this.removeCSSNow();
      await this.injectCSSNow();
    });
  }

  private enqueue(task: () => Promise<void>): Promise<void> {
    this.cssQueue = this.cssQueue.then(task).catch(error => {
      log.error("CustomCSS failed to update the custom CSS", error);
    });
    return this.cssQueue;
  }

  private injectCSS() {
    return this.enqueue(() => this.injectCSSNow());
  }

  private removeCSS() {
    return this.enqueue(() => this.removeCSSNow());
  }

  private async injectCSSNow() {
    if (this.injected) return;

    const ytmViewManager = this.getService(YTMViewManager);
    const configStore = this.getService(ConfigStore);

    const cssPath = configStore.get("appearance.customCSSPath");
    if (cssPath && fs.existsSync(cssPath)) {
      const content: string = fs.readFileSync(cssPath, "utf8");

      await ytmViewManager.ready();
      this.customCSSKey = await ytmViewManager.getView()?.webContents?.insertCSS(content) ?? null;
      this.injected = true;

      this.watchCSSFile(cssPath);
    }
  }

  private async removeCSSNow() {
    if (this.customCSSKey === null || !this.injected) return;

    const ytmViewManager = this.getService(YTMViewManager);

    await ytmViewManager.ready();
    try {
      await ytmViewManager.getView()?.webContents?.removeInsertedCSS(this.customCSSKey);
    } catch (error) {
      // A reloaded document no longer has the CSS of the previous key, so it is inserted again without removing it
      log.debug("CustomCSS could not remove the previous custom CSS", error);
    }

    this.customCSSKey = null;
    this.injected = false;
  }

  private watchCSSFile(newFile?: string) {
    // Reset the file listener if it exists
    if (this.currentWatcher) {
      this.currentWatcher.close();
      this.currentWatcher = null;
    }

    if (!newFile) return;

    // Watch for changes to the custom CSS file
    // and update the CSS when it changes
    this.currentWatcher = fs.watch(newFile, {}, (type, filename) => {
      if (type === "change") {
        void this.updateCSS();
      } else if (type === "rename") {
        if (filename) {
          const configStore = this.getService(ConfigStore);

          configStore.set("appearance.customCSSPath", null);
          void this.removeCSS();
          this.currentWatcher?.close();
        }
      }
    });
  }
}
