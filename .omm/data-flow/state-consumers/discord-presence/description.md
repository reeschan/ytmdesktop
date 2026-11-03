`state-changed` から Discord のアクティビティを作る連携機能。

- `hasFullMetadata` が真で、再生状態・曲・シーク (1 秒を超える飛び) のどれかが変わったときだけ、1 秒のデバウンスの後に `setActivity` する。中身は `~shared/discord-presence/activity` の `buildActivity` が表示テンプレートから作る。
- 再生していない状態が 30 秒続くとアクティビティを消す。曲が無くなればすぐ消す。
- 表示テンプレートなどの設定の変更 (`integrations`) でも送り直す。
