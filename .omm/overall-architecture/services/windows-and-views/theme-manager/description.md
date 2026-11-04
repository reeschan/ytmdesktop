配色テーマを読み、アプリ画面と YTM 画面とタイトルバーに当てる Service (`src/main/services/thememanager/index.ts`)。`EventEmitterService`。依存は ConfigStore・MemoryStore・AppWindowManager・YTMViewManager。

- テーマの元は `appearance.theme`。同梱テーマ (`BundledTheme`) か、`ThemeSelection.File` なら `appearance.themeFilePath` のファイル。`src/shared/theme` の `resolveTheme` で色と面のぼかし (`surfaceBlur`) に解決し、読めなかった項目とファイルの有無を MemoryStore の `themeUnreadableItems` / `themeFileMissing` に書く。テーマファイルは `fs.watchFile` (1 秒間隔) で見張る。
- アプリ画面: `app` の `web-contents-created` で全 webContents を追い、URL が `ytmd-app:` (開発版は Vite の開発サーバーの origin) のものだけに、`:root:root` の CSS 変数 (`toCssVariables`) を `insertCSS` する。`dom-ready` のたびに入れ直す。
- YTM 画面: `YTMViewManager.ready()` を待ってから、`--ytmusic-*` の変数とバー・ガイド・プログレスバーの背景を `!important` で上書きする CSS を入れる。`surfaceBlur` が 0 より大きいと、バー・メニュー・ダイアログを `backdrop-filter` のすりガラスにする。ビューの `ready` のたびに入れ直す。
- タイトルバー: Windows / Linux で `setTitleBarOverlay` の色と記号色をテーマに合わせる。
- イベント: `colors-changed` (色が変わった)・`ytm-theme-applied` (YTM 画面に入れ終えた。後から入れるべき CSS が入れ直すため)。
