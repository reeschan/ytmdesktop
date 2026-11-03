Electron のウィンドウとビューを包んで名前で管理する Service `AppWindowManager` と、その部品 `AppWindow`・`AppView` (`src/main/services/windowmanager/`)。依存はなし。

- `index.ts` (`AppWindowManager`): 名前をキーに `AppWindow` を持ち、`createWindow` / `getWindow` / `hasWindow` / `getWindows` / `closeWindow` / `destroyWindow` / `forceWindowClosures` を出す。ConfigStore・MemoryStore・FlagManager は `getWindows()` の各ウィンドウに、PlayerStateStore は名前で選んだウィンドウに `ipcBroadcast` して状態を配る。
- `appwindow.ts` (`AppWindow`): `BaseWindow` か `BrowserWindow` を包み、ビューの付け外し・閉じたときの作り直し・ウィンドウ操作の IPC を受け持つ。`ipcBroadcast` は付いているビューにも届く。
- `appview.ts` (`AppView`): `WebContentsView` を包み、親ウィンドウに合わせた大きさの追従・クラッシュ時の作り直し・webContents のイベントの中継を受け持つ。
