ほかの端末やアプリから再生状態を読み、再生を操作するための Companion Server。有効にする設定は `integrations.companionServerEnabled`。`integrations.companionServerCORSWildcardEnabled` が変わると再起動する。

- `0.0.0.0:9863` の Fastify (HTTP + socket.io、websocket のみ) に API v1 (`/api/v1`) を載せる。`/metadata` は `apiVersions: ["v1"]` を返す。
- 同じ機械のクライアント向けに、名前付きパイプ `\?\pipe\ytmdesktop-ipc` (Windows) か `$XDG_RUNTIME_DIR/ytmdesktop-ipc` などの UNIX ソケットで IPC サーバーを開く。
- mDNS で `_ytmdesktop._tcp.local` を広告する。
- 認可は 4 桁のコードとアプリ画面 (Companion の認可) での承認でトークンを発行する。トークンは `safeStorage` で暗号化して `integrations.companionServerAuthTokens` に保存する。safeStorage が使えないと有効にならない。
- `MemoryStore` の `companionServerAuthWindowEnabled` が真になってから 5 分で偽に戻す (認可を受け付ける時間)。
