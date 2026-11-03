YTM の内部オブジェクトを握るフック (`YTMHook`)。`Map.prototype.set` を差し替え、YTM の DI が `PLAYER_CONTROLLER_TOKEN` を登録するときは `useClass` を Proxy で包んでインスタンスを、`STATE_STORE_TOKEN` のときは `useFactory` を包んで戻り値を取っておく。

- `ready()` は両方そろうまで待つ。そろうと `window.__YTMD_HOOK__` に凍結して置き、preload の `executeJavaScript` からも使えるようにする。
- YTM のページより先に動く必要があるため、preload が scripts を入れた直後に `init()` される。
