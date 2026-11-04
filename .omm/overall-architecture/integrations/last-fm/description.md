Last.fm に再生中の曲 (Now Playing) と再生履歴 (scrobble) を送る。有効にする設定は `integrations.lastFMEnabled`。ビルド時に埋め込む `LASTFM_API_KEY` / `LASTFM_API_SECRET` が空、または safeStorage が使えないときは有効にならない。

- 認証は 3 段階で、段階を `MemoryStore` の `lastFMAuthenticationStep` に持つ (0: 未認証、1: ブラウザで許可待ち、2: 済み)。設定画面の `lastfm:authenticate` (IPC) で進む。
- セッションキーは `safeStorage` で暗号化して `lastfm.sessionKey` に保存する。
