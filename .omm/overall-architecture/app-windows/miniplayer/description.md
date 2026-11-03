ミニプレイヤーのウィンドウ。タイトルバーの `window:openMiniplayer` で main が作る、枠の無い BrowserWindow (`frame: false`、最小 240x240) で、`setAlwaysOnTop(true, "pop-up-menu")` で前面に置く。開くとメインウィンドウを隠し、閉じると大きさを保存してメインウィンドウを戻す。

再生の状態は PlayerStateStore から受け、操作は main 経由で YTM 画面の RemoteControl (Protected API) に流す。YTM 画面に直接はつながない。

`window.ytmd` (preload) が出すもの:
- ウィンドウ操作: `minimizeWindow` / `maximizeWindow` / `restoreWindow` / `closeWindow` / `requestWindowState` と `handleWindowEvents` (`windowControls:*`)、`setAlwaysOnTopWindow(bool)` → `windowControls:setAlwaysOnTop`。
- `playerStore.getState()` → `playerStateStore:getState` (invoke)、`playerStore.handleStateChanged(cb)` → `playerStateStore:stateChanged` を受ける。
- `executeCommandInYTMView(command, ...args)` → `remoteControl:execute`。main は RemoteControl の Protected API に `execute` として渡す。
- `isWayland()`: Linux で `WAYLAND_DISPLAY` か `XDG_SESSION_TYPE=wayland` なら真。
