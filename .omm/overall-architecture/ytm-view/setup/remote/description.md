`setup/remote.ts`。`createOrGetAPI("RemoteControl")` で main からの操作を受け、YTM 画面で実行する。ミニプレイヤー・Companion Server・グローバルショートカット・Enhanced media service などの操作はすべてここに届く。

- `execute` (Message): 先頭の引数がコマンド。`playPause` / `play` / `pause` / `next` / `previous` / `seekTo` / `setVolume` / `volumeUp` / `volumeDown` / `mute` / `unmute` / `toggleMute` / `repeatMode` / `cycleRepeatMode` / `shuffle` は主に `playerApi` と `ytmStateStore.store.dispatch` で、`toggleLike` / `toggleDislike` はプレイヤー画面の高評価ボタンの service endpoint で、`navigate` は `yt-navigate`、`playQueueIndex` / `queueAdd` / `queueRemove` / `queueMove` は `ytmusic-app` に `yt-action` (`yt-service-request` など) を投げて行う。
- `getPlaylists` (Invoke): `addToPlaylistEndpoint` の `yt-service-request` を投げ、返ってきた一覧から `{ id, title }` を作って返す (`getYTMTextRun` で題名をつなぐ)。
