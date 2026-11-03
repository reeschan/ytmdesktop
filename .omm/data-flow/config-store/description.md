設定を持つ Service (`ConfigStore`)。`conf` を `StoreSchema` の型と既定値で包み、userData の config に保存する (`watch: true`)。

- `ipcMain` で `configStore:get` (handle) と `configStore:set` (on) を受ける。
- `onDidAnyChange` のたびに、全ウィンドウへ `configStore:stateChanged` (新旧の状態全体) を送り、`startOnBoot` をログイン項目に反映する。
- ほかの Service と Integration には `onDidChange` / `onDidAnyChange` をそのまま出す。
- 起動時の移行 (`v1ConfigMigration` や古いキーの削除) もここで行う。
