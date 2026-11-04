`state-changed` (と設定の `playback`) のたびに、Main ウィンドウのタスクバーを作り直す Service (`reconcileTaskbar`)。

- サムネイルボタン (前へ・再生 / 一時停止・次へ) を `setThumbarButtons` で付け直す。再生中かでアイコンを替え、曲が無ければ無効にする。ボタンは `RemoteControl` に送る。
- `playback.progressInTaskbar` が真なら、進み具合 ÷ 長さを `setProgressBar` に出す。
