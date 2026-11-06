import { app, BrowserWindow, webContents, WebContents } from "electron";
import fs from "node:fs";
import log from "electron-log";
import { DependencyConstructor } from "~shared/types";
import { MemoryStoreSchema, ThemeSelection } from "~shared/store/schema";
import {
  BUNDLED_THEME_SURFACE_BLUR,
  BundledTheme,
  COLOR_ITEM_CSS_VARIABLES,
  COLOR_ITEMS,
  ColorItem,
  DEFAULT_THEME_COLORS,
  ResolvedTheme,
  resolveTheme,
  SURFACE_BLUR_CSS_VARIABLE,
  ThemeColors,
  ThemeSource,
  ThemeSourceKind,
  toCssVariables,
  toNativeColor
} from "~shared/theme";
import Service, { EventEmitterService } from "../service";
import ConfigStore from "../configstore";
import MemoryStore from "../memorystore";
import AppWindowManager from "../windowmanager";
import YTMViewManager from "../ytmviewmanager";
import PlayerStateStore from "../playerstatestore";
import { createJacketWatcher, JacketWatcher } from "./jacket";
import { AppView } from "../windowmanager/appview";

declare const ALL_WINDOWS_VITE_DEV_SERVER_URL: string;

export type ThemeManagerEventMap = {
  "colors-changed": [ThemeColors];
  "ytm-theme-applied": [];
};

const APP_PROTOCOL = "ytmd-app:";
// Doubled so the inserted values outrank the default values declared on :root by the app stylesheet, whatever the stylesheet order
const APP_THEME_SELECTOR = ":root:root";
const THEME_FILE_POLL_INTERVAL_MS = 1000;

type CssColorRule = {
  selector: string;
  declarations: { property: string; item: ColorItem }[];
};

// Color items mapped onto the color variables and the hardcoded backgrounds of YouTube Music
const YTM_THEME_RULES: CssColorRule[] = [
  {
    selector: "html, ytmusic-app",
    declarations: [
      { property: "--ytmusic-background", item: ColorItem.Background },
      { property: "--ytmusic-color-black4", item: ColorItem.Background },
      { property: "--ytmusic-color-black1", item: ColorItem.Surface },
      { property: "--ytmusic-brand-background-solid", item: ColorItem.Surface },
      { property: "--ytmusic-color-white1", item: ColorItem.Text }
    ]
  },
  {
    selector: "#nav-bar-background, #guide-wrapper",
    declarations: [{ property: "background", item: ColorItem.Background }]
  },
  {
    selector: "ytmusic-player-bar",
    declarations: [{ property: "background", item: ColorItem.Surface }]
  },
  {
    selector: "#progress-bar",
    declarations: [
      { property: "--paper-slider-active-color", item: ColorItem.Accent },
      { property: "--paper-slider-knob-color", item: ColorItem.Accent }
    ]
  }
];

type CssColorRuleOptions = {
  // Marks every declaration !important so it wins over rules with a higher specificity
  important: boolean;
};

// YouTube Music declares its variables on selectors more specific than html (for example html[dark])
const YTM_THEME_RULE_OPTIONS: CssColorRuleOptions = { important: true };

type CssSurfaceRule = {
  selectors: readonly string[];
  // The color item filling the surfaces
  fill: ColorItem;
  // The color item of the 1px line drawn inside the edges of the surfaces
  edge: ColorItem;
};

// Surfaces of YouTube Music that get a background (the bars, the guide, the menus and the dialogs), turned into frosted glass when the theme has a surface blur
// Only one element of each overlapping pair is listed so no surface gets the fill and the edge twice
// (for example #player-bar-background paints behind ytmusic-player-bar; #guide-wrapper and #mini-guide-background are never shown together)
const YTM_BLURRED_SURFACE_RULE: CssSurfaceRule = {
  selectors: [
    "#nav-bar-background",
    "#guide-wrapper",
    "#mini-guide-background",
    "#player-bar-background",
    "tp-yt-iron-dropdown ytmusic-menu-popup-renderer",
    "tp-yt-paper-dialog"
  ],
  fill: ColorItem.Surface,
  edge: ColorItem.Border
};

