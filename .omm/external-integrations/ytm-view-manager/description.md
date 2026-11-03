YTM 画面のビューを作る Service (`YTMViewManager`)。music.youtube.com を `WebContentsView` で、partition `persist:ytmview` (開発時は `persist:ytmview-dev`)・sandbox・contextIsolation で開く。前回の URL が music.youtube.com のものならそこから開く。

- 遷移・リダイレクトを `isPreventedNavOrRedirect` で絞り、許さない先は止める。止めた遷移のうち Google / YouTube の URL は既定のブラウザーで開く。
- 地域が Premium 必須のとき (`/premium` などへのリダイレクト) は、Google のログインのページへ読み直す。
- 権限は `fullscreen` だけを YTM 画面に許す。
- 応答しない・読み込みに失敗したときはイベントを出し、ローディング画面を前に出す。
