メインプロセス側。`src/main/index.ts` が設定ウィンドウを作り、ConfigStore / MemoryStore / PlayerStateStore のサービスと `safeStorage:*`・`app:relaunch`・`app:getVersion`・`lastfm:authenticate` などの IPC の受け手を持つ。
