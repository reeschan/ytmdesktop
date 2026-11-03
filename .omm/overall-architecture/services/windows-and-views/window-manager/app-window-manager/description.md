Service 本体 `AppWindowManager` (`src/main/services/windowmanager/index.ts`)。依存はなし。ライフサイクルではログを出すだけ。

- `activeWindows` に名前をキーに `AppWindow` を持つ。同じ名前の `createWindow` は例外。
- `closeWindow` は `AppWindow.closeWindow()` (通常の close)、`destroyWindow` は強制的に壊して登録から外す。`forceWindowClosures` は全ウィンドウに `forceWindowClosure()` (作り直さない印) を付け、`src/main/index.ts` の `before-quit` で使う。
- 使う名前は `src/main/index.ts` が決める (`Main`・`Settings`・`Miniplayer` など)。PlayerStateStore・TaskbarManager はこの名前で `hasWindow` / `getWindow` する。ConfigStore・MemoryStore は `getWindows()` の全ウィンドウに `ipcBroadcast` する。
