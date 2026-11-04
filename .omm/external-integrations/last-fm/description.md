Last.fm へ scrobble する連携機能 (`integrations.lastFMEnabled`)。`last-fm-client/` が `https://ws.audioscrobbler.com/2.0/` に `fetch` で POST する (署名つき、User-Agent は `YTMDesktop/<版>`)。

- 認証: 設定画面の `lastfm:authenticate` で `auth.getToken` → 既定のブラウザーで `https://www.last.fm/api/auth/` を開いて利用者が許可 → もう一度押すと `auth.getSession` でセッションキーを取る。段階は `MemoryStore` の `lastFMAuthenticationStep` (0〜2)。
- セッションキーは `safeStorage` で暗号化して `lastfm.sessionKey` に置く。
- 送るもの: `track.updateNowPlaying` と `track.scrobble`。
- API キーと秘密がビルドに無い、または `safeStorage` が使えないときは有効にならない。
