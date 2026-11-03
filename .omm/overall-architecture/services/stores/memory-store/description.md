起動中だけの一時状態を持つ Service `MemoryStore<MemoryStoreSchema>` (`src/main/services/memorystore/index.ts`)。ディスクには書かない。依存は AppWindowManager。

- 値はキー文字列をそのままキーにした平らなオブジェクトに入る。`set` のたびに旧状態を `structuredClone` し、`stateChanged` を出し、全ウィンドウへ `memoryStore:stateChanged` を `ipcBroadcast` する。
- IPC: `memoryStore:get` (`ipcMain.handle`)・`memoryStore:set` (`ipcMain.on`)。
- 他の Service が書く主なキー: AutoUpdater の `autoUpdater*`、ShortcutManager の `shortcuts*RegisterFailed`、YTMViewManager の `ytmViewUnresponsive`、ThemeManager の `themeUnreadableItems` / `themeFileMissing`、BackgroundVideoManager の `backgroundVideoFileMissing`。
