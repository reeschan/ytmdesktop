設定画面 (`Settings.vue`)。設定の流れの入口。

- preload が `src/renderer/store-ipc/store.ts` の `Store` を包んで出し、画面は `store.set(key, value)` → `configStore:set` (send)、`store.get(key)` → `configStore:get` (invoke) で読み書きする。
- 一時的な値 (`companionServerAuthWindowEnabled` など) は `MemoryStore` 側 (`memoryStore:set`) に書く。
- 自分も `configStore:stateChanged` を聞いて画面の値を合わせる。Discord の表示テンプレートのプレビューのため、再生状態も受け取る。
