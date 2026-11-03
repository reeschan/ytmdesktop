アプリ画面 (タイトルバー・設定・ミニプレイヤー・ローディング・更新・Companion の認可・変更履歴)。この視点では、流れの受け手として次の 3 つを受け取る。

- 再生状態: Miniplayer と Settings は preload の `playerStateStore:getState` (invoke) で最初の状態を読み、`playerStateStore:stateChanged` で更新を受ける。Main と Miniplayer はタイトルが曲名になる。
- 設定: どのウィンドウも `configStore:stateChanged` で設定全体を受け取る (`ConfigStore` が `ipcBroadcast` する)。
- 見た目: `ThemeManager` が `ytmd-app://` (開発時は Vite の dev server) の webContents に、色の変数を `:root:root` で `insertCSS` し、タイトルバーのオーバーレイの色を `setTitleBarOverlay` で合わせる。
