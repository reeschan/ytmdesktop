曲の聞き取り (`SongRecognition`、`integrations.shazamEnabled`、ADR 0003)。YTM 画面の検索欄の横のボタンで始まり、音の元を 5 秒録り、Shazam に曲名とアーティストを問い合わせ、その文字列で YTM 画面の検索欄から検索する。

- 録音はローディング画面 (`ytmd-app://` のアプリ画面) の中で行い、YTM 画面には権限を渡さない。
- Shazam への問い合わせはメインプロセスが利用者の API Key で行う。
- `integrations.shazamApiKey` が変わると再起動する (`dependentStoreProperties`)。
