YTM 画面のスクリプトとメインプロセスを MessagePort でつなぐ窓口の Service (`src/main/services/protectedapimanager/index.ts`)。依存はなし。

- IPC: `protectedApi:bindPort` (`ipcMain.on`)。届いた `event.ports[0]` を main port にする (`setMainPort`)。
- main port に `ProvideAPIPort` の op で名前と port が届くと、その名前の `ProtectedAPI` を作るか取り出し、port を付ける (`createOrGetAPI(name)`)。
- `ProtectedAPI` は `EventEmitter`。相手からの `Message` を同名のイベントとして出し、`postMessage(name, ...args)` で送り、`invokeMessage(name, ...args)` で `Invoke` を送って `InvokeResponse` を待つ (30 秒で reject)。
- 使う名前: PlayerStateStore が `PlayerState`、ShortcutManager・TaskbarManager・ProtocolManager が `RemoteControl`。
