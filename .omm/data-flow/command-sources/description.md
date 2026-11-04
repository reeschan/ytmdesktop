YTM 画面のプレイヤーを操作する入口の集まり。どれも `ProtectedAPIManager.createOrGetAPI("RemoteControl")` に `postMessage("execute", <コマンド>, ...引数)` を送るだけで、YTM 画面を直接は触らない。

- トレイのメニュー・タスクバーのサムネイルボタン・グローバルショートカット・ミニプレイヤー (`remoteControl:execute` の IPC)
- Companion Server の `/command` と `/playlists` (後者は `invokeMessage("getPlaylists")`)
- EnhancedMediaService (OS のメディア操作のボタンとシーク)
- ProtocolManager (`ytmd://play/<videoId>/<playlistId>` を `navigate` に変える)
- SongRecognition (PC の音を録る間の `pause` / `play`)
