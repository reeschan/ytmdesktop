画面の入口。`material-symbols/outlined.css` と `~assets/app.css` を読み込み、`Index.vue` をマウントしてから `startSongRecognitionRecorder()` を呼ぶ。録音の準備が失敗してもローディング画面を止めないように、マウントの後に try/catch で呼ぶ。
