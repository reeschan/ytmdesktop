背景動画の決まりごと (`index.ts`) とテスト (`index.test.ts`、vitest)。

- 定数: 背景動画の元 `BackgroundVideoSource` (再生中の動画 `playing` / ローカルの動画ファイル `file`)、ウィンドウの見え方 `WindowVisibility`、再生の状態 `BackgroundVideoPlayback`、YTM 画面の背景 `YtmBackground` (テーマ / 透明)、動き `BackgroundVideoMotion` (連続 / 静止)。
- IPC と postMessage の名前: `backgroundVideo:ytmState` / `backgroundVideo:ytmReport` (main と YTM 画面)、`ytmd-background-video-state` / `-report` (YTM 画面の preload とページ)。
- `decideBackgroundVideo(input)`: 有効で、元に絵がある (再生中の動画が取れる、またはファイルがある) ときだけ動画を出して YTM 画面の背景を透明にする。再生の状態はウィンドウが見えていれば再生・隠れていれば一時停止・全画面なら隠す。動きを減らす設定なら静止。
- import 元: `src/main/services/backgroundvideo`・`configstore`、アプリ画面の `background-video` と `settings`、YTM 画面の preload と `scripts/setup/background-video.ts`、`store/schema.ts`。
