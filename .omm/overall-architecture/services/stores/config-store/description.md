ディスクに残す設定を持つ Service (`src/main/services/configstore/index.ts`)。`conf` パッケージで userData の `config.json` を読み書きする。依存は AppWindowManager。

- `onPreInitialized` で `Conf<StoreSchema>` を作る (`projectVersion` はアプリの版、`watch: true`)。全キーの既定値もここに書く。続けて `general.disableHardwareAcceleration` なら `app.disableHardwareAcceleration()`、`playback.enableSpeakerFill` なら `try-supported-channel-layouts` スイッチを付ける。どちらも `app` の `ready` より前でないと効かないため PreInitialized で行う。
- `onInitialized` で `onDidAnyChange` を購読し、全ウィンドウへ `configStore:stateChanged` を `ipcBroadcast` し、`general.startOnBoot` を `app.setLoginItemSettings` に反映する。
- IPC: `configStore:get` (`ipcMain.handle`)・`configStore:set` (`ipcMain.on`)。
- 他の Service には `get` / `set` / `onDidChange` / `onDidAnyChange` を `conf` のまま出す。
