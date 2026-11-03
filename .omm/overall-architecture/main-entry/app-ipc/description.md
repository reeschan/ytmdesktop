PostInitialized の後に `ipcMain` へ直接登録する、ウィンドウを問わない IPC と、更新を入れる処理。

- `safeStorage.isAsyncEncryptionAvailable()` の結果を `MemoryStore` の `safeStorageAvailable` に入れる。CompanionServer・LastFM・SongRecognition はこの値を見て、使えないときは有効にならない (または使えない)。
- `safeStorage:decryptString` (handle): hex を `safeStorage.decryptStringAsync` で復号。safeStorage が使えないと例外。
- `safeStorage:encryptString` (handle): `encryptStringAsync` の結果を hex で返す。
- `app:getVersion` (handle): `app.getVersion()`。
- `app:relaunch` (on): `app.relaunch()` して `app.quit()`。
- `restartApplicationForUpdate()`: 更新がダウンロード済みのときだけ、`AppWindowManager.forceWindowClosures()` で「トレイに隠す」に閉じるのを止められないようにしてから、`AutoUpdater.quitAndInstall()` する。設定ウィンドウとメインウィンドウの `app:restartApplicationForUpdate` から呼ぶ。
- `AutoUpdater` の `checking` / `available` / `not-available` / `downloaded` / `error` を、設定ウィンドウが開いていれば `autoUpdater:checkingForUpdate` / `updateAvailable` / `updateNotAvailable` / `updateDownloaded` / `updateNotAvailable` で送る (設定ウィンドウには失敗の状態が無いので、失敗は「更新なし」として送る)。

ウィンドウごとの IPC (`ipcOn` / `ipcHandle`) は main-window と child-windows に書く。
