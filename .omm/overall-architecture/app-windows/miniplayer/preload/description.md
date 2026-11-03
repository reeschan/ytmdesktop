ミニプレイヤーの `preload.ts`。store-ipc は使わず、ウィンドウ操作・前面表示の切り替え・プレイヤー状態の取得と購読・`remoteControl:execute`・`isWayland()` を `window.ytmd` に出す。`isWayland` は Vite が `process.env` を書き換えないように、`process` を変数に受けてから読む。
