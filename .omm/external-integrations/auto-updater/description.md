自動更新の Service (`AutoUpdater`)。Electron の `autoUpdater` に `https://update.electronjs.org/<owner>/<repo>/<platform>-<arch>/<版>` をフィードとして渡す。

- 起動時に更新ウィンドウ (`ytmd-app://updater`) を出し、`checkForUpdates` の結果を `autoUpdater:*` で伝える。ダウンロード済みなら `quitAndInstall` する。
- 起動後は、設定ウィンドウの「更新を確認」で確かめ直し、状態を設定ウィンドウに `autoUpdater:*` で送る。ダウンロード済みになると、設定ウィンドウとタイトルバーの「再起動して更新」で `quitAndInstall` する。
- パッケージ版でない・`YTMD_DISABLE_UPDATES`・Windows 以外・フィードの設定が無いときは無効で、`MemoryStore` の `autoUpdaterDisabled` を立てる。
- 変更履歴のウィンドウは、同じフィードの `/win32/<版>` からリリースノートを `fetch` する (`src/main/index.ts`)。
