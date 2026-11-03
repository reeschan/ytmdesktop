`app` の `ready` より前に行う準備。モジュールの読み込みと同時に走る。

- `electron-squirrel-startup` が真なら `app.exit()`。
- `ServiceCollection.addServices` に WatchDog・ConfigStore・AppWindowManager・MemoryStore・AutoUpdater・StateManager・ProtectedAPIManager・PlayerStateStore・YTMViewManager・ThemeManager・BackgroundVideoManager・ShortcutManager・TaskbarManager・ProtocolManager・IntegrationManager (最後) を登録し、`ServiceHost` を作る。
- `app.requestSingleInstanceLock()`。取れなければ `app.exit(0)`。`second-instance` では、ServiceHost の初期化後に限り、ミニプレイヤーを閉じる (閉じるとメインウィンドウが出る) かメインウィンドウを `showAndFocus()` し、コマンドラインの最後の引数を `ProtocolManager.handleYTMDProtocol` に渡す。
- `app.enableSandbox()`。アプリメニューは macOS だけ作り、他では `null`。
- `runNextLifecycle()` で PreInitialized に進め、`IntegrationManager` に `enable-error` のダイアログを付け、CompanionServer・DiscordPresence・LastFM・NowPlayingNotifications・VolumeRatio・CustomCSS・EnhancedMediaService・SongRecognition の順に `createIntegrations` し、`runHook(AppBeforeReady)` で各 `onSetup` を呼ぶ。
