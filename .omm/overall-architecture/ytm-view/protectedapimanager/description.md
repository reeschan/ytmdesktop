`scripts/protectedapimanager.ts`。Protected API のページ側。

- `init()`: `MessageChannel` を作り、`port2` を `window.postMessage("ytmd-protected-api-port", "/", [port2])` で preload に渡す (preload が main へ `protectedApi:bindPort` で送る)。
- `createOrGetAPI(name)`: API ごとに別の `MessageChannel` を作り、元のポートで `{ op: ProvideAPIPort, name }` と一緒に `port2` を main に送る。手元には `port1` を持つ `ProtectedAPI` を返す。
- `ProtectedAPI` (EventTarget): main からの `Message` を同名の `CustomEvent` として出し、`Invoke` は `handleMessage` で登録した関数の結果を `InvokeResponse` で返す。`postMessage(name, ...args)` でページから main に送る。

今ある API は `PlayerState` (ページ → main) と `RemoteControl` (main → ページ、`getPlaylists` の Invoke)。
