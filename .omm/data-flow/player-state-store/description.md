メインプロセスで再生状態を持つ Service (`PlayerStateStore`、`EventEmitterService`)。`PlayerState` API のメッセージを受けて、YTM の生の形をアプリの型 (`~shared/playerstatestore/types` の `PlayerState`・`VideoState`・`RepeatMode`・`LikeStatus`・`VideoType`) に直して持つ。

- 変換: 再生状態の数値を `VideoState` に、キューの各項目を `PlayerQueueItem` に、`selectedItemIndex` は `selected` から自分で求める。
- 変わるたびに `stateChanged()` が、Miniplayer と Settings のウィンドウへ `playerStateStore:stateChanged` を送り、Main と Miniplayer のタイトルを曲名にし、`StateManager` に `lastVideoId` / `lastPlaylistId` を渡し、`state-changed` を出す。
- ほかのイベント: `player-signal` (`NEW_PLAYBACK`)、`playlist-created`、`playlist-deleted`。
- `getState()` で今の状態を返す (Settings・Miniplayer の `playerStateStore:getState`、Companion Server の `/state` など)。
