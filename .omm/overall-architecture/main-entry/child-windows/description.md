メインウィンドウから開く子ウィンドウ 3 種。どれも `AppWindowManager.createWindow("Browser", ...)`、枠なし、`sandbox` + `contextIsolation`、preload は `../renderer/windows/<名前>/preload.cjs`。

- Settings (`ytmd-app://settings`、800x600、親はメインウィンドウ、macOS 以外はモーダル): 既にあれば前に出すだけ。`setWindowOpenHandler` で GitHub・ytmdesktop.github.io・`SHAZAM_API_KEY_URL` だけ外部ブラウザで開き、他は拒否。`playerStateStore:getState` (ipcHandle) を持つ。
- Miniplayer (`ytmd-app://miniplayer`): 大きさ・位置は `state.miniplayerWindowBounds` から戻し、変わるたびに保存。`setAlwaysOnTop(true, "pop-up-menu")`。リサイズ時に再生中の `VideoType` で縦横比を 16:9 (MusicVideo) か 1:1 (MusicAudio) にする。`remoteControl:execute` (ipcOn) を `ProtectedAPIManager` の `RemoteControl` API に流し、`playerStateStore:getState` (ipcHandle) を持つ。開くとメインウィンドウを隠し、閉じると戻す。
- Changelog (`ytmd-app://changelog`): `AppReady` の後、`metadata.appVersion` が今の版と違うときだけ開く。`changelog:getReleaseMetadata` (ipcHandle) で `AutoUpdater.getFeedUrlNoPlatform()` の `/win32/<版>` を fetch する。リンクは外部ブラウザで開き、閉じたら `metadata.appVersion` を今の版にする。
