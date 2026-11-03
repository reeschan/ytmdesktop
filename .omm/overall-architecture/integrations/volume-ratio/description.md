YouTube Music の音量スライダーを 3 乗のカーブにする `VolumeRatio` (GreasyFork の「YouTube Music fix volume ratio」が元)。有効にする設定は `playback.ratioVolume`。YTM 画面に 3 つのスクリプト (`script/*.script.js`、`?raw` で文字列として import) を `executeYTMScript` で流すだけで、main 側に状態はほぼ無い。

- 有効: YTM 画面の準備を待って enable のスクリプトを流し、続けて今の音量を当て直す。YTM 画面の作り直し (`view-recreated`) でも流し直す。
- 無効: disable のスクリプトで元に戻し、音量を当て直す。
