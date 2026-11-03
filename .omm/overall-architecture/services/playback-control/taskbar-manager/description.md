Main ウィンドウのタスクバーに、前へ・再生/一時停止・次へのサムバーボタンと再生の進みを出す Service (`src/main/services/taskbarmanager/index.ts`)。依存は ConfigStore・AppWindowManager・ProtectedAPIManager・PlayerStateStore。

- `onPostInitialized` で、PlayerStateStore の `state-changed` と `configStore.onDidChange("playback")` を購読し、そのたびに `reconcileTaskbar` で作り直す。
- 曲が無いときはボタンを `disabled` にする。ボタンは `RemoteControl` API に `execute` で `previous` / `playPause` / `next` を送る。
- `playback.progressInTaskbar` が true なら、`videoProgress / durationSeconds` を `setProgressBar` に渡す (再生中は `normal`、それ以外は `paused`)。
- アイコンは `src/main/util.ts` の `getControlsIconPath` から読む。
