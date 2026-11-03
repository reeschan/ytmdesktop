グローバルショートカットの Service (`ShortcutManager`)。`shortcuts` が変わるたびに `globalShortcut.unregisterAll()` してから、設定のあるものを登録し直す。

- 各キーは `RemoteControl` のコマンド (`playPause` / `next` / `previous` / `toggleLike` / `toggleDislike` / `volumeUp` / `volumeDown` / `toggleMute` / `shuffle` / `cycleRepeatMode`) に結びつく。
- 登録できなかったものは `MemoryStore` の `shortcuts*RegisterFailed` に出し、設定画面が表示に使う。
