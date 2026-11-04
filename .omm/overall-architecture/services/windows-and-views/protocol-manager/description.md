アプリ内の `ytmd-app://` と OS の `ytmd://` を受け持つ Service (`src/main/services/protocolmanager/index.ts`)。依存は YTMViewManager・ProtectedAPIManager・ConfigStore。

- `onPreInitialized` で `ytmd-app` を `standard`・`secure`・`stream` の特権付きスキームに登録する (`app` の `ready` より前でないと登録できない)。
- `onInitialized` で既定のセッションに `protocol.handle("ytmd-app", ...)` を付け、`ytmd` の既定のプロトコルクライアントに自分を登録する (開発中も登録する)。
- `ytmd-app://<host>/...` は host (`main`・`titlebar`・`settings`・`miniplayer`・`updater`・`changelog`・`authorize-companion`・`background-video`) ごとに `app.asar/.vite/renderer/windows/<host>` のファイルを `net.fetch` で返す。`/assets/` は共通の `renderer/assets` から返す。不明な host は 404。
- `ytmd-app://background-video-file/...` は、パスに関係なく設定の `appearance.backgroundVideoPath` のファイルだけを返す。背景動画が無効・ファイルが無いときは 404。`Range` ヘッダーに応じて 206 / 416 を返し、`<video>` のシークに使える。
- `handleYTMDProtocol(url)` は `ytmd://play/<videoId>/<playlistId>` を受け、`RemoteControl` API に `navigate` の `watchEndpoint` を送る。`src/main/index.ts` の `second-instance` と `open-url` から呼ぶ。
