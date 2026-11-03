再生状態を受けるアプリ画面のウィンドウ。`PlayerStateStore.stateChanged()` から直接届く。

- Miniplayer と Settings: `playerStateStore:stateChanged` を `ipcBroadcast` で受ける。最初の状態は `src/main/index.ts` がウィンドウごとに登録する `playerStateStore:getState` (ipcHandle) で読む。
- Main と Miniplayer: `hasFullMetadata` のときはタイトルを「曲名 - アーティスト | YTMDesktop」にする。
- Miniplayer はリサイズのときに `videoType` を見て縦横比 (MV は 16:9、音声は 1:1) を決める。
