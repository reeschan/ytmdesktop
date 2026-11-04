再生状態の正。リクエストの処理では 3 つの役を持つ。

- `/state` が `getState()` を読む。
- `/command` の値の確かめ (キューの番号の範囲など) に今のキューを使う。
- `state-changed` / `playlist-created` / `playlist-deleted` を realtime に流し、操作の結果をクライアントに届ける。
