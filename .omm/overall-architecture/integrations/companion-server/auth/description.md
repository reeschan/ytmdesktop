認可コードとトークンの扱い。

- `getTemporaryAuthCode`: 使われていない 4 桁のコードを作り、appId・appVersion・appName と結び付けて 60 秒だけモジュール内の表に置く。コード探しは 250ms ごとに試し、3 秒で諦めて `null`。
- `getIsTemporaryAuthCodeValidAndRemove`: appId が合えばコードの中身を返して消す。
- `createAuthTokenAsync`: 256 バイトの乱数をトークンとして返し、保存するのは SHA-256 のハッシュ。同じ appId の古いトークンは消す。一覧は `safeStorage.encryptStringAsync` で暗号化して `integrations.companionServerAuthTokens` に hex で入れる。
- `isAuthValidAsync` / `isAuthValidMiddlewareAsync`: `Authorization` ヘッダー (socket.io は `auth.token`) のハッシュを保存済みの一覧と比べ、トークン ID を `request.authId` に入れる。
