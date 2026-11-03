`RemoteControl` API の受け手 (`setup/remote.ts`)。`execute` の最初の引数をコマンド名として、YTM のプレイヤーとストアを操作する。

- コマンド: `playPause` / `play` / `pause` / `next` / `previous` / `toggleLike` / `toggleDislike` / `volumeUp` / `volumeDown` / `setVolume` / `mute` / `unmute` / `toggleMute` / `repeatMode` / `cycleRepeatMode` / `seekTo` / `shuffle` / `playQueueIndex` / `navigate` / `queueAdd` / `queueRemove` / `queueMove`
- `handleMessage("getPlaylists")`: `yt-action` の `yt-service-request` (`addToPlaylistEndpoint`) を投げ、YTM の応答からプレイリストの ID と名前を返す。
- 操作の結果は返さない。変わった状態は再生状態の送り出しを通って戻る。
