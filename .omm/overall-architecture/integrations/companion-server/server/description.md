Integration 本体 `CompanionServer`。

- `onEnabled`: `safeStorageAvailable` が偽なら何もしない。IPC サーバー、Fastify (CORS は `companionServerCORSWildcardEnabled` で `*` か無し、socket.io は websocket のみ)、mDNS の順に立てる。既定の名前空間への socket.io 接続はすぐ切る。`integrations` の設定が変わったら保存済みトークンを復号し、もう無いトークンの socket.io 接続を切る。
- IPC サーバー: opcode (HELLO 0・SELECT_VERSION 1・EVENT 2・PING 3・PONG 4) と int32LE の長さで組んだバイナリ。SELECT_VERSION で版を選ぶと今の状態を `state-update` で送り、以後 `PlayerStateStore` の `state-changed` のたびに送る。30 秒 PING が無ければ切る。
- mDNS: `_services._dns-sd._udp.local`・`_ytmdesktop._tcp.local` の PTR・インスタンスの SRV / TXT・ホスト名の A に答える。A レコードは内部でない IPv4 から作る。
- `onDisabled`: `companionServerAuthWindowEnabled` を偽にし、Fastify・IPC サーバー・mDNS を閉じる。
