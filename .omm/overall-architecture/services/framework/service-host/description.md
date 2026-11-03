Service を生成して持ち、ライフサイクルを進めるクラス `ServiceHost` (`src/main/services/servicehost.ts`)。

- コンストラクターで `ServiceCollection` の依存順に `new` し、`ServiceHost.INJECT` で自分を渡し、クラス名をキーに `Map` に入れる。
- `runNextLifecycle()` を呼ぶたびに `NotInitialized` → `PreInitialized` → `Initialized` → `PostInitialized` → `Terminated` と 1 段進め、その段のメソッドを全 Service に依存順で呼ぶ。
- `initialized` は Initialized か PostInitialized のとき true。`src/main/index.ts` は 2 つ目のインスタンスや `ytmd://` の URL を受けたとき、これが false なら処理しない。
- `getService(Class)` はクラス名で引く。
