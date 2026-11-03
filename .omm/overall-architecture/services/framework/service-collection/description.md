起動する Service の集合と並べ順を受け持つクラス `ServiceCollection` (`src/main/services/servicecollection.ts`)。

- `addServices([...])` はクラス名をキーに登録する。同じ名前が 2 回来ると例外。
- `getDependencyOrderedServices()` は登録順に深さ優先で `dependencies` をたどり、依存先を先に置いた配列を返す。依存先が未登録なら例外、たどっている途中に同じ Service がまた出たら循環依存として例外。
