`CompanionServer.createServer()` が作る Fastify (`TypeBoxTypeProvider`)。`0.0.0.0:9863` で待ち受ける。

- 登録の順: `@fastify/cors` (`origin` は `*` か無し) → `fastify-socket.io` (WebSocket だけ) → API v1 (`/api/v1`、`getService` を渡す)。
- `setErrorHandler`: 決まった API のエラーでない 500 番台はログに出し、中身を隠して返す。それ以外はそのまま返す。
- `GET /metadata`: `{ apiVersions: ["v1"] }`。認証もレート制限も無い。
