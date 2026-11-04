`scripts/ytmhook.ts`。YouTube Music の依存性注入から、プレイヤーのコントローラーと状態ストアの実体を横取りする。`Map.prototype.set` を差し替え、キーの `name` が `PLAYER_CONTROLLER_TOKEN` なら `useClass` を Proxy で包んで生成されたインスタンスを、`STATE_STORE_TOKEN` なら `useFactory` を Proxy で包んで返り値を覚える。`ready()` は両方そろうまで待つ。

他のスクリプトは `ytmPlayerController.playerApi` (再生・音量・シークなど) と `ytmStateStore.store` (Redux 風の `getState` / `dispatch` / `subscribe`) をここから使う。
