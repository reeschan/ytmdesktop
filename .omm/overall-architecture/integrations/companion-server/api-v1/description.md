Fastify のプラグイン `CompanionServerAPIv1` (`/api/v1`)。Service は `options.getService` 経由で取る。

- `POST /auth/requestcode` (5 回/分): `companionServerAuthWindowEnabled` が真なら 4 桁のコードを返す。
- `POST /auth/request` (5 回/分): コードと appId を確かめ、Companion の認可のアプリ画面 (`ytmd-app://authorize-companion`、`new BrowserWindow` で直接作る、640x480) を出す。利用者が 30 秒以内に承認すればトークンを返し、認可の受付を閉じる。拒否・閉じる・接続切れ・時間切れは `AuthorizationDeniedError`。結果は `companionAuthorization:result:<requestId>` / `companionWindow:close:<requestId>` の IPC で受ける。
- `GET /state` (認証あり、5 秒に 1 回): `transformPlayerState` で整えた再生状態。
- `GET /playlists` (認証あり、30 秒に 1 回): `RemoteControl` API の `invokeMessage("getPlaylists")`。
- `POST /command` (認証あり、1 秒に 2 回): `sendCommand` で `RemoteControl` API に `execute` を送り、204 を返す。
- socket.io `/api/v1/realtime`: handshake の `auth.token` を確かめ、`PlayerStateStore` の `state-changed` / `playlist-created` / `playlist-deleted` を `state-update` などで流す。socket からのコマンドはコメントアウトされている。
- 全体に 100 回/分のレート制限。認証ありの制限は `authId` (無ければ IP) ごと。
- `transformPlayerState` は IPC サーバーからも使われる (版ごとの形の変換)。
