(外部) YTM 画面のページの `HTMLMediaElement` (再生中の音声・動画の要素) と、YTM のプレイヤー API・状態ストア (`window.__YTMD_HOOK__` 経由)。スクリプトは YTM 画面の preload が `webFrame.executeJavaScript` で評価し、返った関数を呼ぶ。
