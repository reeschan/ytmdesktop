Unleash (`unleash-client`) から機能フラグを取る Service (`src/main/services/flagmanager/index.ts`)。いまは使われていない。ファイル先頭に「This service is deliberately not used right now」とあり、`src/main/index.ts` の `addServices` に入っておらず、IntegrationManager の `dependencies` でも `/*, FlagManager*/` とコメントアウトされている。

- 依存は AppWindowManager。`YTMD_UNLEASH_SERVER` があれば userData の `.unleash-sid` にセッション ID を残し、Unleash クライアントを作る。
- フラグが変わると `flags:changed` を全ウィンドウへ `ipcBroadcast` する。
- IPC: `flags:getFlag`・`flags:getFlags` (`ipcMain.handle`)。
