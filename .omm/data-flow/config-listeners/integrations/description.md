`IntegrationManager` に登録された連携機能 (`src/main/index.ts` の `createIntegrations`): CompanionServer・DiscordPresence・LastFM・NowPlayingNotifications・VolumeRatio・CustomCSS・EnhancedMediaService・SongRecognition。

- 有効化 (`onEnabled`) で PlayerStateStore や ConfigStore を聞き始め、無効化 (`onDisabled`) でやめる。
- 有効化の前の `onSetup` は app の `ready` より前に 1 回だけ呼ばれる (EnhancedMediaService が `MediaSessionService` を止めるのに使う)。
