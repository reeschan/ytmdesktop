`await mainWindow.ready()` の後、YTM 画面をメインウィンドウに付け、その状態に合わせて mainView (ローディング画面) を出し入れする。

- `YTMViewManager` の `status-changed`: 状態を `ytmView:statusChanged` で mainView に送る。Ready なら mainView を隠し、フックにエラーがあれば `YTMViewSetupCompletionFlags` の OK / FAIL の一覧付きで「Hook Error」ダイアログを出す (クリップボードにコピーもできる)。Ready 以外なら mainView を出す。
- `view-recreated` / `unresponsive` で mainView を出し、`responsive` で隠す。`load-errored` で `ytmView:loadError` を mainView に送る。
- `ytmViewManager.createView()` で YTM 画面を作り、`mainWindow.attachView(ytmView, 0)`。その後 `BackgroundVideoManager.attachToMainWindow(mainWindow)` で背景動画のビューを YTM 画面の下に付ける。
- mainView が作り直されたら、YTM 画面の準備を待って隠す。
- 最後に `integrationManager.runHook(AppReady)` で、設定で有効な Integration を有効にする。
