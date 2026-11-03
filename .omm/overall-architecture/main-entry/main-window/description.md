メインウィンドウと、その中の mainView (ローディング画面のアプリ画面) を作る。

- mainView: `new AppView({ name: "Main" })`。`ytmd-app://main` を開き、`transparent: true`、下 36px をタイトルバー分あけて自動で広がる。`autoRecreate: true`。
  - 作った直後に `installSongRecognitionMediaHandlers(() => mainView.webContents)` で既定のセッションに権限・画面キャプチャのハンドラを入れ、`SongRecognition.setAppViewContentsGetter` に同じ getter を渡す (曲の聞き取りの録音はこのビューで行う)。
  - `will-navigate` / `will-redirect` を止める。
  - `ytmView:reload` (ipcOn) で YTM 画面を再読み込みする。
- メインウィンドウ: `createWindow("Browser", { name: "Main", views: [mainView] })`。本体は `ytmd-app://titlebar` (タイトルバーのアプリ画面)、`frame: false` と `titleBarOverlay` (高さ 36)、`additionalArguments: ["is-main-window"]`。大きさ・位置・最大化は `state.windowBounds` / `state.windowMaximized` から戻す。
  - resize / move / maximize / unmaximize / close で `StateManager.updateState` に保存。`general.hideToTrayOnClose` なら close を止めて隠す。
  - `window:openSettings` / `window:openMiniplayer` (ipcOn) で子ウィンドウを開く。
  - `ytmView:navigateDefault` (ipcOn) で YTM 画面に `https://music.youtube.com/` を読み込み直す。
  - `app:restartApplicationForUpdate` (ipcOn) で、ダウンロード済みの更新を入れる (タイトルバーの更新ボタン。中身は app-ipc の `restartApplicationForUpdate`)。
  - `ytmView:switchFocus` (ipcOn): `"ytm"` ならタイトルバーから YTM 画面へ、`"main"` なら YTM 画面からタイトルバーへフォーカスを移す。今フォーカスがある側から呼ばれたときだけ動く。
