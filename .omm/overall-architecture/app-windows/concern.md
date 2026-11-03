preload が出している IPC のうち、`src/main` に受け手 (`ipcMain.on` / `ipcOn` / `ipcHandle` / `webContents.ipc.on`) が見つからないものがある (2026-11-03 に grep で確認)。呼んでも何も起きない。

- titlebar: `ytmView:switchFocus`、`ytmView:recreate`、`app:restartApplicationForUpdate`
- settings: `app:checkForUpdates`、`app:restartApplicationForUpdate`。また `autoUpdater:checkingForUpdate` / `updateAvailable` / `updateNotAvailable` / `updateDownloaded` を待つが、main が送るのは `autoUpdater:checking` などを updater ウィンドウへだけ。
- settings / changelog の `store.reset` が送る `configStore:reset`
- authorize-companion: `companionWindow:minimize` / `maximize` / `restore` (`close` と `companionAuthorization:result` だけ受けている)
