メインプロセスの入口。`src/main/index.ts` が Service の組み立て・ライフサイクルの進行・Integration の登録・ウィンドウとトレイの作成・一部の IPC ハンドラの登録をまとめて行う。`src/main/util.ts` はアイコンのパスと v1 設定の移行、`src/main/manager.ts` は古い `Manager` インターフェース。

起動の順番:

1. `electron-squirrel-startup` が真なら (インストール・アンインストール中) `app.exit()`。
2. `ServiceCollection` に Service を登録し (`IntegrationManager` は最後)、`ServiceHost` を作る。
3. `app.requestSingleInstanceLock()`。取れなければ終了。2 つ目の起動では、ミニプレイヤーを閉じるかメインウィンドウを前に出し、最後の引数を `ProtocolManager.handleYTMDProtocol` に渡す。
4. `app.enableSandbox()`、macOS だけアプリメニューを作る。
5. `runNextLifecycle()` で PreInitialized。`IntegrationManager.createIntegrations([...8 個])` と `runHook(AppBeforeReady)` (各 Integration の `onSetup`)。
6. `app` の `ready` で Initialized。Updater ウィンドウを出して更新を確かめ、更新があれば `quitAndInstall()` して終わる。
7. PostInitialized。`v1ConfigMigration`、safeStorage の確認と IPC 登録、mainView とメインウィンドウ、トレイを作る。
8. メインウィンドウの準備を待ち、YTM 画面を作って付け、背景動画のビューを付け、`runHook(AppReady)` (Integration の有効化)。版が変わっていれば変更履歴のウィンドウを出す。
9. `quit` で Terminated。
