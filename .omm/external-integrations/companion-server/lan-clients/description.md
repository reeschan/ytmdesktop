LAN 上 (または同じ PC) から TCP でつなぐクライアント。mDNS でアプリを見つけ、`/api/v1/auth/requestcode` → `/api/v1/auth/request` でトークンを受け取り、以後は `Authorization` ヘッダー (HTTP) か `auth.token` (Socket.IO の handshake) にトークンを入れる。
