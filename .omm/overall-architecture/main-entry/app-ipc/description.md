PostInitialized の後に `ipcMain` へ直接登録する、ウィンドウを問わない IPC。

- `safeStorage.isAsyncEncryptionAvailable()` の結果を `MemoryStore` の `safeStorageAvailable` に入れる。CompanionServer・LastFM・SongRecognition はこの値を見て、使えないときは有効にならない (または使えない)。
- `safeStorage:decryptString` (handle): hex を `safeStorage.decryptStringAsync` で復号。safeStorage が使えないと例外。
- `safeStorage:encryptString` (handle): `encryptStringAsync` の結果を hex で返す。
- `app:getVersion` (handle): `app.getVersion()`。
- `app:relaunch` (on): `app.relaunch()` して `app.quit()`。

ウィンドウごとの IPC (`ipcOn` / `ipcHandle`) は main-window と child-windows に書く。
