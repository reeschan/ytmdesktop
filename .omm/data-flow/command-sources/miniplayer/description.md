ミニプレイヤーのアプリ画面。操作ボタンは preload から `remoteControl:execute` (コマンドと引数) を送り、`src/main/index.ts` がウィンドウごとに登録した `ipcOn` で受けて `RemoteControl` にそのまま `execute` を送る。コマンド名はメインプロセスで確かめない。
