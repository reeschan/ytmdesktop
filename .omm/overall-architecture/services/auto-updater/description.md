Electron の `autoUpdater` で更新を確かめ、状態を MemoryStore に出す Service (`src/main/services/autoupdater/index.ts`)。依存は MemoryStore。

- 更新フィードは `https://update.electronjs.org/<YTMD_UPDATE_FEED_OWNER>/<YTMD_UPDATE_FEED_REPOSITORY>/<platform>-<arch>/<version>`。owner か repository が空ならフィードを無効とみなす。
- `isDisabled()` が true (フィードが無効・パッケージ前・`YTMD_DISABLE_UPDATES`・Windows 以外) なら `autoUpdaterDisabled` を MemoryStore に書いて何もしない。
- `autoUpdater` のイベントごとに状態を変え、`autoUpdaterChecking` / `autoUpdaterAvailable` / `autoUpdaterDownloaded` などのフラグを MemoryStore に書き、同名のイベントを出す。
- IPC: `autoUpdater:isUpdateAvailable`・`autoUpdater:isUpdateDownloaded` (`ipcMain.handle`)。
- `checkForUpdates(wait)`・`quitAndInstall()`・`isUpdateDownloaded()` を `src/main/index.ts` から呼ぶ (起動時のアップデーター用のウィンドウ、設定ウィンドウの「更新を確認」、設定ウィンドウとタイトルバーの「再起動して更新」)。
- Electron は更新を見つけるとすぐダウンロードするので、更新を見つけた後 (Available / Downloaded) は `checkForUpdates` で確かめ直さない (二重のインストールを避ける)。
