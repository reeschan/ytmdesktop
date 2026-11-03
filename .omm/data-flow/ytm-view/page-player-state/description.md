ページ側で再生状態を集めて送る処理 (`scripts/playerstatestore.ts` の `init`)。`PlayerState` API を作り、次のメッセージを送る。

- `updateVideoProgress` (`onVideoProgress`)、`updateVideoState` (`onStateChange`)
- `updateVideoDetails` (`onVideoDataChange` の `dataloaded` / `dataupdated`): 曲名・サムネイルをキューの選択中の項目で補い、アルバムを `longBylineText` から拾う。オフライン時は今の曲のサムネイルだけ CacheStorage から data URL に直す。
- `updateFromStore` (`store.subscribe`): キュー・いいねの状態・音量・ミュート・広告中。ストアの全体は送らない。
- `playerSignal("NEW_PLAYBACK")` (`newdata`)、`playlistCreated` / `playlistDeleted` (`yt-action`)
- 初回は `hydrateApplicationState()` で一通り送る。