// The search suggestions open from the nav bar over the page, but a blur inside the nav bar does not reach the page behind it.
// With a blurred theme they are backed with the background color so the page does not show through them
const YTM_SEARCH_SUGGESTIONS_SELECTOR = "ytmusic-search-box #suggestion-list";

/**
 * References the CSS variable of a color item, so the rule follows the value declared on :root and moves with its transition
 */
function colorVariable(item: ColorItem): string {
  return `var(${COLOR_ITEM_CSS_VARIABLES[item]})`;
}

/**
 * Builds CSS rules whose declarations take their values from the color items
 */
function toCssColorRules(rules: CssColorRule[], options: CssColorRuleOptions): string {
  const priority = options.important ? " !important" : "";

  return rules
    .map(
      rule =>
        `${rule.selector} { ${rule.declarations.map(declaration => `${declaration.property}: ${colorVariable(declaration.item)}${priority};`).join(" ")} }`
    )
    .join("\n");
}

/**
 * Builds a CSS rule that fills the surfaces with a color, blurs what is drawn behind them by the given px and draws a 1px line inside their edges.
 * The line is an inset box-shadow so the layout does not change
 */
function toCssBlurredSurfaceRule(rule: CssSurfaceRule, blur: number, options: CssColorRuleOptions): string {
  const priority = options.important ? " !important" : "";
  const declarations = [
    `background: ${colorVariable(rule.fill)}${priority};`,
    `backdrop-filter: blur(${blur}px)${priority};`,
    `box-shadow: inset 0 0 0 1px ${colorVariable(rule.edge)}${priority};`
  ];

  return `${rule.selectors.join(", ")} { ${declarations.join(" ")} }`;
}

/**
 * Builds a CSS rule that fills the elements with the surface color laid over the background color
 */
function toCssBackedSurfaceRule(selector: string, options: CssColorRuleOptions): string {
  const priority = options.important ? " !important" : "";
  const surface = colorVariable(ColorItem.Surface);

  return `${selector} { background: linear-gradient(${surface}, ${surface}), ${colorVariable(ColorItem.Background)}${priority}; }`;
}

/**
 * Builds the CSS that lets the six color variables move smoothly: each is registered as a color, and the root moves them over 0.6s.
 * The transition is left out when the OS asks to reduce motion
 */
function buildJacketTransitionCss(): string {
  const registrations = COLOR_ITEMS.map(
    item => `@property ${COLOR_ITEM_CSS_VARIABLES[item]} { syntax: "<color>"; inherits: true; initial-value: ${DEFAULT_THEME_COLORS[item]}; }`
  );
  const transitions = COLOR_ITEMS.map(item => `${COLOR_ITEM_CSS_VARIABLES[item]} 0.6s ease`).join(", ");

  return [...registrations, `@media (prefers-reduced-motion: no-preference) { :root { transition: ${transitions}; } }`].join("\n");
}

function isBundledTheme(value: string): value is BundledTheme {
  return (Object.values(BundledTheme) as string[]).includes(value);
}

function sameColors(a: ThemeColors, b: ThemeColors): boolean {
  return COLOR_ITEMS.every(item => a[item] === b[item]);
}

type CssInjection = {
  key: string | null;
  // Injections into the same webContents run one after another so a key is never lost
  queue: Promise<void>;
};

export default class ThemeManager extends EventEmitterService<ThemeManagerEventMap> {
  public static override readonly dependencies: DependencyConstructor<Service>[] = [
    ConfigStore,
    MemoryStore<MemoryStoreSchema>,
    AppWindowManager,
    YTMViewManager,
    PlayerStateStore
  ];

  private colors: ThemeColors = { ...DEFAULT_THEME_COLORS };
  private surfaceBlur: number = BUNDLED_THEME_SURFACE_BLUR[BundledTheme.Default];
  // Whether the inserted CSS moves the colors over 0.6s, which is the case while the Jacket theme is selected
  private colorTransition: boolean = false;
  private jacketWatcher: JacketWatcher | null = null;
  private appInjections = new Map<WebContents, CssInjection>();
  private ytmInjection: CssInjection = { key: null, queue: Promise.resolve() };

  private watchedFilePath: string | null = null;
  private configListener: ReturnType<ConfigStore["onDidChange"]> | null = null;

