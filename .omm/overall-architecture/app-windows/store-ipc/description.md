preload から使う、メインプロセスの ConfigStore (保存される設定) と MemoryStore (保存しない実行時の状態) への薄い IPC ラッパー。読み込んだ時点で `process.type !== "renderer"` なら例外にする。

- `store.ts` の `Store<TSchema>`: `set(key, value)` → `configStore:set`、`get(key)` → `configStore:get` (invoke)、`reset(key)` → `configStore:reset`、`onDidAnyChange(cb)` → `configStore:stateChanged` (新旧の状態) を受ける。`key` はドット区切りのパス (例 `appearance.theme`) も渡せる。
- `memory-store.ts` の `MemoryStore<TSchema>`: `set` → `memoryStore:set`、`get` → `memoryStore:get` (invoke)、`onStateChanged(cb)` → `memoryStore:stateChanged` を受ける。

使う側: titlebar / main / settings / changelog の preload と、YTM 画面の preload (`src/renderer/ytmview/preload.ts`、Store だけ)。各 preload は必要なメソッドだけを `window.ytmd.store` / `window.ytmd.memoryStore` に包み直して出す。スキーマは `~shared/store/schema` の `StoreSchema` / `MemoryStoreSchema`。
