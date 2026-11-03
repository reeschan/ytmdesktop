認証つきのルートにかかるレート制限。`hook: "preHandler"` なので、トークンの検証の後に走り、`keyGenerator` は `request.authId` (無ければ IP) をキーにする。

- `GET /state`: 5 秒に 1 回
- `GET /playlists`: 30 秒に 1 回 (YTM に本物の要求を出すため)
- `POST /command`: 1 秒に 2 回

超えると 429 を返す。
