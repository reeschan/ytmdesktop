`state-changed` と `player-signal` から Last.fm へ「再生中」と scrobble を送る連携機能。セッションキーが無いあいだは何もしない。

- 曲 ID が変わり `hasFullMetadata` が真のとき、scrobble に要る再生時間を決める (曲の長さ × `lastfm.scrobblePercent` (50〜100%) と 240 秒の短い方)。30 秒未満の曲は数えない。
- その曲で最初に再生中になったとき `track.updateNowPlaying` を 1 回送り、以後は再生中の通知ごとに 1 秒単位で時間を足す。要る時間に届くと `track.scrobble` を 1 回送る。
- `player-signal` の `NewPlayback` で今の曲 ID を忘れ、同じ曲のループも新しい再生として数え直す。
