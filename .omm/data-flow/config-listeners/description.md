`ConfigStore` の変更を聞いて、見た目や動きを変える側。どれも自分の関わるキーだけを `onDidChange` で聞く (`IntegrationManager` だけは `onDidAnyChange`)。

- `appearance`: ThemeManager (テーマ)・BackgroundVideoManager (背景動画とマスク)・CustomCSS (カスタム CSS)・YTMViewManager (ズーム)
- `shortcuts`: ShortcutManager
- `playback`: TaskbarManager (タスクバーの進み具合)
- 全体: IntegrationManager (連携機能の有効・無効・再起動)、`integrations` は DiscordPresence (表示テンプレート) と CompanionServer (トークンの取り消し) も聞く
