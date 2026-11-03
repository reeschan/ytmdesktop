アプリ画面から見たメインプロセス (`src/main/`)。画面の BrowserWindow / WebContentsView を作って読み込み、`ipcMain` やウィンドウごとの `webContents.ipc` で preload からの IPC を受ける。中身は Services と Integrations の図を参照。
