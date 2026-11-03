`ready` の最初に行う更新の確認。`runNextLifecycle()` で Initialized に進めた後、`AppWindowManager.createWindow("Browser", { name: "Updater" })` で 256x320 の枠なしウィンドウ (`ytmd-app://updater`、開発時は Vite の URL) を出す。

- `AutoUpdater` の `checking` / `available` / `not-available` / `downloaded` / `error` を `autoUpdater:*` として Updater ウィンドウに送る。
- `checkForUpdates(true)` が真なら `quitAndInstall()` して `ready` ハンドラを抜ける。開発時は見た目のために 1.5 秒待つ。
- 終わったらイベントを外し、`runNextLifecycle()` で PostInitialized に進める。
- Updater ウィンドウはメインウィンドウを作った後に `destroyWindow()` する (先に閉じると `window-all-closed` が出るため)。
