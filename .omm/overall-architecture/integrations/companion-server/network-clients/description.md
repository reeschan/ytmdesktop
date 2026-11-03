(外部) LAN 上の Companion クライアント (YTMDesktop の Companion API を使う別のアプリ)。mDNS で見つけ、`/api/v1/auth/requestcode` と `/api/v1/auth/request` でトークンを得て、REST と socket.io `/api/v1/realtime` を使う。
