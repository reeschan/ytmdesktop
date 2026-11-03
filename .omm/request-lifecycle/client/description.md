Companion Server を使う外部のアプリ。HTTP (`http://<ホスト>:9863/api/v1/...`) と Socket.IO (WebSocket だけ) でつなぐ。トークンを持っていなければ認可の流れから始め、持っていれば HTTP には `Authorization` ヘッダー、Socket.IO には handshake の `auth.token` に入れる。
