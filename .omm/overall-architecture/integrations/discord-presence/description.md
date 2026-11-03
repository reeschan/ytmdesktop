Discord のアクティビティ (Rich Presence) に再生中の曲を出す。有効にする設定は `integrations.discordPresenceEnabled`。外部ライブラリを使わず、`minimal-discord-client` で Discord クライアントのローカル IPC に直接つなぐ。

- 表示テンプレート (1 行目 `discordPresenceDetailsTemplate`・2 行目 `discordPresenceStateTemplate`・ジャケットの説明文 `discordPresenceLargeTextTemplate`)、ボタンの有無 `discordPresenceShowButton`、ステータスに出す欄 `discordPresenceStatusDisplay` を設定から読み、`src/shared/discord-presence/activity.ts` の `buildActivity` でアクティビティを作る。差し込み項目は `{title}`・`{artist}`・`{album}`。
- 仕様は `docs/specs/theme-bgvideo-discord.md`。
