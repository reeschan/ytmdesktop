YTM 画面の後ろに背景動画を出す Service `BackgroundVideoManager` (`src/main/services/backgroundvideo/index.ts`)。依存は ConfigStore・MemoryStore・AppWindowManager・YTMViewManager・ThemeManager。

- 動画の元 (`appearance.backgroundVideoSource`) は 2 種類。`Playing` は再生中の動画を YTM 画面の中に描かせる (状態を `backgroundVideo:ytmState` で YTM 画面の preload に送る)。`File` は設定のファイルを、背景動画用の `AppView` (`ytmd-app://background-video`、透明・sandbox) で `ytmd-app://background-video-file/<token>` から再生する。
- `attachToMainWindow(mainWindow)` で背景動画の `AppView` を Main ウィンドウのインデックス 0 (最も下) に付ける。`src/main/index.ts` は YTM 画面を付けた後にこれを呼ぶ。YTM 画面が作り直されたら、外して 0 に付け直す。
- 表示するかどうかは `src/shared/background-video` の `decideBackgroundVideo` が、有効か・元・YTM 画面の報告 (`backgroundVideo:ytmReport` の `available` / `reducedMotion`)・ファイルの有無・ウィンドウの状態 (全画面・最小化・非表示) から決める。
- YTM 画面の背景を透明にするときは、ページの背景と `--ytmusic-background` を透明にし、ヘッダー画像を隠す CSS を `insertCSS` する。テーマに面のぼかしがあるときはバー類の背景を残す。`File` のときだけビュー自体の背景色も透明にし、それ以外はテーマの背景色にする。music.youtube.com 以外のページ (サインインなど) は不透明のまま。
- 背景動画用ビューへは `backgroundVideo:state` で状態 (再生・動き・src・マスクの不透明度とぼかし・マスク色) を送り、`backgroundVideo:requestState` を受けたら送り直す。動画ファイルは `fs.watchFile` (1 秒間隔) で見張り、無いと MemoryStore の `backgroundVideoFileMissing` を true にする。
