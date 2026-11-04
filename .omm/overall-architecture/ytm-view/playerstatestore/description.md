`scripts/playerstatestore.ts`。再生の状態を Protected API の `PlayerState` で main の PlayerStateStore に送る。

- `playerApi` の `onVideoProgress` → `updateVideoProgress`、`onStateChange` → `updateVideoState`、`onVideoDataChange` (新しい曲は `playerSignal: NEW_PLAYBACK`、読み込み完了で `sendVideoData`)。
- `ytmStateStore.store.subscribe` → `updateFromStore` (キュー・高評価の状態・音量・ミュート・広告中か)。ストアには敏感なデータもあるので、要るものだけを抜き出して送る。
- `sendVideoData` → `updateVideoDetails` (曲の詳細・プレイリスト ID・アルバム・高評価の状態)。サムネイルは YTM の CacheStorage にあれば data URL に置き換える。
- `yt-action` からプレイリストの作成・削除を拾って `playlistCreated` / `playlistDeleted`。
- 初期化の最後に、今の状態をまとめて送る。`waitForYTMPlayerApiReady()` は `playerApi.isReady()` を 250ms ごとに見て待つ。
