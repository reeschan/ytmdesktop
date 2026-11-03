`ProtectedAPIManager.createOrGetAPI("RemoteControl")`。HTTP のハンドラーから YTM 画面への唯一の通り道。

- `postMessage("execute", コマンド, ...引数)`: 投げっぱなし。ポートが無ければ何もしない。
- `invokeMessage("getPlaylists")`: `randomUUID` の id で答えを待ち、30 秒で reject する。`/playlists` はこれを `YOUTUBE_MUSIC_TIME_OUT` (504) にする。
