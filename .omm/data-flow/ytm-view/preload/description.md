YTM 画面の preload (`preload.ts`)。ホストが `music.youtube.com` でなければすぐ止まる (`YTMDFastFail`)。

- `scripts` を `?raw` で読み、`webFrame.executeJavaScript` でページの main world に入れる。
- ページから受けた親ポートを `protectedApi:bindPort` でメインプロセスへ渡す (1 回だけ)。
- `ytmd-ready` を受けると `ytmView:ready` を送り、続きから再生 (`state.lastVideoId` へ `yt-navigate`)・音量スライダーの常時表示を設定に合わせ、`ytmView:executeScript` を受け付け始める。
- 背景動画 (`BackgroundVideoIpc`) と曲の聞き取り (`SongRecognitionIpc`) の状態をページに `postMessage` で渡し、ページからの報告や押下をメインプロセスへ返す。
