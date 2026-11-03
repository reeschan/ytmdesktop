`YTMHook` が握る YouTube Music の内部オブジェクト。公開 API ではない。

- `ytmPlayerController.playerApi`: `getPlayerState()`・`getProgressState()`・`getPlayerResponse()`・`getPlaylistId()`・`playVideo()` などと、`onVideoProgress` / `onStateChange` / `onVideoDataChange` のイベント。
- `ytmStateStore.store`: `getState()` (キュー・いいねの状態・音量・ミュート・広告中) と `subscribe`、`dispatch`。
