アプリの状態 (ウィンドウの位置・最後の曲など) を `ConfigStore` の `state` に書く Service。`PlayerStateStore.stateChanged()` が毎回 `updateState({ lastVideoId, lastPlaylistId })` を直接呼ぶ。

- ディスクへの書き込みはタイマーでまとめ、終了時 (`powerMonitor` の `shutdown`) は `forceWrite()` する。
- 書いた `lastVideoId` は、次の起動で YTM 画面の preload が「続きから再生」に使う。
