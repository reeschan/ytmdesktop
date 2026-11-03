`setup/extras.ts`。細かな付け足し 4 つ。

- `overrideHistoryButtonDisplay()`: `#history-link .history-button` を常に表示する。
- `hideChromecastButton()`: `ytmStateStore` に `SET_CAST_AVAILABLE: false` を dispatch し、YTM が後で戻してもストアを購読して打ち消す。
- `createAdditionalPlayerBarControls()`: プレイヤーバーに、ライブラリに保存・プレイリストに追加・スリープタイマーのボタンを足す。
- `addTimedLyrics()`: 歌詞のタブで、YTM の内部 API (`/youtubei/v1/browse`) から時間付きの歌詞を取り、再生位置に合わせて行を強調・自動スクロールする。行をクリックするとその位置へシークし、「Sync to video time」で自動スクロールに戻る。
