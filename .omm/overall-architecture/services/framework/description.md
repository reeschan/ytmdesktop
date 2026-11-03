Service の土台。`service.ts`・`servicecollection.ts`・`servicehost.ts` の 3 ファイル。

- `Service`: 全 Service の抽象クラス。`static dependencies` と 4 つのライフサイクル (`onPreInitialized` / `onInitialized` / `onPostInitialized` / `onTerminated`) を持ち、`getDependency` で依存先を取る。イベントを出す Service は `EventEmitterService` を継承する。
- `ServiceCollection`: 登録された Service を依存先が先に来る順に並べる。
- `ServiceHost`: その順で Service を生成し、`runNextLifecycle()` でライフサイクルを 1 段ずつ全 Service に流す。
