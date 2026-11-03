曲の聞き取りの定数と型 (テストは無い)。

- 音の元: `SongRecognitionSourceKind` (`pc-audio`・`default-mic`・`device`)、保存する設定 `SongRecognitionSourceSetting` (既定は PC の音)、実際に録る元 `SongRecognitionRecordSource`、入力デバイス `SongRecognitionInputDevice`。
- 段階 `SongRecognitionPhase` (idle・recording・searching・message)、失敗の種類 `SongRecognitionResultKind` と表示文 `SONG_RECOGNITION_MESSAGE_TEXT`、YTM 画面に送る `SongRecognitionViewState`。
- 数値: 録音 5 秒、44.1kHz、メッセージ 4 秒、問い合わせの時間切れ 15 秒。Shazam の URL・ホスト・API キーの取得ページ (`SHAZAM_API_KEY_URL`)。
- 名前: main と YTM 画面の IPC `SongRecognitionIpc` (`songRecognition:state` / `search` / `press`)、YTM 画面の preload とページの postMessage `SongRecognitionMessageOp`、mainView の録音器の global 名 `ytmdSongRecognitionRecorder` とその型 `SongRecognitionRecorder` / `SongRecognitionRecording`。
- import 元: main の `index.ts`・song-recognition の Integration・`configstore`、mainView の録音器、YTM 画面の preload と `scripts/setup/song-recognition.ts`、設定のアプリ画面、`store/schema.ts`。
