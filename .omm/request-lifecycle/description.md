Companion Server に届いたリクエストが、どの順で確かめられ、どう YTM 画面まで届き、状態がどう返るか。

- 認可 (トークンを持っていない): `POST /api/v1/auth/requestcode` で 4 桁のコードを受け、`POST /api/v1/auth/request` でアプリ画面の認可の画面を開かせ、利用者が許可するとトークンを受け取る。どちらも IP ごとに 5 回/分。
- 認証つきの HTTP: 本文の検証 (TypeBox) → `preHandler` でトークンの検証 (`Authorization` ヘッダー) → トークンごとのレート制限 → ハンドラー。
  - `GET /state`: `PlayerStateStore.getState()` を `transformPlayerState` で API の形にして返す (5 秒に 1 回)。
  - `POST /command`: 値を確かめて `RemoteControl` に `execute` を送り、すぐ 204 を返す (1 秒に 2 回)。結果は待たない。
  - `GET /playlists`: `RemoteControl` に `invokeMessage("getPlaylists")` して YTM 画面の答えを待つ (30 秒に 1 回)。
- realtime: Socket.IO の `/api/v1/realtime` に handshake のトークンでつなぐと、`state-update` などが流れてくる。操作の結果はここで見る。
- `GET /metadata` (対応する版) だけは認証もレート制限も無い。
