`PlayerStateStore` のイベントを聞いて外へ出す側。連携機能 (Integration) は有効なあいだだけ `on` し、無効化で `off` する。Service (TaskbarManager) は起動後ずっと聞く。

聞いているイベント (コードで確かめたもの):
- `state-changed`: DiscordPresence・LastFM・NowPlayingNotifications・EnhancedMediaService・CompanionServer (Socket.IO と名前付きパイプの両方)・SongRecognition (録音中だけ)・TaskbarManager
- `player-signal`: LastFM
- `playlist-created` / `playlist-deleted`: CompanionServer (Socket.IO)

イベントではなく `stateChanged()` から直接呼ばれるもの: Miniplayer / Settings への IPC、ウィンドウのタイトル、`StateManager`。
