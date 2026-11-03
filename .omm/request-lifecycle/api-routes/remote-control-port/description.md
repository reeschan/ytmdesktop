この図の外の `RemoteControl` の `ProtectedAPI`。ハンドラーは `options.getService(ProtectedAPIManager).createOrGetAPI("RemoteControl")` で取る。`postMessage` は投げっぱなし、`invokeMessage` は 30 秒まで答えを待つ。
