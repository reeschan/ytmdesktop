クラッシュ処理とログ設定を受け持つ Service (`src/main/services/watchdog/index.ts`)。依存はなし。

- `onInitialized` で `crashReporter.start({ uploadToServer: false })` を呼び、electron-log の書式を決め、`log.errorHandler.startCatching` でメインプロセスの未処理エラーを拾う。
- エラーを拾うと状態を `Crashed` にし、`on("crash")` で登録されたコールバック (StateManager の書き込み停止など) を順に実行してから、エラー内容をダイアログで出す。「Copy to Clipboard and Exit」「Exit」で `app.exit(1)`。パッケージ前のビルドでは「Continue」も選べる。
- ファイルに書くログから、URL のパス部分を `[REDACTED]` に置き換えるフックを入れる。
