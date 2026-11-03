アプリ画面の webContents。ThemeManager が CSS を入れる先。

- 対象は URL が `ytmd-app:` で始まるもの (開発時は Vite の dev server と同じ origin のもの)。
- 入れるのは色項目の CSS 変数だけ。各画面の CSS はこの変数から色を取る。
- ドキュメントを読み込み直すと入れた CSS は消えるので、`dom-ready` ごとに入れ直す。
