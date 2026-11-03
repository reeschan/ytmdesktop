曲が変わったときの OS の通知 `NowPlayingNotifications`。有効にする設定は `general.showNotificationOnSongChange`。

- `PlayerStateStore` の `state-changed` で、Playing かつ前回と違う曲 ID のときだけ通知する。
- 題名は曲名、本文はアーティスト、`silent: true`、Linux では `urgency: "low"`。5 秒後に閉じる。
- アイコンには 100x100 より大きいジャケットのうち一番小さいものを `https.get` で取り、base64 の JPEG として `nativeImage` にする。取れなければアイコン無しで出す。