  private themeFileListener = () => {
    this.reloadTheme();
  };

  private webContentsCreatedListener = (_event: Electron.Event, contents: WebContents) => {
    this.trackWebContents(contents);
  };

  private ytmView: AppView | null = null;

  // The view emits ready for every document it loads (including reloads and the recreated webContents), which drops the inserted CSS
  private ytmViewReadyListener = () => {
    this.ytmInjection.key = null;
    this.injectYTMTheme();
  };

  private ytmStatusChangedListener = () => {
    this.attachYTMView();
  };

  public override onPreInitialized() {}

  public override onInitialized() {
    const configStore = this.getDependency(ConfigStore);
    const ytmViewManager = this.getDependency(YTMViewManager);

    const theme = this.loadTheme();
    this.colors = theme.colors;
    this.surfaceBlur = theme.surfaceBlur;
    this.colorTransition = this.isJacketSelected();
    this.updateThemeFileWatch();

    this.jacketWatcher = createJacketWatcher({
      playerStateStore: this.getDependency(PlayerStateStore),
      apply: colors => this.applyColors(colors, BUNDLED_THEME_SURFACE_BLUR[BundledTheme.Jacket])
    });

    this.configListener = configStore.onDidChange("appearance", (newState, oldState) => {
      if (newState?.theme === oldState?.theme && newState?.themeFilePath === oldState?.themeFilePath) return;

      this.updateThemeFileWatch();
      // Changing the theme file while Jacket is selected must not replace the jacket colors with the bundled ones
      if (newState?.theme === BundledTheme.Jacket && oldState?.theme === BundledTheme.Jacket) return;

      // Stopped first so a jacket still being read cannot be applied over the next theme
      this.jacketWatcher?.stop();
      this.reloadTheme();
      if (this.isJacketSelected()) this.jacketWatcher?.start();
    });

    app.on("web-contents-created", this.webContentsCreatedListener);
    for (const contents of webContents.getAllWebContents()) {
      this.trackWebContents(contents);
      this.injectAppTheme(contents, false);
    }

    // The YTM view is created after the services are initialized, so it is attached once the manager reports a status for it
    ytmViewManager.on("status-changed", this.ytmStatusChangedListener);
    this.attachYTMView();
    // Covers the first document, whose ready may be emitted before the view is attached
    this.injectYTMTheme();

    // Jacket may already be selected at start up, where reloadTheme is not run
    if (this.colorTransition) this.jacketWatcher.start();

    log.info("ThemeManager initialized");
  }

  public override onPostInitialized() {}

  public override onTerminated() {
    const ytmViewManager = this.getDependency(YTMViewManager);

    app.off("web-contents-created", this.webContentsCreatedListener);
    ytmViewManager.off("status-changed", this.ytmStatusChangedListener);
    if (this.ytmView) {
      this.ytmView.off("ready", this.ytmViewReadyListener);
      this.ytmView = null;
    }
    if (this.configListener) {
      this.configListener();
      this.configListener = null;
    }
    if (this.watchedFilePath !== null) {
      fs.unwatchFile(this.watchedFilePath, this.themeFileListener);
      this.watchedFilePath = null;
    }
    this.jacketWatcher?.stop();
    this.jacketWatcher = null;
    this.appInjections.clear();
  }

  public getColors(): ThemeColors {
    return { ...this.colors };
  }

  /**
   * Returns the blur behind surfaces of the loaded theme in px (0 is no blur)
   */
  public getSurfaceBlur(): number {
    return this.surfaceBlur;
  }

  /**
   * Returns the colors in a form native APIs can read. Items that cannot be converted use the Default theme's value
   */
  public getNativeColors(): ThemeColors {
    const nativeColors = { ...DEFAULT_THEME_COLORS };
    for (const item of COLOR_ITEMS) {
      nativeColors[item] = toNativeColor(this.colors[item], DEFAULT_THEME_COLORS[item]);
    }
    return nativeColors;
  }

