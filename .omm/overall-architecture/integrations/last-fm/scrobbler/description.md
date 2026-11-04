Integration 本体 `LastFM`。`PlayerStateStore` の `state-changed` と `player-signal` を聞く。

- 認証: `onEnabled` で `ipcMain` の `lastfm:authenticate` にリスナー (フィールドの `authenticateListener`) を付け、`onDisabled` で外す。段階 0 なら `auth.getToken` のトークンを `MemoryStore` の `lastFMToken` に置き、ブラウザで認可ページを開いて段階 1 へ。段階 1 なら `auth.getSession` でセッションキーを得て暗号化して保存し、段階 2 へ。
- 認証の失敗 (オフラインなど) は捕まえてログに残す。トークンが取れなければ段階 0 に戻し、セッションが取れなければ段階 1 のままにして、もう一度押せるようにする。
- 曲が変わったら (`hasFullMetadata` が真で、30 秒以上の曲だけ)、scrobble に要る再生時間を「曲の長さ × `lastfm.scrobblePercent` (50〜100%)」と 240 秒の短い方にする。
- Playing のあいだ、最初の 1 回で `track.updateNowPlaying` を送り、状態が届くたびに 1 秒以上空いていれば再生時間を 1 秒足す。要る時間に達したら、再生を始めた時刻で `track.scrobble` を 1 回送る。
- `PlayerSignal.NewPlayback` (新しい再生・ループ) で今の曲を忘れ、同じ曲でもまた数え直す。
