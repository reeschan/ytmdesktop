Socket.IO の名前空間 `/api/v1/realtime`。接続のミドルウェアでトークンを確かめ、`socket.data.tokenId` に覚える。

- 送るもの: `state-update` (`state-changed` のたびに `transformPlayerState` した状態)、`playlist-created`、`playlist-deleted`。名前空間の全員に同じものを送る。
- クライアントからのコマンドは受けない (コメントアウトされている)。
- 既定の名前空間 (`/`) への接続はすぐ切る。トークンが取り消されると、その tokenId の接続を切る。
- サーバーを閉じるとき (`onClose`) に PlayerStateStore の聞き取りを外す。
