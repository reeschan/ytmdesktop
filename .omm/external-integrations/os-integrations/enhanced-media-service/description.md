OS のメディア操作とつなぐ連携機能 (`integrations.enhancedMediaServiceEnabled`、既定で有効)。`xosms` の `MediaPlayer("ytmdesktop", "YTMDesktop")` を遅延 import で作り、有効化で `activate()`、無効化で `deactivate()` する。

- 起動時に有効なら、`onSetup` で `app.commandLine.appendSwitch("disable-features", "MediaSessionService")` を入れ、Chromium 自身の Media Session の OS 連携を止める。
- 再生状態を曲の情報・状態・位置として書き、ボタンとシークを `RemoteControl` に返す。
