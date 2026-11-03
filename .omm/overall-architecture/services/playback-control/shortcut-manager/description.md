設定のショートカットを OS のグローバルショートカットに登録する Service (`src/main/services/shortcutmanager/index.ts`)。依存は ConfigStore・ProtectedAPIManager・MemoryStore。

- `onPostInitialized` で登録し、`configStore.onDidChange("shortcuts")` のたびに `globalShortcut.unregisterAll()` してから登録し直す。
- 対象は `shortcuts` の 10 項目 (playPause・next・previous・thumbsUp・thumbsDown・volumeUp・volumeDown・volumeMute・toggleShuffle・toggleRepeat)。押されると `RemoteControl` API に `execute` と操作名 (`playPause`・`toggleLike`・`cycleRepeatMode` など) を送る。
- 登録に失敗した項目は MemoryStore の `shortcuts<項目>RegisterFailed` を true にする。空の項目は false にする。
