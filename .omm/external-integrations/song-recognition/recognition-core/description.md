曲の聞き取りの本体 (`SongRecognition`)。状態の遷移は `~shared/song-recognition/state` の `decideSongRecognition` (純関数) に任せ、出てきた効果 (録る・問い合わせる・検索する・一時停止 / 再開する) をここで実行する。

- ボタンを見せるのは、API Key があり `safeStorage` が使えるときだけ。
- 押されたら録音を頼み、PC の音で再生中なら前後で `RemoteControl` の `pause` / `play` を送る。
- 録れた PCM を `detectSong` に渡し、15 秒で `AbortController` で打ち切る。答えは `interpretShazamResponse` で検索の文字列か知らせに直す。
- 状態は YTM 画面の preload へ `songRecognition:state`、検索は `songRecognition:search` で送る。
