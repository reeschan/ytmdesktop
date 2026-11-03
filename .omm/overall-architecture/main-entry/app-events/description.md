`ready` の外で `app` と `powerMonitor` に付けるイベント。

- `open-url` (macOS の `ytmd://`): ServiceHost の初期化後なら `ProtocolManager.handleYTMDProtocol(url)`。
- `powerMonitor` の `shutdown`: 既定の動作を止め、`StateManager.forceWrite()` で状態を書いてから `app.quit()`。
- `before-quit`: `AppWindowManager.forceWindowClosures()` (hideToTrayOnClose で止められないように閉じる)。
- `quit`: `runNextLifecycle()` で Terminated に進める。
