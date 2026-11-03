メインプロセスの常駐部品 (Service) を集めたフォルダ `src/main/services/`。設定・一時状態・ウィンドウとビュー・YTM 画面・テーマ・背景動画・再生状態・ショートカット・タスクバー・自動更新・クラッシュ処理・Integration の管理を、1 フォルダ 1 Service で受け持つ。

- 土台は `service.ts` (抽象クラス `Service` と `EventEmitterService`)・`servicecollection.ts` (`ServiceCollection`)・`servicehost.ts` (`ServiceHost`)。
- 各 Service は `static dependencies` に依存先の Service を並べる。`ServiceCollection.getDependencyOrderedServices()` が依存先を先に置く順 (深さ優先のトポロジカル順) に並べ替え、`ServiceHost` がその順で生成し、自分を注入する。
- `ServiceHost.runNextLifecycle()` を呼ぶたびに、全 Service の `onPreInitialized` → `onInitialized` → `onPostInitialized` → `onTerminated` を 1 段ずつ進める。`src/main/index.ts` では、モジュール読み込み時に PreInitialized、`app` の `ready` で Initialized、ウィンドウを作った後に PostInitialized、`app` の `quit` で Terminated を呼ぶ。
- Service 同士は `getDependency(Service)` で取り出す。`dependencies` に無い Service を取ろうとすると例外になる。
- 登録は `src/main/index.ts` の `serviceCollection.addServices([...])` で、15 個 (WatchDog, ConfigStore, AppWindowManager, MemoryStore, AutoUpdater, StateManager, ProtectedAPIManager, PlayerStateStore, YTMViewManager, ThemeManager, BackgroundVideoManager, ShortcutManager, TaskbarManager, ProtocolManager, IntegrationManager)。`flagmanager/` の FlagManager はフォルダはあるが登録されていない。
