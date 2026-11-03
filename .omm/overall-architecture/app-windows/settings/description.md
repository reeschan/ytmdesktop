設定ウィンドウ。main が `window:openSettings` を受けて開く BrowserWindow で、`ytmd-app://settings` を読み込む。`Index.vue` が `TitleBar` と `Settings.vue` を並べ、`Settings.vue` (約 1800 行の 1 ファイル) が左のサイドバーと 6 つのタブを持つ。

- 起動時に `store.get` で `general` / `appearance` / `playback` / `integrations` / `shortcuts` / `lastfm` を読み、項目ごとの `ref` に入れる。変更は `settingsChanged()` がすべての項目を `store.set("<区分>.<キー>", 値)` で書き戻す。`store.onDidAnyChange` で他から変わった値も取り込む。
- 再起動が要る項目を変えると、上に「Restart app to apply changes」の帯を出し、`restartApplication()` (`app:relaunch`) を呼べるようにする。
- 文字の項目 (表示テンプレート・Shazam の API Key など) は 400ms 待ってからまとめて保存し、閉じる前 (`beforeunload` / `onBeforeUnmount`) にも保存する。

`window.ytmd` (preload) が出すもの:
- ウィンドウ操作: `minimizeWindow` などと `handleWindowEvents` / `requestWindowState` (`windowControls:*`)。
- `isDarwin` / `isLinux` / `isWindows`、`processVersions` (electron / chrome)。
- `store` (store-ipc の Store) と `memoryStore` (MemoryStore)。
- `safeStorage.encryptString` / `decryptString` → `safeStorage:*` (invoke)。
- `restartApplication` → `app:relaunch`、`restartApplicationForUpdate` → `app:restartApplicationForUpdate`、`checkForUpdates` → `app:checkForUpdates`、`getAppVersion` → `app:getVersion`。
- `isAppUpdateAvailable` / `isAppUpdateDownloaded` → `autoUpdater:isUpdate*` (invoke)。`handleCheckingForUpdate` などは `autoUpdater:checkingForUpdate` などを待つ。
- `getTrueFilePath(file)`: `webUtils.getPathForFile` でファイルの実パスを返す。
- `lastFMStepAuthenticate` → `lastfm:authenticate`。
- `getPlayerState` → `playerStateStore:getState` (invoke)、`onPlayerStateChanged` → `playerStateStore:stateChanged` を受ける。
