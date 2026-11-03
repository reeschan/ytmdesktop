`net.createServer` の IPC サーバー (`index.ts` の `createIpcServer`、接続ごとに `CompanionServerIpcClient` で包む)。メッセージは先頭の int32LE が op (`HELLO` / `SELECT_VERSION` / `EVENT` / `PING` / `PONG`)。

- `SELECT_VERSION` で版を 1 回だけ選ばせ、すぐに今の状態を `EVENT` の `state-update` で送る。以後は `state-changed` のたびに送る。
- 30 秒のあいだ `PING` が来なければ切る。不正なメッセージでも切る。
