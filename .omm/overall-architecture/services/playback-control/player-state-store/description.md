YTM 画面の再生状態 (曲の情報・再生か一時停止か・進み・キュー・音量・ミュート・広告中) を持つ Service (`src/main/services/playerstatestore/index.ts`)。`EventEmitterService`。依存は AppWindowManager・ProtectedAPIManager・StateManager。

- `onInitialized` で `PlayerState` API を作り、`updateVideoProgress`・`updateVideoState`・`updateVideoDetails`・`updateFromStore`・`playerSignal`・`playlistCreated`・`playlistDeleted` を購読する。
- YTM の生の値 (動画の状態の数値・`LIKE` などの文字列・キューの renderer 構造) を `src/shared/playerstatestore/types` の型に変換する。キューの選択位置は YTM の `selectedItemIndex` を使わず、`selected` の項目から数え直す。
- 変化のたびに、Miniplayer と Settings のウィンドウへ `playerStateStore:stateChanged` を送り、Main と Miniplayer のタイトルを「曲名 - アーティスト | YTMDesktop」に変え、StateManager に `lastVideoId` / `lastPlaylistId` を渡し、`state-changed` を出す。
- イベント: `state-changed`・`playlist-created`・`playlist-deleted`・`player-signal`。TaskbarManager と Integration (Discord・Last.fm・Companion Server など) が購読する。
