YTM 画面で動く YouTube Music そのもの。再生状態の出どころであり、操作の最終的な宛先でもある。

- 状態の元: `playerApi` (`ytmPlayerController.playerApi`) のイベント `onVideoProgress` / `onStateChange` / `onVideoDataChange` と、ストア (`ytmStateStore.store`) の `subscribe`。プレイリストの作成・削除は `yt-action` イベントで拾う。
- 操作の先: `playerApi.playVideo()` / `pauseVideo()` などのメソッド、ストアの `dispatch`、`yt-navigate` / `yt-action` のカスタムイベント。
