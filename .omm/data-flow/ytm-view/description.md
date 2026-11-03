YTM 画面に差し込むスクリプト一式 (`preload.ts` と、`webFrame.executeJavaScript` でページの main world に入れる `scripts/`)。再生状態の流れの入口と、操作の流れの出口を兼ねる。

- `ytmhook.ts` が YTM の DI に割り込んでプレイヤーとストアを握る。
- `playerstatestore.ts` がそれらのイベントを聞いて、`PlayerState` API に `updateVideoProgress` / `updateVideoState` / `updateVideoDetails` / `updateFromStore` / `playerSignal` / `playlistCreated` / `playlistDeleted` を送る。
- `setup/remote.ts` が `RemoteControl` API の `execute` を受けてプレイヤーを操作し、`getPlaylists` に答える。
- `preload.ts` は Protected API のポートをメインプロセスへ渡し、`ytmView:executeScript`・背景動画・曲の聞き取りの状態を受け取ってページに渡す。
