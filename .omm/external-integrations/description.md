アプリの外にある相手と、それぞれと何のためにどうつながるか。

- YouTube Music (music.youtube.com): YTM 画面として開く本体。ログインのときだけ Google のアカウントのページへの遷移を許す。
- Discord: 手元で動く Discord クライアントへ、ローカルの IPC (名前付きパイプ / UNIX ソケット) で Rich Presence を送る。
- Last.fm: HTTPS の API (ws.audioscrobbler.com) で「再生中」と scrobble を送る。認可はブラウザーで行う。
- Shazam: RapidAPI の Shazam (shazam.p.rapidapi.com) に録った音を送り、曲を調べる (ADR 0003)。
- Companion のクライアント: LAN から Fastify の HTTP (ポート 9863) と Socket.IO (WebSocket だけ)、同じ PC からは名前付きパイプでつながる。mDNS で自分を広告する。
- 更新: update.electronjs.org (GitHub Releases を Squirrel 形式で配る) から更新を取る。変更履歴の本文も同じところから取る。
- OS: メディア操作 (xosms)・タスクバー・通知・グローバルショートカット・トレイ・`ytmd://` プロトコル・ログイン時の起動。
