YTM 画面の webContents (partition `persist:ytmview`、開発時は `persist:ytmview-dev`)。設定から来る見た目が集まる先。

- 入る順: ThemeManager のテーマ → (`ytm-theme-applied` を受けて) CustomCSS と BackgroundVideoManager の透明化。
- ほかに `setZoomFactor` (ズーム)、ビューの `setBackgroundColor`、preload への背景動画の状態が届く。
- 読み込み直しやビューの再生成で CSS は消えるため、各受け手は `ready` / `view-recreated` で入れ直す。
