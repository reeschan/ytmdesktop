ページ側の Protected API (`scripts/protectedapimanager.ts`)。`MessageChannel` を作り、片方のポートを `window.postMessage("ytmd-protected-api-port", ...)` で preload に渡す。

- `createOrGetAPI(name)` で API ごとに新しい `MessageChannel` を作り、親ポートに `ProvideAPIPort` を送ってメインプロセスへ片方を渡す。
- `ProtectedAPI` は `EventTarget`。`Message` を同名の `CustomEvent` にし、`Invoke` は `handleMessage` で登録した処理の戻り値を `InvokeResponse` で返す。
