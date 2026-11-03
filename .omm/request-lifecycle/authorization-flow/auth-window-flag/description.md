`MemoryStore` の `companionServerAuthWindowEnabled`。`CompanionServer` が `memoryStore.onStateChanged` で見張り、真になってから 5 分で偽に戻す。トークンを 1 つ発行したとき、連携機能を無効にしたときも偽にする。
