外部のアプリから再生状態を読み、操作させる連携機能 (`CompanionServer`、`integrations.companionServerEnabled`)。有効化で 3 つの入口と 1 つの広告を立ち上げる。

- Fastify の HTTP (`0.0.0.0:9863`、`/metadata` と `/api/v1/*`)
- Socket.IO (WebSocket だけ、名前空間 `/api/v1/realtime`)
- 名前付きパイプ / UNIX ソケット (`ytmdesktop-ipc`) の IPC サーバー
- mDNS (`multicast-dns`) で `_ytmdesktop._tcp.local` を広告

`safeStorage` が使えないときは有効にならない。無効化ですべて閉じる。リクエストの処理の詳細は `request-lifecycle` を見る。
