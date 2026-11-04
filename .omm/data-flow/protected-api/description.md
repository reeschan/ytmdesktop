メインプロセス側の Protected API の受け口 (`ProtectedAPIManager`)。YTM 画面の preload が `protectedApi:bindPort` で送ってきた親ポートを持ち、ページが `ProvideAPIPort` で送る API ごとのポートを `ProtectedAPI` (EventEmitter) に結ぶ。

- 受信: `Message` は同名のイベントとして `emit` する。`PlayerStateStore` はこれを `on("updateVideoProgress", ...)` などで聞く。
- 送信: `postMessage(name, ...args)` は投げっぱなし、`invokeMessage` は `InvokeResponse` を 30 秒まで待つ (`RemoteControl` の `getPlaylists` で使う)。
- 親ポートを結び直すと、既存の API のポートをすべて外す。YTM 画面の読み込み直しのたびに結び直される。
