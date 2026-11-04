Discord の Rich Presence を出す連携機能 (`integrations.discordPresenceEnabled`)。HTTP ではなく、手元の Discord クライアントのローカル IPC に自前の小さなクライアント (`minimal-discord-client`) でつなぐ。

- つながらなければ最大 30 回まで繰り返す。
- 送る中身は表示テンプレート (1 行目・2 行目・ジャケットの説明文)・ボタンの有無・表示の種類から `~shared/discord-presence/activity` の `buildActivity` が作る。
