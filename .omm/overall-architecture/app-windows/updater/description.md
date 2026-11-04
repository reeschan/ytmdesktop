起動時の更新確認の画面。main が最初に作る、枠の無い 256x320 の BrowserWindow で、ロゴと読み込み中のアニメーションと状態の文 ("Checking for updates..." など) だけを出す。更新があればダウンロードして `quitAndInstall` し、無ければ閉じてメインウィンドウへ進む。

`window.ytmd` (preload) が出すもの: `autoUpdater.onChecking` / `onNotAvailable` / `onAvailable` / `onDownloaded` / `onError`。それぞれ main が送る `autoUpdater:checking` / `autoUpdater:not-available` / `autoUpdater:available` / `autoUpdater:downloaded` / `autoUpdater:error` を受ける。store-ipc は使わない。
