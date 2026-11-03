曲の聞き取りの録音を受け持つ。`startSongRecognitionRecorder()` が `window.ytmdSongRecognitionRecorder` (`SONG_RECOGNITION_RECORDER_GLOBAL`) に、書き換えできない `{ record, cancel }` を置く。main はこれを `executeJavaScript` で呼ぶ。

- `record(source)`: 音の元に応じて、PC の音は `getDisplayMedia({ audio: true, video: true })` (映像のトラックはすぐ止める)、既定のマイクは `getUserMedia`、選んだデバイスは `deviceId: { exact }` で開く。デバイスが見つからなければ既定のマイクに切り替える。エコー除去・ノイズ抑制・自動ゲインは切る。
- `AudioContext` (`SONG_RECOGNITION_SAMPLE_RATE`) と、Blob URL で読み込む AudioWorklet (`ytmd-song-recognition-collector`) で `SONG_RECOGNITION_RECORD_SECONDS` 秒ぶんのモノラルの標本を集め、`encodePcmBase64` で `{ ok: true, pcm }` にして返す。失敗や中断は `{ ok: false }`。
- `cancel()`: 世代番号を進めて今の録音を中断する。新しい `record` も前の録音を中断してから始める。遅れて届いたストリームはすぐ止める。
- `enumerateDevices` の `audioinput` (`default` / `communications` の別名は除く) を、変わったときだけ `memoryStore.set("songRecognitionDevices", ...)` で出す。`devicechange` でも出し直す。設定画面の音の元の選択肢はこれを使う。
