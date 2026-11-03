連携機能の有効・無効を設定に合わせる Service (`IntegrationManager`)。`onPostInitialized` で `onDidAnyChange` を聞き、変更のたびに `reconcileIntegrationEnableState` を回す。

- 各 Integration の `storeEnableProperty` (例: `integrations.discordPresenceEnabled`) が真になれば `ENABLE`、偽になれば `DISABLE` を呼ぶ。
- 有効のまま `dependentStoreProperties` (例: Companion Server の `companionServerCORSWildcardEnabled`、SongRecognition の `shazamApiKey`) が変わったら、`DISABLE` → `ENABLE` で再起動する。
- 起動時は `AppReady` のフックで同じ処理を回す。有効化に失敗すると `enable-error` を出し、`src/main/index.ts` がダイアログを出す。
