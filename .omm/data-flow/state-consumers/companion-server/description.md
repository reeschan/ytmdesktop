再生状態を外部のクライアントへ流す連携機能。2 つの経路で聞く。

- Socket.IO (`api/v1/index.ts`): `state-changed` を `transformPlayerState` で API の形に直し、名前空間 `/api/v1/realtime` に `state-update` で送る。`playlist-created` / `playlist-deleted` も同名で送る。
- 名前付きパイプ (`index.ts` の IPC サーバー): `state-changed` を、バージョンを選んだクライアントへ `EVENT` の `state-update` として送る。
- `/state` の HTTP は `getState()` をその場で読む。
