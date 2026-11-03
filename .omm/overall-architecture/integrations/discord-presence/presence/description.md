Integration 本体 `DiscordPresence` (Discord のアプリ ID は `1143202598460076053`)。

- `onEnabled`: `DiscordClient` を作って接続し、`PlayerStateStore` の `state-changed` と `ConfigStore` の `integrations` の変更を聞く。
- 再生状態: `hasFullMetadata` で、状態・曲・シーク (1 秒を超える移動か巻き戻し) のどれかが変わったら更新する。更新は 1 秒の debounce で、送る時点の状態から `buildActivity` で組む。曲が無くなったら消す。
- 一時停止などで Playing でなくなってから 30 秒でアクティビティを消し、再生・曲の変更・シークでまた出す。
- 表示の設定 (5 項目) が変わったら、出している最中ならすぐ作り直す。
- 接続に失敗したら 5 秒おきに 30 回まで試し、だめなら `MemoryStore` の `discordPresenceConnectionFailed` を真にする (設定画面が見る)。つながったら偽に戻す。
- `onDisabled`: タイマーとリスナーを外し、クライアントを `destroy()`。
