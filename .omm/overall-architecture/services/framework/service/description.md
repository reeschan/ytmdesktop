全 Service の抽象クラス `Service` と、イベントを出せる `EventEmitterService<T>` (`src/main/services/service.ts`)。

- `static dependencies: DependencyConstructor<Service>[]` に依存先を並べる (既定は空)。
- 4 つの抽象メソッド `onPreInitialized` / `onInitialized` / `onPostInitialized` / `onTerminated` を全 Service が実装する。
- `getDependency(Service)` は `dependencies` に含まれるかを確かめてから、注入された `ServiceHost` の `getService` を呼ぶ。
- `ServiceHost.INJECT` (Symbol) のメソッドで `ServiceHost` を受け取り、private の `#host` に持つ。
- `EventEmitterService` は Node の `EventEmitter` を包み、イベント名と引数を型で縛った `on` / `once` / `off` / `emit` を出す。
