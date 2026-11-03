メインウィンドウ本体 (BrowserWindow) に読み込むタイトルバーの画面。`Index.vue` が共通の `TitleBar` を、ホーム・設定・最小化・最大化のボタン付きで出し、ミニプレイヤーを開くボタンを足す。メインウィンドウの他のビューは、この画面の上 36px を空けて重なる。

`window.ytmd` (preload) が出すもの:
- `minimizeWindow` / `maximizeWindow` / `restoreWindow` / `closeWindow` / `requestWindowState` → `windowControls:*` を送る。`handleWindowEvents` は `windowControls:stateChanged` を受ける。
- `isMainWindow()`: main が `additionalArguments: ["is-main-window"]` で渡した引数があるかを返す。
- `openSettingsWindow` / `openMiniplayerWindow` → `window:openSettings` / `window:openMiniplayer`。
- `ytmViewNavigateDefault` → `ytmView:navigateDefault` (ホームへ戻す)。`switchFocus` → `ytmView:switchFocus`、`ytmViewRecreate` → `ytmView:recreate`、`restartApplicationForUpdate` → `app:restartApplicationForUpdate`。
- `memoryStore` (store-ipc の MemoryStore)。`TitleBar` が `ytmViewUnresponsive` を見てタイトルに "(Unresponsive)" を付ける。

ウィンドウにフォーカスが戻ると、キーボード操作の起点を先頭の要素に戻す。末尾の要素にフォーカスが来たら `switchFocus("ytm")` を呼ぶ。
