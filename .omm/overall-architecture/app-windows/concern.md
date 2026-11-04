preload が出している IPC のうち、`src/main` に受け手 (`ipcMain.on` / `ipcOn` / `ipcHandle` / `webContents.ipc.on`) が無いものがある (2026-11-03 に grep で確認)。どれも呼んでいる画面が無いので、今は何も起きない。

- titlebar: `ytmViewRecreate` が送る `ytmView:recreate`
- settings / changelog の `store.reset` が送る `configStore:reset`
- authorize-companion: `companionWindow:minimize` / `maximize` / `restore` (`close` と `companionAuthorization:result` だけ受けている。ウィンドウも最小化・最大化できない設定)
