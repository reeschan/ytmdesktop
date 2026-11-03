Discord の RPC をアクティビティの設定だけに絞ったクライアント `DiscordClient` (EventEmitter)。`types.ts` は `src/shared/discord-presence/activity.ts` の `DiscordActivity` などを再 export するだけ。

- `connect()`: `discord-ipc-0` から `discord-ipc-9` まで順に試す。Windows は `\?\pipe\discord-ipc-N`、他は `$XDG_RUNTIME_DIR` などの下で、snap (`snap.discord/`) と flatpak (`app/com.discordapp.Discord/`) の置き場所も見る。つながったら `{ v: 1, client_id }` を HANDSHAKE で送り `connect` を出す。切れたら `close` を出す。
- `setActivity(activity)` / `clearActivity()`: `SET_ACTIVITY` (pid 付き、nonce は UUID) を送る。消すときは `activity` を省く。
- 同時に走る `connect()` は 1 つの Promise にまとめる。
