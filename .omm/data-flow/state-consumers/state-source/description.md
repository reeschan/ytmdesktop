`PlayerStateStore` が出すもの。この図の入力として置く。

- `state-changed` (`PlayerState` 全体): 進み具合・再生状態・曲の詳細・キュー・音量・ミュート・広告中・`hasFullMetadata`
- `player-signal` (`PlayerSignal.NewPlayback`): 新しい再生が始まった合図
- `playlist-created` (`{ title, id }`) / `playlist-deleted` (`playlistId`)
