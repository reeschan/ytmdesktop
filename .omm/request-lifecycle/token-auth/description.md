トークンの検証 (`api-shared/auth.ts`)。

- `isAuthValidAsync(configStore, token)`: トークンの SHA-256 を、`integrations.companionServerAuthTokens` を `safeStorage` で復号した一覧と比べ、合えば `[true, id]` を返す。
- `isAuthValidMiddlewareAsync`: HTTP の `preHandler`。`Authorization` ヘッダーをそのままトークンとして扱い (`Bearer` などの前置きは無い)、合えば `request.authId` に id を入れる。合わなければ 401 `{ error: "UNAUTHORIZED" }`。
- Socket.IO の名前空間のミドルウェアも `isAuthValidAsync` を使い、合わなければ `UnauthenticatedError` で接続を断る。