  private createThemeSource(): ThemeSource {
    const configStore = this.getDependency(ConfigStore);
    const selection = configStore.get("appearance.theme");

    if (selection === ThemeSelection.File) {
      const filePath = configStore.get("appearance.themeFilePath");
      // No file chosen yet is not a missing file, so the Default theme is used without reporting anything
      if (!filePath) return { kind: ThemeSourceKind.Bundled, theme: BundledTheme.Default };

      return { kind: ThemeSourceKind.File, content: this.readThemeFile(filePath) };
    }

    return { kind: ThemeSourceKind.Bundled, theme: isBundledTheme(selection) ? selection : BundledTheme.Default };
  }

  private readThemeFile(filePath: string): string | null {
    try {
      return fs.readFileSync(filePath, "utf8");
    } catch (error) {
      log.warn(`Failed to read theme file '${filePath}'`, error);
      return null;
    }
  }

  private loadTheme(): Pick<ResolvedTheme, "colors" | "surfaceBlur"> {
    const memoryStore = this.getDependency(MemoryStore<MemoryStoreSchema>);

    const resolvedTheme = resolveTheme(this.createThemeSource());
    memoryStore.set("themeUnreadableItems", resolvedTheme.unreadableItems);
    memoryStore.set("themeFileMissing", resolvedTheme.fileMissing);

    return { colors: resolvedTheme.colors, surfaceBlur: resolvedTheme.surfaceBlur };
  }

  private isJacketSelected(): boolean {
    return this.getDependency(ConfigStore).get("appearance.theme") === BundledTheme.Jacket;
  }

  private reloadTheme() {
    const { colors, surfaceBlur } = this.loadTheme();
    this.applyColors(colors, surfaceBlur);
  }

  /**
   * Applies the colors and the surface blur to every screen, to the title bars, and to the listeners of "colors-changed".
   * Used by the theme loading and by the jacket colors, so both take the same path
   */
  private applyColors(colors: ThemeColors, surfaceBlur: number) {
    const colorTransition = this.isJacketSelected();
    // The transition is compared too: Glass and Jacket have the same colors, so only it tells the two apart
    if (sameColors(colors, this.colors) && surfaceBlur === this.surfaceBlur && colorTransition === this.colorTransition) return;

    this.colors = colors;
    this.surfaceBlur = surfaceBlur;
    this.colorTransition = colorTransition;
    for (const contents of this.appInjections.keys()) {
      this.injectAppTheme(contents, false);
    }
    for (const appWindow of this.getDependency(AppWindowManager).getWindows()) {
      if (appWindow.getWindowType() !== "Browser" || !appWindow.webContents) continue;

      const browserWindow = BrowserWindow.fromWebContents(appWindow.webContents);
      if (browserWindow) this.applyTitleBarOverlay(browserWindow);
    }
    this.injectYTMTheme();

    this.emit("colors-changed", this.getColors());
  }

  private updateThemeFileWatch() {
    const configStore = this.getDependency(ConfigStore);
    const filePath = configStore.get("appearance.theme") === ThemeSelection.File ? configStore.get("appearance.themeFilePath") || null : null;
    if (filePath === this.watchedFilePath) return;

    if (this.watchedFilePath !== null) fs.unwatchFile(this.watchedFilePath, this.themeFileListener);
    this.watchedFilePath = filePath;
    // watchFile also reports the file disappearing and coming back
    if (filePath !== null) fs.watchFile(filePath, { interval: THEME_FILE_POLL_INTERVAL_MS }, this.themeFileListener);
  }

  private isAppScreen(url: string): boolean {
    if (url.startsWith(APP_PROTOCOL)) return true;
    if (app.isPackaged) return false;

    try {
      return new URL(url).origin === new URL(ALL_WINDOWS_VITE_DEV_SERVER_URL).origin;
    } catch {
      return false;
    }
  }

  private enqueue(injection: CssInjection, task: () => Promise<void>) {
    injection.queue = injection.queue.then(task).catch(error => {
      log.error("ThemeManager failed to inject the theme", error);
    });
  }

  private trackWebContents(contents: WebContents) {
    if (this.appInjections.has(contents)) return;

    this.appInjections.set(contents, { key: null, queue: Promise.resolve() });
    contents.on("dom-ready", () => {
      this.injectAppTheme(contents, true);

      const browserWindow = BrowserWindow.fromWebContents(contents);
      if (browserWindow && browserWindow.webContents === contents && this.isAppScreen(contents.getURL())) this.applyTitleBarOverlay(browserWindow);
    });
    contents.once("destroyed", () => {
      this.appInjections.delete(contents);
    });
  }

