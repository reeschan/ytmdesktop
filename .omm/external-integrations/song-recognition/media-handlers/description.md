録音のための権限と取り込みの設定 (`media.ts`)。`installSongRecognitionMediaHandlers` が既定のセッションに次を入れる (`src/main/index.ts` がローディング画面を作るときに呼ぶ)。

- 権限: マイク (映像を含まないもの) と画面の取り込みは、ローディング画面の webContents にだけ許す。
- `setDisplayMediaRequestHandler`: 画面のソースとループバックの音声を渡し、PC の音を録れるようにする。
- `recordOnAppView` は録音の関数を `executeJavaScript` で呼び、5 秒 + 10 秒の余裕で打ち切る。`cancelRecordingOnAppView` で取り消す。
