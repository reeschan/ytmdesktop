ウィンドウと WebContentsView、その中に出す YTM 画面とアプリ画面の見た目を受け持つ Service のまとまり。AppWindowManager (`windowmanager/`)・YTMViewManager・ProtocolManager・ThemeManager・BackgroundVideoManager の 5 つ。

- AppWindowManager が BrowserWindow / BaseWindow と WebContentsView を `AppWindow` / `AppView` で包み、名前で管理する。ウィンドウそのもの (Main・Settings・Miniplayer など) は `src/main/index.ts` が `createWindow` で作る。
- YTMViewManager が YTM 画面の `AppView` (`persist:ytmview`) を作り、移動先・権限・右クリックメニューを制御する。
- ProtocolManager が `ytmd-app://` でアプリ画面のファイルと背景動画のファイルを配り、OS の `ytmd://` を受ける。
- ThemeManager がアプリ画面と YTM 画面に配色の CSS を入れ、BackgroundVideoManager が背景動画のビューを足して YTM 画面の背景を透明にする。
- 外への依存: YTMViewManager は ConfigStore・StateManager・MemoryStore、ThemeManager と BackgroundVideoManager は ConfigStore・MemoryStore、ProtocolManager は ConfigStore と ProtectedAPIManager。