  /**
   * @param documentLoaded Whether a new document was loaded, which drops any CSS inserted into the previous one
   */
  private injectAppTheme(contents: WebContents, documentLoaded: boolean) {
    const injection = this.appInjections.get(contents);
    if (!injection) return;

    this.enqueue(injection, async () => {
      if (documentLoaded) injection.key = null;
      if (contents.isDestroyed() || !this.isAppScreen(contents.getURL())) return;

      // The new CSS is inserted before the old one is removed so the screen never shows the defaults in between
      const previousKey = injection.key;
      const variables = toCssVariables(this.colors, APP_THEME_SELECTOR);
      injection.key = await contents.insertCSS(this.colorTransition ? `${variables}\n${buildJacketTransitionCss()}` : variables);
      if (previousKey !== null && !contents.isDestroyed()) await contents.removeInsertedCSS(previousKey);
    });
  }

  private attachYTMView() {
    const view = this.getDependency(YTMViewManager).getView() ?? null;
    if (view === this.ytmView) return;

    this.ytmView?.off("ready", this.ytmViewReadyListener);
    this.ytmView = view;
    this.ytmView?.on("ready", this.ytmViewReadyListener);
  }

  private injectYTMTheme() {
    const injection = this.ytmInjection;

    this.enqueue(injection, async () => {
      const ytmViewManager = this.getDependency(YTMViewManager);
      await ytmViewManager.ready();

      const contents = ytmViewManager.getView()?.webContents;
      if (!contents || contents.isDestroyed()) return;

      const previousKey = injection.key;
      injection.key = await contents.insertCSS(this.buildYTMThemeCss());
      if (previousKey !== null) {
        try {
          await contents.removeInsertedCSS(previousKey);
        } catch (error) {
          // The key may belong to a document that was replaced while this injection was running
          log.debug("ThemeManager could not remove the previous YTM theme", error);
        }
      }

      // Lets CSS that has to win over the theme (for example custom CSS) insert itself again after it
      this.emit("ytm-theme-applied");
    });
  }

  private buildYTMThemeCss(): string {
    // Lets the Grooving screen inside the YTM view follow the theme; the names do not clash with YTM's own, so no !important
    const colorDeclarations = COLOR_ITEMS.map(item => `${COLOR_ITEM_CSS_VARIABLES[item]}: ${this.colors[item]};`).join(" ");
    const variables = `:root { ${colorDeclarations} ${SURFACE_BLUR_CSS_VARIABLE}: ${this.surfaceBlur}px; }`;
    // The rules reference the variables so the bars and the guide move with them instead of jumping to the new colors
    const css = [variables, toCssColorRules(YTM_THEME_RULES, YTM_THEME_RULE_OPTIONS)];
    if (this.colorTransition) css.push(buildJacketTransitionCss());
    if (this.surfaceBlur <= 0) return css.join("\n");

    // Comes after the color rules so it wins over the backgrounds they give the same surfaces
    return [
      ...css,
      toCssBlurredSurfaceRule(YTM_BLURRED_SURFACE_RULE, this.surfaceBlur, YTM_THEME_RULE_OPTIONS),
      toCssBackedSurfaceRule(YTM_SEARCH_SUGGESTIONS_SELECTOR, YTM_THEME_RULE_OPTIONS)
    ].join("\n");
  }

  private applyTitleBarOverlay(browserWindow: BrowserWindow) {
    if (process.platform === "darwin" || browserWindow.isDestroyed()) return;

    try {
      browserWindow.setTitleBarOverlay({
        color: toNativeColor(this.colors[ColorItem.Background], DEFAULT_THEME_COLORS[ColorItem.Background]),
        symbolColor: toNativeColor(this.colors[ColorItem.TextMuted], DEFAULT_THEME_COLORS[ColorItem.TextMuted])
      });
    } catch (error) {
      // Windows created without a title bar overlay (for example the miniplayer) reject this call
      log.debug("ThemeManager could not update the title bar overlay", error);
    }
  }
}
