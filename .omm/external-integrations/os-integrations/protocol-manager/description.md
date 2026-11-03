プロトコルの Service。2 つのスキームを受け持つ。

- `ytmd://`: OS に既定のプロトコルクライアントとして登録し、外から来た `ytmd://play/...` を YTM 画面の再生に変える (Discord のボタンの URL もこれ)。
- `ytmd-app://`: アプリ画面と背景動画のファイルを配る特権スキーム (`protocol.handle`)。OS とはつながらない。
