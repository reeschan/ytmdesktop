背景動画を受け持つ Service (`BackgroundVideoManager`)。`appearance` の背景動画のキー (有効・元・ファイル・マスクの濃さとぼかし) が変わったときだけ動く。

- YTM 画面の下に背景動画のビューを置き (ADR 0001)、YTM 画面のページの背景を透明にする CSS を `insertCSS` し、ビューの背景色をテーマの背景色にする。
- ビューと YTM 画面の preload へ、それぞれの状態を IPC で送る。YTM 画面からは再生中の動画が使えるかの報告 (`BackgroundVideoIpc.Report`) を受ける。
- ThemeManager の `colors-changed` でマスクの色を、`ytm-theme-applied` で CSS を合わせ直す。
