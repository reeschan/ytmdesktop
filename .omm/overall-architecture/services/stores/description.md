設定と状態を持つ Service のまとまり。ConfigStore (ディスクに残す設定)・MemoryStore (起動中だけの一時状態)・StateManager (ConfigStore の `state` キーへの書き込みをまとめる) の 3 つ。

- アプリ画面は `configStore:get` / `configStore:set`・`memoryStore:get` / `memoryStore:set` で読み書きし、変化は `configStore:stateChanged`・`memoryStore:stateChanged` として全ウィンドウに `ipcBroadcast` で届く。そのため ConfigStore と MemoryStore は AppWindowManager に依存する。
- StateManager は WatchDog に依存し、クラッシュ時に書き込みを止める。
- 設定の型は `src/shared/store/schema.ts` の `StoreSchema`、一時状態の型は同じファイルの `MemoryStoreSchema`。
