任意機能 (Integration) の生成と有効・無効の切り替えを受け持つ Service (`src/main/services/integrationmanager/index.ts`)。依存は ConfigStore だけ (FlagManager はコメントアウト)。`src/main/index.ts` で最後に登録する。

- `ServiceHost.INJECT` を上書きして `ServiceHost` を自分で持つ唯一の Service。`createIntegrations([...])` で Integration を生成し、その `ServiceHost` を注入するので、Integration はどの Service でも `getService` で取れる。
- `runHook(AppBeforeReady)` で各 Integration の SETUP を呼び、`runHook(AppReady)` で設定に合わせて有効化する。
- `onPostInitialized` で `configStore.onDidAnyChange` を購読し、変化のたびに各 Integration の `storeEnableProperty` を見て ENABLE / DISABLE を呼ぶ。有効なままでも `dependentStoreProperties` が変わったら DISABLE → ENABLE で作り直す。
- 有効化 (作り直しを含む) で `onEnabled` が投げたら捕まえて `enable-error` を出し、`src/main/index.ts` が警告ダイアログを出す。失敗した Integration は無効のまま `failedIntegrations` に入れ、設定でオフにされるまで有効化を試みない。
