ConfigStore の `state` キー (最後に開いた URL・曲・プレイリスト・ウィンドウの位置など) への書き込みをまとめる Service (`src/main/services/statemanager/index.ts`)。依存は ConfigStore と WatchDog。

- `onPostInitialized` で `configStore.get("state")` を手元に写し、WatchDog の `crash` を購読する。
- `updateState(partial)` は浅い比較で変化があるときだけ手元を更新し、30 秒のタイマーで ConfigStore に書く。たまった変更が 512 回に達したらすぐ書く。
- `forceWrite()` はタイマーを待たずに書く。`onTerminated` と `src/main/index.ts` の終了処理から呼ぶ。
- 呼び出し元: YTMViewManager (`lastUrl`)・PlayerStateStore (`lastVideoId` / `lastPlaylistId`)・`src/main/index.ts` (ウィンドウの位置と最大化)。
