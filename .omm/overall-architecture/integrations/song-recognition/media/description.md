mainView での録音と、既定のセッションの権限。

- `installSongRecognitionMediaHandlers(getter)` (`index.ts` が mainView を作った直後に呼ぶ): `session.defaultSession` の
  - `setPermissionRequestHandler`: `media` は mainView からで映像を含まないときだけ、`display-capture` は mainView からのときだけ許す。他の権限は許す。
  - `setPermissionCheckHandler`: `media` と `display-capture` は mainView だけ真。
  - `setDisplayMediaRequestHandler`: mainView のメインフレームからなら、`desktopCapturer` の最初の画面と `audio: "loopback"` (PC の音) を渡す。
- `recordOnAppView(contents, source)`: mainView で `window.ytmdSongRecognitionRecorder.record(source)` を `executeJavaScript` で呼ぶ。録音器が無い・例外・形が違う・5 秒 + 10 秒以内に返らない、のどれでも `{ ok: false }`。時間切れなら `cancel()` も呼ぶ。
- `cancelRecordingOnAppView(contents)`: `cancel()` を呼び、失敗は無視する。
