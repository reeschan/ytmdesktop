`BaseWindow` か `BrowserWindow` を包むクラス `AppWindow<"Base" | "Browser">` (`src/main/services/windowmanager/appwindow.ts`)。`EventEmitter`。

- 生成時に Electron のウィンドウを作り、`url` か `file` を読み、`views` の `AppView` を付ける。`waitForViews` なら、自分の `ready-to-show` と全ビューの `dom-ready` がそろってから `show` する。パッケージ前は開発者ツールを開く。
- 予期しない close (`requestedClosure` が false) で `autoRecreate` なら、最大化の状態を引き継いで作り直し、ビューを同じインデックスに付け直して `recreated` を出す。レンダラーが落ちたときも作り直す。`forceWindowClosure()` は `requestedClosure` を立てるだけで、次の close で作り直さないようにする。
- `ipcBroadcast(channel, ...)` は自分の webContents (`BrowserWindow` のとき) と、付いている全 `AppView` の webContents に `send` する。Main ウィンドウでは YTM 画面のビューにも届く。
- ウィンドウ操作の IPC (`BrowserWindow` のみ、webContents 単位): `windowControls:minimize` / `maximize` / `restore` / `close` / `setAlwaysOnTop` / `requestState` を受け、状態が変わると `windowControls:stateChanged` を送る。
- 他: `ipcOn` / `ipcHandle`、`setThumbarButtons` (Windows のみ)・`setProgressBar` (作り直し後も付け直すため値を覚える)、`setTitle`、`setWindowOpenHandler`。Electron のウィンドウイベントは `electronwindow-*` として中継する。
