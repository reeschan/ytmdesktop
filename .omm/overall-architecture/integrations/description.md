任意の連携機能。どれも `Integration` (`integration.ts`) を継承し、`src/main/index.ts` が `IntegrationManager.createIntegrations` に 8 個を登録する。

- `IntegrationManager` は AppBeforeReady で各 `onSetup`、AppReady と設定の変更のたびに `storeEnableProperty` の値を見て `onEnabled` / `onDisabled` を呼ぶ。有効なまま `dependentStoreProperties` が変わったら、無効にしてから有効にし直す。
- Integration は `getService` で Service (PlayerStateStore・ConfigStore・MemoryStore・ProtectedAPIManager・YTMViewManager・ThemeManager) を使う。YTM 画面に JS を流すときは `executeYTMScript` (`ytmView:executeScript` を送る) を使う。
- 再生の操作は、どれも `ProtectedAPIManager.createOrGetAPI("RemoteControl").postMessage("execute", ...)` を通して YTM 画面に送る。

| Integration | 有効にする設定 |
|---|---|
| CompanionServer | `integrations.companionServerEnabled` |
| DiscordPresence | `integrations.discordPresenceEnabled` |
| LastFM | `integrations.lastFMEnabled` |
| NowPlayingNotifications | `general.showNotificationOnSongChange` |
| VolumeRatio | `playback.ratioVolume` |
| CustomCSS | `appearance.customCSSEnabled` |
| EnhancedMediaService | `integrations.enhancedMediaServiceEnabled` |
| SongRecognition | `integrations.shazamEnabled` |
