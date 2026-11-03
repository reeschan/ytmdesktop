OS の機能を使う部分の集まり。サービス・連携機能・`src/main/index.ts` に散らばっている。

- OS のメディア操作の表示とボタン (EnhancedMediaService、`xosms`)
- Windows のタスクバーのサムネイルボタンと進み具合 (TaskbarManager)
- グローバルショートカット (ShortcutManager)
- トレイ (`src/main/index.ts`)
- 曲の変わり目の通知 (NowPlayingNotifications)
- `ytmd://` の既定のプロトコルクライアント (ProtocolManager)
- ログイン時の起動 (ConfigStore の `reconcileConfig`)
