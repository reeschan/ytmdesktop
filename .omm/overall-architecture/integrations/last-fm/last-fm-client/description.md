Last.fm API の小さなクライアント `LastFMClient`。メソッドは `getToken` (`auth.getToken`)・`getSession` (`auth.getSession`、得たキーを自分にも持つ)・`updateNowPlaying` (`track.updateNowPlaying`)・`scrobble` (`track.scrobble`)。

- `call()`: null の引数を除き、`method`・`api_key`・(認証ありなら) `sk` を足し、キーの順に並べて連結した文字列 + シークレットの md5 を `api_sig` にして、`format=json` で POST する。`User-Agent` は `YTMDesktop/<版>`、15 秒で打ち切る。
- 429・レート制限・5xx・一時的な失敗は `Retry-After` か指数バックオフ (最大 60 秒) で 5 回まで試し直す。
- セッションキーが無効のエラーでキーを捨て、API キー停止のエラーで以後の呼び出しをすべて止める。
