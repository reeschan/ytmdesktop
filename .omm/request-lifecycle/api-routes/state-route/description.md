`GET /api/v1/state`。トークンの検証と 5 秒に 1 回の制限を通った後、`PlayerStateStore.getState()` を `transformPlayerState` に通してそのまま返す。初回の取得用で、続きは realtime を使う前提 (コードのコメント)。
